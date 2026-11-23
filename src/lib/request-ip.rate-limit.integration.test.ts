import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: {} as Record<string, string | undefined>,
  socketIp: undefined as string | undefined,
  forwardedIp: undefined as string | undefined,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  buckets: new Map<string, number>(),
  rpcMode: "quota" as "quota" | "error" | "throw" | "malformed",
  externalFetchAttempts: 0,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getRequestIP: (options?: { xForwardedFor?: boolean }) =>
    options?.xForwardedFor ? h.forwardedIp : h.socketIp,
}));

// This emulates only the RPC boundary and its quota response, not PostgreSQL,
// its transaction/concurrency behavior, or the Supabase HTTP transport.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ name, args });
      if (h.rpcMode === "error") {
        return { data: null, error: { code: "TEST_UNAVAILABLE", message: "synthetic failure" } };
      }
      if (h.rpcMode === "throw") throw new Error("synthetic RPC transport failure");
      if (h.rpcMode === "malformed") return { data: [{ remaining: 2 }], error: null };
      const bucket = `${args.p_scope}:${args.p_key_hash}`;
      const count = (h.buckets.get(bucket) ?? 0) + 1;
      h.buckets.set(bucket, count);
      const limit = Number(args.p_limit);
      const allowed = count <= limit;
      return {
        data: [
          {
            allowed,
            remaining: Math.max(0, limit - count),
            retry_after_sec: allowed ? 0 : Number(args.p_window_seconds),
            current_count: count,
          },
        ],
        error: null,
      };
    },
  },
}));

import { publicRateLimitKey } from "./request-ip.server";
import { getRateLimitBucketCountForTests, resetRateLimitBucketsForTests } from "./risk/rate-limit";
import { checkSharedRateLimit } from "./risk/shared-rate-limit.server";

const SCOPES = ["check", "report", "appeal"] as const;
type Scope = (typeof SCOPES)[number];
const SOURCES = ["socket", "railway", "generic-cf", "generic-real", "generic-forwarded"] as const;
type Source = (typeof SOURCES)[number];
const PEPPER = "synthetic-ip-bucket-integration-pepper-only";
const WINDOW_MS = 60_000;
const GROUPS = [
  {
    name: "equivalent native IPv6 spellings",
    ips: [
      "2001:db8:abcd:12::9",
      "2001:0db8:abcd:0012:0000:0000:0000:0009",
      "2001:DB8:ABCD:12:0:0:0:9",
      "2001:db8:abcd:12:0:0::9",
    ],
  },
  {
    name: "plain IPv4 and IPv4-mapped IPv6 spellings",
    ips: ["192.0.2.9", "::ffff:192.0.2.9", "::ffff:c000:209", "0:0:0:0:0:ffff:c000:0209"],
  },
] as const;

const ENV_KEYS = [
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_ENVIRONMENT_NAME",
  "RAILWAY_DEPLOYMENT_ID",
  "TRUST_PROXY_IP_HEADERS",
  "TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "HASH_PEPPER_SECRET",
  "HASH_PEPPER_ACTIVE_VERSION",
  "HASH_PEPPER_ACTIVE_SECRET",
  "HASH_PEPPER_PREVIOUS_VERSION",
  "HASH_PEPPER_PREVIOUS_SECRET",
] as const;

function selectSource(source: Source, ip: string): void {
  h.headers = {};
  h.socketIp = "192.0.2.254";
  h.forwardedIp = undefined;
  delete process.env.RAILWAY_ENVIRONMENT_ID;
  delete process.env.TRUST_PROXY_IP_HEADERS;
  delete process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED;
  if (source === "socket") {
    h.socketIp = ip;
    return;
  }
  process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
  if (source === "railway") {
    process.env.RAILWAY_ENVIRONMENT_ID = "synthetic-integration-environment";
    h.headers["x-real-ip"] = ip;
    return;
  }
  process.env.TRUST_PROXY_IP_HEADERS = "true";
  if (source === "generic-cf") h.headers["cf-connecting-ip"] = ip;
  if (source === "generic-real") h.headers["x-real-ip"] = ip;
  if (source === "generic-forwarded") h.forwardedIp = ip;
}

