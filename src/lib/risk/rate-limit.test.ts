import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getRateLimitBucketCountForTests,
  resetRateLimitBucketsForTests,
} from "./rate-limit";

beforeEach(() => {
  resetRateLimitBucketsForTests();
});

describe("local fallback rate limiter", () => {
  it("caps live key cardinality and denies new identities when full", () => {
    for (let index = 0; index < 4096; index += 1) {
      expect(checkRateLimit(`key:${index}`, 2, 60_000).ok).toBe(true);
    }

    expect(getRateLimitBucketCountForTests()).toBe(4096);
    expect(checkRateLimit("overflow-key", 2, 60_000)).toMatchObject({ ok: false });
    expect(getRateLimitBucketCountForTests()).toBe(4096);
    expect(checkRateLimit("key:0", 2, 60_000)).toMatchObject({ ok: true, remaining: 0 });
  });

  it("rejects invalid or attacker-sized limiter parameters without allocating state", () => {
    expect(checkRateLimit("", 2, 60_000).ok).toBe(false);
    expect(checkRateLimit("x".repeat(513), 2, 60_000).ok).toBe(false);
    expect(checkRateLimit("key", 0, 60_000).ok).toBe(false);
    expect(checkRateLimit("key", 1001, 60_000).ok).toBe(false);
    expect(getRateLimitBucketCountForTests()).toBe(0);
  });
});
