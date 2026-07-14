import {
  DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS,
  runQrWorkerResourceSoak,
} from "@/lib/risk/qr-worker-resource-soak";

function numericFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid --${name}`);
  return value;
}

async function main(): Promise<void> {
  const durationMinutes = numericFlag(
    "duration-minutes",
    DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.durationMs / 60_000,
  );
  const options = {
    durationMs: durationMinutes * 60_000,
    progressIntervalMs:
      numericFlag(
        "progress-seconds",
        DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.progressIntervalMs / 1_000,
      ) * 1_000,
    interCaseDelayMs: numericFlag(
      "inter-case-delay-ms",
      DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.interCaseDelayMs,
    ),
    maxRssMb: numericFlag("max-rss-mb", DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.maxRssMb),
    maxRssGrowthMb: numericFlag(
      "max-rss-growth-mb",
      DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.maxRssGrowthMb,
    ),
    maxEventLoopP99Ms: numericFlag(
      "max-event-loop-p99-ms",
      DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.maxEventLoopP99Ms,
    ),
    maxDecodeLatencyMs: numericFlag(
      "max-decode-latency-ms",
      DEFAULT_QR_WORKER_RESOURCE_SOAK_OPTIONS.maxDecodeLatencyMs,
    ),
    onProgress: (progress: object) => console.log(`QR_SOAK_PROGRESS ${JSON.stringify(progress)}`),
  };

  console.log(
    `QR worker soak: ${durationMinutes} minute(s), generated non-secret corpus, no Telegram, database, AI or reputation-provider calls.`,
  );
  const summary = await runQrWorkerResourceSoak(options);
  console.log(`QR_SOAK_FINAL ${JSON.stringify(summary)}`);
  if (!summary.passed) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "QR worker soak failed");
  process.exitCode = 1;
});