async function consume(scope: Scope, ip: string, source: Source = "socket", limit = 2) {
  selectSource(source, ip);
  return checkSharedRateLimit(scope, publicRateLimitKey(scope), limit, WINDOW_MS);
}

function assertPrivacySafeRpc(scope: Scope, ips: readonly string[]): void {
  for (const call of h.rpcCalls) {
    expect(call.name).toBe("claim_rate_limit");
    expect(Object.keys(call.args).sort()).toEqual([
      "p_key_hash",
      "p_limit",
      "p_scope",
      "p_window_seconds",
    ]);
    expect(call.args.p_scope).toBe(scope);
    expect(call.args.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.args.p_window_seconds).toBe(60);
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain(PEPPER);
    for (const ip of ips) expect(serialized).not.toContain(ip);
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, undefined);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SUPABASE_URL", "https://synthetic-rate-limit.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key-not-a-credential");
  vi.stubEnv("HASH_PEPPER_SECRET", PEPPER);
  h.headers = {};
  h.socketIp = undefined;
  h.forwardedIp = undefined;
  h.rpcCalls.length = 0;
  h.buckets.clear();
  h.rpcMode = "quota";
  h.externalFetchAttempts = 0;
  resetRateLimitBucketsForTests();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal("fetch", async () => {
    h.externalFetchAttempts += 1;
    throw new Error("External network is forbidden in IP limiter integration tests");
  });
});

afterEach(() => {
  const attempts = h.externalFetchAttempts;
  resetRateLimitBucketsForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  expect(attempts).toBe(0);
});

describe("public identity through the real shared limiter and HMAC", () => {
  for (const scope of SCOPES) {
    for (const group of GROUPS) {
      it.each(SOURCES)(`${scope}: ${group.name} share one RPC budget via %s`, async (source) => {
        const results = [];
        for (const ip of group.ips) results.push(await consume(scope, ip, source));

        expect(results.map((result) => result.ok)).toEqual([true, true, false, false]);
        expect(results.map((result) => result.remaining)).toEqual([1, 0, 0, 0]);
        expect(results[2].retryAfterSec).toBe(60);
        expect(h.buckets.size).toBe(1);
        expect(h.rpcCalls).toHaveLength(group.ips.length);
        expect(new Set(h.rpcCalls.map((call) => call.args.p_key_hash)).size).toBe(1);
        assertPrivacySafeRpc(scope, group.ips);

        // Independent HMAC implementation verifies the real hash.ts boundary;
        // the identity and limiter/hash modules themselves are never mocked.
        const canonicalKey = publicRateLimitKey(scope);
        const expected = createHmac("sha256", PEPPER)
          .update(`rate-limit:${scope}:${canonicalKey}`.trim().toLowerCase())
          .digest("hex");
        expect(h.rpcCalls[0].args.p_key_hash).toBe(expected);
        expect(getRateLimitBucketCountForTests()).toBe(0);
      });
    }
  }

  it("keeps distinct addresses and all three scopes in separate hashed budgets", async () => {
    const ips = ["2001:db8::9", "2001:db8::a", "192.0.2.9", "192.0.2.10"];
    const hashes = new Set<string>();
    for (const scope of SCOPES) {
      for (const ip of ips) {
        expect(await consume(scope, ip, "socket", 1)).toMatchObject({ ok: true, remaining: 0 });
        hashes.add(String(h.rpcCalls.at(-1)?.args.p_key_hash));
        expect(await consume(scope, ip, "socket", 1)).toMatchObject({ ok: false, remaining: 0 });
      }
    }
    expect(hashes.size).toBe(12);
    expect(h.buckets.size).toBe(12);
    expect(getRateLimitBucketCountForTests()).toBe(0);
  });

  it("does not let unverified forwarding headers split the real socket budget", async () => {
    for (const spoof of GROUPS[0].ips) {
      h.socketIp = "192.0.2.9";
      h.headers = { "x-real-ip": spoof, "cf-connecting-ip": spoof };
      h.forwardedIp = spoof;
      process.env.TRUST_PROXY_IP_HEADERS = "true";
      const result = await checkSharedRateLimit("check", publicRateLimitKey("check"), 1, WINDOW_MS);
      expect(result.ok).toBe(h.rpcCalls.length === 1);
    }
    expect(h.buckets.size).toBe(1);
    assertPrivacySafeRpc("check", [...GROUPS[0].ips, "192.0.2.9"]);
  });

  it("uses the real active HMAC pepper, not a previous pepper or a raw identity", async () => {
    delete process.env.HASH_PEPPER_SECRET;
    process.env.HASH_PEPPER_ACTIVE_VERSION = "v3";
    process.env.HASH_PEPPER_ACTIVE_SECRET = PEPPER;
    process.env.HASH_PEPPER_PREVIOUS_VERSION = "v2";
    process.env.HASH_PEPPER_PREVIOUS_SECRET = "synthetic-previous-pepper-only";
    await consume("appeal", "2001:db8::9");
    const key = `rate-limit:appeal:${publicRateLimitKey("appeal")}`;
    expect(h.rpcCalls[0].args.p_key_hash).toBe(
      createHmac("sha256", PEPPER).update(key).digest("hex"),
    );
    expect(h.rpcCalls[0].args.p_key_hash).not.toBe(
      createHmac("sha256", process.env.HASH_PEPPER_PREVIOUS_SECRET).update(key).digest("hex"),
    );
    assertPrivacySafeRpc("appeal", ["2001:db8::9"]);
  });
});

