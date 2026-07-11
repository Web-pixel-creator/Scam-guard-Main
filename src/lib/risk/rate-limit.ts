// Bounded in-memory limiter for local development/tests and the explicitly
// non-production fallback path. Production shared-limiter failures are handled
// fail-closed in shared-rate-limit.server.ts.
interface Bucket {
  timestamps: number[];
  expiresAt: number;
}

const MAX_BUCKETS = 4096;
const MAX_KEY_LENGTH = 512;
const MAX_LIMIT = 1000;
const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CAPACITY_PRUNE_INTERVAL_MS = 1000;

const buckets = new Map<string, Bucket>();
let nextCapacityPruneAt = 0;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

function blocked(retryAfterSec: number): RateLimitResult {
  return { ok: false, remaining: 0, retryAfterSec: Math.max(1, retryAfterSec) };
}

function validRequest(key: string, limit: number, windowMs: number): boolean {
  return (
    key.trim().length > 0 &&
    key.length <= MAX_KEY_LENGTH &&
    Number.isInteger(limit) &&
    limit > 0 &&
    limit <= MAX_LIMIT &&
    Number.isInteger(windowMs) &&
    windowMs > 0 &&
    windowMs <= MAX_WINDOW_MS
  );
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAt <= now) buckets.delete(key);
  }
}

function canAllocateBucket(now: number): boolean {
  if (buckets.size < MAX_BUCKETS) return true;

  // A full scan is itself bounded and runs at most once per second. Requests
  // for new attacker-controlled identities fail closed between scans.
  if (now >= nextCapacityPruneAt) {
    nextCapacityPruneAt = now + CAPACITY_PRUNE_INTERVAL_MS;
    pruneExpiredBuckets(now);
  }
  return buckets.size < MAX_BUCKETS;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  if (!validRequest(key, limit, windowMs)) return blocked(60);

  const now = Date.now();
  const cutoff = now - windowMs;
  const existing = buckets.get(key);

  if (!existing && !canAllocateBucket(now)) {
    return blocked(Math.min(60, Math.ceil(windowMs / 1000)));
  }

  const timestamps = existing?.timestamps ?? [];
  let firstRecent = 0;
  while (firstRecent < timestamps.length && timestamps[firstRecent] < cutoff) firstRecent += 1;
  const recent = firstRecent > 0 ? timestamps.slice(firstRecent) : timestamps;

  if (recent.length >= limit) {
    const retryAfterMs = recent[0] + windowMs - now;
    const bucket = { timestamps: recent, expiresAt: recent[recent.length - 1] + windowMs };
    buckets.delete(key);
    buckets.set(key, bucket);
    return blocked(Math.ceil(retryAfterMs / 1000));
  }

  recent.push(now);
  const bucket = { timestamps: recent, expiresAt: now + windowMs };
  buckets.delete(key);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - recent.length, retryAfterSec: 0 };
}

export function getRateLimitBucketCountForTests(): number {
  return buckets.size;
}

export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
  nextCapacityPruneAt = 0;
}
