import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcResponse: null as null | {
    data?: unknown;
    error?: { message: string; code?: string } | null;
  },
  hashInputs: [] as string[],
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      hoisted.rpcCalls.push({ name, args });
      return hoisted.rpcResponse ?? { data: [], error: null };
    },
  },
}));

vi.mock("./hash", () => ({
  hashIdentifier: async (value: string) => {
    hoisted.hashInputs.push(value);
    return "a".repeat(64);
  },
}));

import { checkSharedRateLimit } from "./shared-rate-limit.server";

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  HASH_PEPPER_SECRET: process.env.HASH_PEPPER_SECRET,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enableShared(): void {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.HASH_PEPPER_SECRET = "rate-limit-test-pepper";
}

beforeEach(() => {
  hoisted.rpcCalls.length = 0;
  hoisted.hashInputs.length = 0;
  hoisted.rpcResponse = null;
  restoreEnv();
});

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

describe("checkSharedRateLimit", () => {
  it("uses local fallback when shared Supabase env is incomplete", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.HASH_PEPPER_SECRET;

    const key = `unit-local:${Date.now()}:${Math.random()}`;
    expect(await checkSharedRateLimit("check", key, 2, 60_000)).toMatchObject({ ok: true });
    expect(await checkSharedRateLimit("check", key, 2, 60_000)).toMatchObject({ ok: true });
    expect(await checkSharedRateLimit("check", key, 2, 60_000)).toMatchObject({ ok: false });
    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(hoisted.hashInputs).toHaveLength(0);
  });

  it("persists only a hashed key through the service-role RPC", async () => {
    enableShared();
    hoisted.rpcResponse = {
      data: [{ allowed: true, remaining: 9, retry_after_sec: 0, current_count: 1 }],
      error: null,
    };

    const rawKey = "check:203.0.113.77";
    const result = await checkSharedRateLimit("check", rawKey, 10, 60_000);

    expect(result).toEqual({ ok: true, remaining: 9, retryAfterSec: 0 });
    expect(hoisted.hashInputs).toEqual([`rate-limit:check:${rawKey}`]);
    expect(hoisted.rpcCalls).toHaveLength(1);
    expect(hoisted.rpcCalls[0]).toMatchObject({
      name: "claim_rate_limit",
      args: {
        p_scope: "check",
        p_key_hash: "a".repeat(64),
        p_limit: 10,
        p_window_seconds: 60,
      },
    });
    expect(JSON.stringify(hoisted.rpcCalls[0].args)).not.toContain(rawKey);
  });

  it("supports reputation appeal buckets without persisting the raw key", async () => {
    enableShared();
    hoisted.rpcResponse = {
      data: [{ allowed: true, remaining: 2, retry_after_sec: 0, current_count: 1 }],
      error: null,
    };

    const rawKey = "appeal:203.0.113.77";
    const result = await checkSharedRateLimit("appeal", rawKey, 3, 10 * 60_000);

    expect(result).toEqual({ ok: true, remaining: 2, retryAfterSec: 0 });
    expect(hoisted.hashInputs).toEqual([`rate-limit:appeal:${rawKey}`]);
    expect(hoisted.rpcCalls).toHaveLength(1);
    expect(hoisted.rpcCalls[0]).toMatchObject({
      name: "claim_rate_limit",
      args: {
        p_scope: "appeal",
        p_key_hash: "a".repeat(64),
        p_limit: 3,
        p_window_seconds: 600,
      },
    });
    expect(JSON.stringify(hoisted.rpcCalls[0].args)).not.toContain(rawKey);
  });

  it("supports Telegram public post fetch buckets without persisting the raw key", async () => {
    enableShared();
    hoisted.rpcResponse = {
      data: [{ allowed: true, remaining: 4, retry_after_sec: 0, current_count: 1 }],
      error: null,
    };

    const rawKey = "tgpost:tg:42";
    const result = await checkSharedRateLimit("telegram_public_post", rawKey, 5, 60_000);

    expect(result).toEqual({ ok: true, remaining: 4, retryAfterSec: 0 });
    expect(hoisted.hashInputs).toEqual([`rate-limit:telegram_public_post:${rawKey}`]);
    expect(hoisted.rpcCalls).toHaveLength(1);
    expect(hoisted.rpcCalls[0]).toMatchObject({
      name: "claim_rate_limit",
      args: {
        p_scope: "telegram_public_post",
        p_key_hash: "a".repeat(64),
        p_limit: 5,
        p_window_seconds: 60,
      },
    });
    expect(JSON.stringify(hoisted.rpcCalls[0].args)).not.toContain(rawKey);
  });

  it("maps a blocked shared bucket into retryAfterSec", async () => {
    enableShared();
    hoisted.rpcResponse = {
      data: [{ allowed: false, remaining: 0, retry_after_sec: 17, current_count: 11 }],
      error: null,
    };

    await expect(checkSharedRateLimit("check", "tg:42", 10, 60_000)).resolves.toEqual({
      ok: false,
      remaining: 0,
      retryAfterSec: 17,
    });
  });

  it("falls back locally if the shared RPC is unavailable", async () => {
    enableShared();
    hoisted.rpcResponse = { data: null, error: { message: "network unavailable" } };

    const key = `unit-rpc-down:${Date.now()}:${Math.random()}`;
    expect(await checkSharedRateLimit("report", key, 1, 60_000)).toMatchObject({ ok: true });
    expect(await checkSharedRateLimit("report", key, 1, 60_000)).toMatchObject({ ok: false });
    expect(hoisted.rpcCalls).toHaveLength(2);
  });
});
