import process from "node:process";

import { runCheck, type RateLimitedError } from "@/lib/risk/check-core";
import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";

type FailureMode = "rpc_error" | "invalid_shape" | "transport_error";

type RecordedFetch = {
  method: string;
  pathname: string;
};

const syntheticSupabaseUrl = "http://127.0.0.1:9";
const expectedRpcPath = "/rest/v1/rpc/claim_rate_limit";
const originalFetch = globalThis.fetch;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  HASH_PEPPER_SECRET: process.env.HASH_PEPPER_SECRET,
};

let failureMode: FailureMode = "transport_error";
const fetches: RecordedFetch[] = [];

function restoreEnvironment(): void {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
}

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertOnlyClaimRpc(expectedCalls: number): void {
  assertCondition(fetches.length === expectedCalls, `expected ${expectedCalls} fetch call(s)`);
  assertCondition(
    fetches.every((entry) => entry.method === "POST" && entry.pathname === expectedRpcPath),
    "a request escaped the isolated claim_rate_limit RPC boundary",
  );
}

const forcedFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input);
  fetches.push({
    method: (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
    pathname: url.pathname,
  });

  assertCondition(url.origin === syntheticSupabaseUrl, "unexpected external network destination");
  assertCondition(url.pathname === expectedRpcPath, "unexpected downstream network sink");

  if (failureMode === "transport_error") {
    throw new TypeError("forced isolated claim_rate_limit transport failure");
  }

  if (failureMode === "rpc_error") {
    return new Response(
      JSON.stringify({
        code: "PGRST999",
        message: "forced isolated claim_rate_limit RPC failure",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  return new Response(JSON.stringify([{ remaining: 9 }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

async function expectDenied(mode: FailureMode): Promise<void> {
  failureMode = mode;
  fetches.length = 0;
  const result = await checkSharedRateLimit("check", `runtime-smoke:${mode}`, 10, 60_000);
  assertCondition(!result.ok, `${mode} unexpectedly granted a request`);
  assertCondition(result.remaining === 0, `${mode} returned a non-zero allowance`);
  assertCondition(result.retryAfterSec === 60, `${mode} returned an unsafe retry window`);
  assertOnlyClaimRpc(1);
}

async function expectHashFailureDenied(): Promise<void> {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  assertCondition(cryptoDescriptor?.configurable, "runtime crypto cannot be isolated safely");
  fetches.length = 0;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: cryptoDescriptor.enumerable,
    value: undefined,
  });

  try {
    const result = await checkSharedRateLimit("check", "runtime-smoke:hash-error", 10, 60_000);
    assertCondition(!result.ok, "hash failure unexpectedly granted a request");
    assertCondition(result.remaining === 0, "hash failure returned a non-zero allowance");
    assertCondition(result.retryAfterSec === 60, "hash failure returned an unsafe retry window");
    assertOnlyClaimRpc(0);
  } finally {
    Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
  }
}

async function main(): Promise<void> {
  // These values exist only in this short-lived process. The fetch replacement
  // below prevents every real network call and fails if any sink other than the
  // synthetic claim_rate_limit RPC is attempted.
  process.env.NODE_ENV = "production";
  process.env.RAILWAY_ENVIRONMENT ||= "runtime-smoke";
  process.env.SUPABASE_URL = syntheticSupabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-runtime-smoke-service-key";
  process.env.HASH_PEPPER_SECRET = "synthetic-runtime-smoke-hmac-pepper";
  globalThis.fetch = forcedFetch;

  try {
    delete process.env.HASH_PEPPER_SECRET;
    fetches.length = 0;
    const missingConfig = await checkSharedRateLimit(
      "check",
      "runtime-smoke:missing-config",
      10,
      60_000,
    );
    assertCondition(!missingConfig.ok, "missing production configuration granted a request");
    assertCondition(missingConfig.retryAfterSec === 60, "missing configuration retry is unsafe");
    assertOnlyClaimRpc(0);
    process.env.HASH_PEPPER_SECRET = "synthetic-runtime-smoke-hmac-pepper";

    await expectHashFailureDenied();
    await expectDenied("rpc_error");
    await expectDenied("invalid_shape");
    await expectDenied("transport_error");

    failureMode = "transport_error";
    fetches.length = 0;
    let consumerError: RateLimitedError | null = null;
    try {
      await runCheck({
        input: "https://example.test/runtime-smoke",
        lang: "en",
        rateLimitKey: "runtime-smoke:consumer",
        channel: "web",
        skipAi: false,
        persist: true,
      });
    } catch (error) {
      consumerError = error as RateLimitedError;
    }

    assertCondition(consumerError?.message === "rate_limited", "consumer did not fail safely");
    assertCondition(consumerError.status === 429, "consumer did not surface HTTP 429 semantics");
    assertCondition(consumerError.retryAfter === 60, "consumer retry window is unsafe");
    assertOnlyClaimRpc(1);

    console.log(
      `RATE_LIMIT_FAILURE_SMOKE_FINAL ${JSON.stringify({
        passed: true,
        productionPolicy: true,
        isolated: true,
        cases: [
          "missing_config",
          "hash_error",
          "rpc_error",
          "invalid_shape",
          "transport_error",
          "consumer_429_before_sinks",
        ],
        externalNetworkCalls: 0,
        databaseWrites: 0,
        unexpectedSinkCalls: 0,
      })}`,
    );
  } finally {
    restoreEnvironment();
  }
}

void main().catch((error: unknown) => {
  restoreEnvironment();
  console.error(error instanceof Error ? error.message : "shared rate-limit failure smoke failed");
  process.exitCode = 1;
});
