import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashIdentifier } from "./hash";
import { checkRateLimit, type RateLimitResult } from "./rate-limit";

export type SharedRateLimitScope = "check" | "report" | "telegram_public_post";

type ClaimRateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_sec: number;
  current_count: number;
};

function sharedRateLimitEnabled(): boolean {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    process.env.HASH_PEPPER_SECRET?.trim(),
  );
}

function fallbackKey(scope: SharedRateLimitScope, key: string): string {
  return `shared-fallback:${scope}:${key}`;
}

function toWindowSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function validRequest(key: string, limit: number, windowMs: number): boolean {
  return key.trim().length > 0 && Number.isInteger(limit) && limit > 0 && windowMs > 0;
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
 * without Supabase or HASH_PEPPER_SECRET keep the previous in-memory behavior.
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
    return localFallback(scope, key, limit, windowMs);
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
      console.error("shared rate-limit rpc failed", error.message);
      return localFallback(scope, key, limit, windowMs);
    }

    const row = parseClaimRow(data);
    if (!row) {
      console.error("shared rate-limit rpc returned an invalid shape");
      return localFallback(scope, key, limit, windowMs);
    }

    return {
      ok: row.allowed,
      remaining: Math.max(0, Math.floor(row.remaining)),
      retryAfterSec: Math.max(0, Math.ceil(row.retry_after_sec)),
    };
  } catch (error) {
    console.error(
      "shared rate-limit unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return localFallback(scope, key, limit, windowMs);
  }
}
