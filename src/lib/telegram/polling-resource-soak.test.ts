import { describe, expect, it } from "vitest";

import { runPollingResourceSoak } from "./polling-resource-soak";

describe("polling resource soak harness", () => {
  it("covers restart, leader handoff and both failure boundaries without lost or duplicate effects", async () => {
    const result = await runPollingResourceSoak({
      durationMs: 220,
      enqueueIntervalMs: 8,
      progressIntervalMs: 0,
      retryDelayCapMs: 2,
      mediaEveryUpdates: 4,
      mediaFixtureBytes: 1_024,
      preEffectFailureUpdateId: 3,
      acknowledgementLossUpdateId: 5,
      maxQueueDepth: 100,
      maxRssMb: 2_048,
      maxRssGrowthMb: 512,
      maxEventLoopP99Ms: 1_000,
      maxUpdateLatencyMs: 1_000,
    });

    expect(result.passed, result.failures.join(", ")).toBe(true);
    expect(result.generated).toBeGreaterThanOrEqual(20);
    expect(result.completed).toBe(result.generated);
    expect(result.outwardEffects).toBe(result.generated);
    expect(result.lostUpdates).toBe(0);
    expect(result.duplicateEffects).toBe(0);
    expect(result.maxAttempts).toBe(2);
    expect(result.retries).toBeGreaterThanOrEqual(3);
    expect(result.staleLeaderRejected).toBe(true);
    expect(result.offsetLossReplayPassed).toBe(true);
    expect(result.preEffectFailureObserved).toBe(true);
    expect(result.acknowledgementLossObserved).toBe(true);
    expect(result.mediaAccepted).toBeGreaterThan(0);
  });

  it("rejects invalid timing options before starting", async () => {
    await expect(runPollingResourceSoak({ durationMs: 0 })).rejects.toThrow(
      "duration and enqueue interval must be positive",
    );
  });
});
