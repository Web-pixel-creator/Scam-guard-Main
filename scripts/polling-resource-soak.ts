import process from "node:process";

import {
  DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS,
  runPollingResourceSoak,
} from "@/lib/telegram/polling-resource-soak";

function numericFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`invalid --${name}`);
  return value;
}

const durationMinutes = numericFlag(
  "duration-minutes",
  DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.durationMs / 60_000,
);
const options = {
  durationMs: durationMinutes * 60_000,
  enqueueIntervalMs: numericFlag(
    "enqueue-ms",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.enqueueIntervalMs,
  ),
  progressIntervalMs:
    numericFlag(
      "progress-seconds",
      DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.progressIntervalMs / 1_000,
    ) * 1_000,
  retryDelayCapMs: numericFlag(
    "retry-delay-cap-ms",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.retryDelayCapMs,
  ),
  mediaEveryUpdates: numericFlag(
    "media-every-updates",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.mediaEveryUpdates,
  ),
  mediaFixtureBytes: numericFlag(
    "media-fixture-bytes",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.mediaFixtureBytes,
  ),
  preEffectFailureUpdateId: numericFlag(
    "pre-effect-failure-update-id",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.preEffectFailureUpdateId,
  ),
  acknowledgementLossUpdateId: numericFlag(
    "ack-loss-update-id",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.acknowledgementLossUpdateId,
  ),
  maxQueueDepth: numericFlag(
    "max-queue-depth",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.maxQueueDepth,
  ),
  maxRssMb: numericFlag("max-rss-mb", DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.maxRssMb),
  maxRssGrowthMb: numericFlag(
    "max-rss-growth-mb",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.maxRssGrowthMb,
  ),
  maxEventLoopP99Ms: numericFlag(
    "max-event-loop-p99-ms",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.maxEventLoopP99Ms,
  ),
  maxUpdateLatencyMs: numericFlag(
    "max-update-latency-ms",
    DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS.maxUpdateLatencyMs,
  ),
  onProgress: (progress: object) => console.log(`SOAK_PROGRESS ${JSON.stringify(progress)}`),
};

console.log(
  `Polling/resource soak: ${durationMinutes} minute(s), controlled in-memory updates, no Telegram, database or provider writes.`,
);
const summary = await runPollingResourceSoak(options);
console.log(`SOAK_FINAL ${JSON.stringify(summary)}`);
if (!summary.passed) process.exitCode = 1;