describe("canonical identity through the real non-production fallback limiter", () => {
  for (const scope of SCOPES) {
    for (const group of GROUPS) {
      it.each(["missing-config", "rpc-failure"] as const)(
        `${scope}: ${group.name} share one local quota on %s`,
        async (failure) => {
          if (failure === "missing-config") delete process.env.SUPABASE_SERVICE_ROLE_KEY;
          else h.rpcMode = "error";
          const results = [];
          for (const ip of group.ips) results.push(await consume(scope, ip));
          expect(results.map((result) => result.ok)).toEqual([true, true, false, false]);
          expect(results.map((result) => result.remaining)).toEqual([1, 0, 0, 0]);
          expect(results[2].retryAfterSec).toBeGreaterThan(0);
          expect(getRateLimitBucketCountForTests()).toBe(1);
          expect(h.rpcCalls).toHaveLength(failure === "missing-config" ? 0 : group.ips.length);
          assertPrivacySafeRpc(scope, group.ips);
        },
      );
    }
  }

  it("keeps different addresses and scopes separate in the real local fallback", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    for (const scope of SCOPES) {
      for (const ip of ["2001:db8::9", "2001:db8::a"]) {
        expect(await consume(scope, ip, "socket", 1)).toMatchObject({ ok: true });
        expect(await consume(scope, ip, "socket", 1)).toMatchObject({ ok: false });
      }
    }
    expect(getRateLimitBucketCountForTests()).toBe(6);
    expect(h.rpcCalls).toHaveLength(0);
  });
});

describe("protected-runtime failure denial survives canonicalization", () => {
  const FAILURES = ["missing-config", "invalid-pepper", "error", "throw", "malformed"] as const;
  for (const runtime of ["production", "railway"] as const) {
    for (const scope of SCOPES) {
      it.each(FAILURES)(`${runtime}/${scope} remains fail-closed on %s`, async (failure) => {
        if (runtime === "production") process.env.NODE_ENV = "production";
        else process.env.RAILWAY_ENVIRONMENT_NAME = "synthetic-production";
        if (failure === "missing-config") delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else if (failure === "invalid-pepper") process.env.HASH_PEPPER_ACTIVE_VERSION = "v3";
        else h.rpcMode = failure;

        for (const ip of GROUPS[0].ips) {
          expect(await consume(scope, ip)).toEqual({ ok: false, remaining: 0, retryAfterSec: 60 });
        }
        expect(getRateLimitBucketCountForTests()).toBe(0);
        expect(h.buckets.size).toBe(0);
        expect(h.rpcCalls).toHaveLength(
          failure === "missing-config" || failure === "invalid-pepper" ? 0 : GROUPS[0].ips.length,
        );
        assertPrivacySafeRpc(scope, GROUPS[0].ips);
      });
    }
  }
});
