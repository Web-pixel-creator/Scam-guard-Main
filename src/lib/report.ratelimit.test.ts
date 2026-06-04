// Tests for report submission rate limiting.
// Validates: 3 reports / 10 min per user, then blocked.
import { describe, it, expect } from "vitest";
import { checkReportRateLimit } from "./report.functions";

describe("report rate limiting", () => {
  it("allows 3 reports then blocks the 4th", () => {
    // Use a unique user ID to avoid polluting other tests' state
    const userId = 999999001;

    // First 3 should pass
    expect(checkReportRateLimit(userId).ok).toBe(true);
    expect(checkReportRateLimit(userId).ok).toBe(true);
    expect(checkReportRateLimit(userId).ok).toBe(true);

    // 4th should be blocked
    const result = checkReportRateLimit(userId);
    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("different users have independent limits", () => {
    const userA = 999999002;
    const userB = 999999003;

    // Exhaust user A's limit
    checkReportRateLimit(userA);
    checkReportRateLimit(userA);
    checkReportRateLimit(userA);
    expect(checkReportRateLimit(userA).ok).toBe(false);

    // User B should still be fine
    expect(checkReportRateLimit(userB).ok).toBe(true);
  });
});
