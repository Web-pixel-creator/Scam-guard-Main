import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashIdentifier, isHashPepperConfigured } from "./hash";
import { checkRateLimit, type RateLimitResult } from "./rate-limit";

export type SharedRateLimitScope = "check" | "report" | "telegram_public_post" | "appeal";

type ClaimRateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_sec: number;
  current_count: number;
};

const MAX_SHARED_KEY_LENGTH = 400;
const MAX_LIMIT = 1000;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
let nextDegradedLogAt = 0;

function sharedRateLimitEnabled(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    isHashPepperConfigured(),
  );
}

function fallbackKey(scope: SharedRateLimitScope, key: string): string {
  return `shared-fallback:${scope}:${key}`;
}

function toWindowSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function validRequest(key: string, limit: number, windowMs: number): boolean {
  return (
    key.trim().length > 0 &&
    key.length <= MAX_SHARED_KEY_LENGTH &&
    Number.isInteger(limit) &&
    limit > 0 &&
    limit <= MAX_LIMIT &&
    Number.isInteger(windowMs) &&
    windowMs > 0 &&
    windowMs <= MAX_WINDOW_MS
  );
}

function rpcClient() {
  return supabaseAdmin as unknown as SupabaseClient;
}

function localFallback(
  scope: SharedRateLimitScope,
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  return checkRateLimit(fallbackKey(scope, key), limit, windowMs);
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT?.trim());
}

function degradedResult(windowMs: number): RateLimitResult {
  return {
    ok: false,
    remaining: 0,
    retryAfterSec: Math.min(300, Math.max(1, Math.ceil(windowMs / 1000))),
  };
}

function logDegraded(reason: string): void {
  const now = Date.now();
  if (now < nextDegradedLogAt) return;
  nextDegradedLogAt = now + 60_000;
  console.error(`shared rate-limit degraded: ${reason}`);
}

function fallbackOrDeny(
  scope: SharedRateLimitScope,
  key: string,
  limit: number,
  windowMs: number,
  reason: string,
): RateLimitResult {
  if (!isProductionRuntime()) return localFallback(scope, key, limit, windowMs);
  logDegraded(reason);
  return degradedResult(windowMs);
}

function parseClaimRow(data: unknown): ClaimRateLimitRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const maybe = row as Partial<ClaimRateLimitRow>;
  if (typeof maybe.allowed !== "boolean") return null;
  return {
    allowed: maybe.allowed,
    remaining: Number.isFinite(maybe.remaining) ? Number(maybe.remaining) : 0,
    retry_after_sec: Number.isFinite(maybe.retry_after_sec) ? Number(maybe.retry_after_sec) : 0,
    current_count: Number.isFinite(maybe.current_count) ? Number(maybe.current_count) : 0,
  };
}

/**
 * Shared rate-limit with a privacy-safe Postgres bucket and local fallback.
 *
 * Raw keys can contain IPs or Telegram user ids, but only
 * HMAC("rate-limit:<scope>:<raw key>") is persisted. Local/test environments
 * without Supabase or a valid hash-pepper configuration use bounded in-memory behavior.
 * Production/Railway fails closed when configuration, hashing or the shared RPC
 * is unavailable; it never silently multiplies a deployment-wide quota into
 * one fresh allowance per process.
 */
export async function checkSharedRateLimit(
  scope: SharedRateLimitScope,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!validRequest(key, limit, windowMs)) {
    return { ok: false, remaining: 0, retryAfterSec: 60 };
  }

  if (!sharedRateLimitEnabled()) {
    return fallbackOrDeny(scope, key, limit, windowMs, "missing shared configuration");
  }

  try {
    const keyHash = await hashIdentifier(`rate-limit:${scope}:${key}`);
    const { data, error } = await rpcClient().rpc("claim_rate_limit", {
      p_scope: scope,
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: toWindowSeconds(windowMs),
    });

    if (error) {
      return fallbackOrDeny(scope, key, limit, windowMs, `rpc failure (${error.code ?? "error"})`);
    }

    const row = parseClaimRow(data);
    if (!row) {
      return fallbackOrDeny(scope, key, limit, windowMs, "invalid rpc response");
    }

    return {
      ok: row.allowed,
      remaining: Math.max(0, Math.floor(row.remaining)),
      retryAfterSec: Math.max(0, Math.ceil(row.retry_after_sec)),
    };
  } catch (error) {
    return fallbackOrDeny(
      scope,
      key,
      limit,
      windowMs,
      error instanceof Error ? `exception (${error.name})` : "unknown exception",
    );
  }
}
