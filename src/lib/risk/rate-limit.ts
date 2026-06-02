// Lightweight in-memory sliding-window rate limiter.
// Note: server runs on stateless workers — each instance keeps its own map.
// This is best-effort spam protection, not a hard guarantee.
type Bucket = number[]; // timestamps (ms)
const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = buckets.get(key) ?? [];
  // drop old
  let i = 0;
  while (i < arr.length && arr[i] < cutoff) i++;
  const recent = i > 0 ? arr.slice(i) : arr;

  if (recent.length >= limit) {
    const retryAfterMs = recent[0] + windowMs - now;
    buckets.set(key, recent);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  recent.push(now);
  buckets.set(key, recent);
  // opportunistic cleanup
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.length === 0 || v[v.length - 1] < cutoff) buckets.delete(k);
  }
  return { ok: true, remaining: limit - recent.length, retryAfterSec: 0 };
}
