import { describe, expect, it } from "vitest";

import { runQrWorkerResourceSoak } from "./qr-worker-resource-soak";

describe("QR worker resource/crash soak harness", () => {
  it("decodes PNG/JPEG, fails invalid inputs closed and recovers after worker termination", async () => {
    const result = await runQrWorkerResourceSoak({
      durationMs: 300,
      progressIntervalMs: 0,
      interCaseDelayMs: 0,
      maxRssMb: 2_048,
      maxRssGrowthMb: 512,
      maxEventLoopP99Ms: 1_000,
      maxDecodeLatencyMs: 5_000,
    });

    expect(result.passed, result.failureReasons.join(", ")).toBe(true);
    expect(result.pngDecodePasses).toBeGreaterThan(0);
    expect(result.jpegDecodePasses).toBeGreaterThan(0);
    expect(result.failures).toBe(0);
    expect(result.crashObserved).toBe(true);
    expect(result.interruptedJobFailedClosed).toBe(true);
    expect(result.workerRecoveryPassed).toBe(true);
    expect(result.queueBoundPassed).toBe(true);
    expect(result.queueAccepted).toBe(4);
    expect(result.queueRejected).toBe(1);
  }, 20_000);

  it("rejects invalid timing options", async () => {
    await expect(runQrWorkerResourceSoak({ durationMs: 0 })).rejects.toThrow(
      "duration must be positive",
    );
  });
});
