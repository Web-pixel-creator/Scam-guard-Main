import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import process from "node:process";

import { parseAllowedImageDataUrl } from "@/lib/risk/media-data-url";
import type {
  BeginTelegramUpdateResult,
  TelegramUpdateLeaderLease,
} from "@/lib/telegram/update-lifecycle.server";
import {
  runTelegramPollingCycleCore,
  type TelegramPollingCycleDeps,
} from "@/lib/telegram/polling-cycle";

const MIB = 1024 * 1024;

export interface PollingResourceSoakOptions {
  durationMs: number;
  enqueueIntervalMs: number;
  progressIntervalMs: number;
  retryDelayCapMs: number;
  mediaEveryUpdates: number;
  mediaFixtureBytes: number;
  preEffectFailureUpdateId: number;
  acknowledgementLossUpdateId: number;
  maxQueueDepth: number;
  maxRssMb: number;
  maxRssGrowthMb: number;
  maxEventLoopP99Ms: number;
  maxUpdateLatencyMs: number;
  onProgress?: (progress: PollingResourceSoakProgress) => void;
}

export interface PollingResourceSoakProgress {
  elapsedSeconds: number;
  generated: number;
  completed: number;
  outwardEffects: number;
  retries: number;
  queueDepth: number;
  rssMb: number;
  eventLoopP99Ms: number;
}

export interface PollingResourceSoakSummary extends PollingResourceSoakProgress {
  passed: boolean;
  failures: string[];
  requestedDurationMs: number;
  elapsedMs: number;
  duplicateEffects: number;
  lostUpdates: number;
  maxAttempts: number;
  maxQueueDepth: number;
  maxRssMb: number;
  rssGrowthMb: number;
  heapUsedMb: number;
  externalMb: number;
  eventLoopMeanMs: number;
  eventLoopMaxMs: number;
  updateLatencyP95Ms: number;
  updateLatencyP99Ms: number;
  updateLatencyMaxMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  staleLeaderRejected: boolean;
  offsetLossReplayPassed: boolean;
  preEffectFailureObserved: boolean;
  acknowledgementLossObserved: boolean;
  mediaAccepted: number;
  mediaRejected: number;
}

export const DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS: PollingResourceSoakOptions = {
  durationMs: 60 * 60 * 1000,
  enqueueIntervalMs: 100,
  progressIntervalMs: 60 * 1000,
  retryDelayCapMs: 2_000,
  mediaEveryUpdates: 200,
  mediaFixtureBytes: 3 * MIB,
  preEffectFailureUpdateId: 17,
  acknowledgementLossUpdateId: 23,
  maxQueueDepth: 100,
  maxRssMb: 512,
  maxRssGrowthMb: 192,
  maxEventLoopP99Ms: 250,
  maxUpdateLatencyMs: 10_000,
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values: readonly number[], rank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function leaseToken(suffix: number): string {
  return `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
}

function buildUpdate(updateId: number): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 9_000_000_001, language_code: "ru" },
      chat: { id: 9_000_000_001 },
      text: `controlled-soak-${updateId}`,
    },
  };
}

function makeMediaFixture(bytes: number, sequence: number): boolean {
  const mimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;
  const mime = mimeTypes[sequence % mimeTypes.length] ?? "image/png";
  const payload = Buffer.alloc(Math.max(1, bytes), sequence % 251).toString("base64");
  return parseAllowedImageDataUrl(`data:${mime};base64,${payload}`) !== null;
}

function histogramMs(value: number): number {
  return Number.isFinite(value) ? round(value / 1_000_000) : 0;
}

export async function runPollingResourceSoak(
  overrides: Partial<PollingResourceSoakOptions> = {},
): Promise<PollingResourceSoakSummary> {
  const options = { ...DEFAULT_POLLING_RESOURCE_SOAK_OPTIONS, ...overrides };
  if (options.durationMs < 1 || options.enqueueIntervalMs < 1) {
    throw new Error("duration and enqueue interval must be positive");
  }

  const startedAt = performance.now();
  const endAt = startedAt + options.durationMs;
  let nextEnqueueAt = startedAt;
  let nextProgressAt = startedAt + options.progressIntervalMs;
  const expectedUpdates = Math.ceil(options.durationMs / options.enqueueIntervalMs);
  const handoffAfterUpdates = Math.max(1, Math.ceil(expectedUpdates / 3));
  const offsetLossAfterUpdates = Math.max(1, Math.ceil((expectedUpdates * 2) / 3));

  const leaders: TelegramUpdateLeaderLease[] = [
    { leaseToken: leaseToken(101), fence: 101, leaseExpiresAt: "2099-01-01T00:00:00.000Z" },
    { leaseToken: leaseToken(102), fence: 102, leaseExpiresAt: "2099-01-01T00:00:00.000Z" },
  ];
  let activeLeader = leaders[0]!;
  let staleLeader: TelegramUpdateLeaderLease | null = null;
  let staleProbePending = false;
  let staleLeaderRejected = false;
  let offsetLossReplayPassed = false;
  let preEffectFailureObserved = false;
  let acknowledgementLossObserved = false;

  const updates: Array<Record<string, unknown>> = [];
  const enqueuedAt = new Map<number, number>();
  const completed = new Set<number>();
  const attempts = new Map<number, number>();
  const effects = new Map<number, number>();
  const latencies: number[] = [];
  let confirmedBefore = 1;
  let offset: number | undefined;
  let retries = 0;
  let maxQueueDepth = 0;
  let mediaAccepted = 0;
  let mediaRejected = 0;

  const initialMemory = process.memoryUsage();
  let maxRss = initialMemory.rss;
  let lastMemory = initialMemory;
  const initialCpu = process.cpuUsage();
  const loopDelay = monitorEventLoopDelay({ resolution: 20 });
  loopDelay.enable();

  const sampleResources = () => {
    lastMemory = process.memoryUsage();
    maxRss = Math.max(maxRss, lastMemory.rss);
  };
  const resourceTimer = setInterval(sampleResources, 1_000);
  resourceTimer.unref?.();

  const queueDepth = () => Math.max(0, updates.length - confirmedBefore + 1);
  const progressSnapshot = (): PollingResourceSoakProgress => ({
    elapsedSeconds: round((performance.now() - startedAt) / 1000),
    generated: updates.length,
    completed: completed.size,
    outwardEffects: effects.size,
    retries,
    queueDepth: queueDepth(),
    rssMb: round(lastMemory.rss / MIB),
    eventLoopP99Ms: histogramMs(loopDelay.percentile(99)),
  });

  const deps: TelegramPollingCycleDeps = {
    fetchUpdates: async (requestedOffset?: number) => {
      if (requestedOffset !== undefined) {
        confirmedBefore = Math.max(confirmedBefore, requestedOffset);
      }
      const nextId = requestedOffset ?? confirmedBefore;
      const next = updates[nextId - 1];
      return next ? [next] : [];
    },
    begin: async (updateId, cycleLeader): Promise<BeginTelegramUpdateResult> => {
      if (
        cycleLeader.leaseToken !== activeLeader.leaseToken ||
        cycleLeader.fence !== activeLeader.fence
      ) {
        staleLeaderRejected = true;
        return { decision: "unavailable", retryAfterSec: 1 };
      }
      if (completed.has(updateId)) return { decision: "completed" };
      const attemptCount = (attempts.get(updateId) ?? 0) + 1;
      attempts.set(updateId, attemptCount);
      return {
        decision: "acquired",
        attemptCount,
        lease: {
          updateId,
          leaseToken: leaseToken(10_000 + updateId),
          processingFence: attemptCount,
          leaseExpiresAt: "2099-01-01T00:00:00.000Z",
          leaderToken: cycleLeader.leaseToken,
          leaderFence: cycleLeader.fence,
        },
      };
    },
    execute: async (candidate, updateLease) => {
      const updateId = candidate.update_id;
      const attempt = attempts.get(updateId) ?? 0;
      if (
        updateId === options.preEffectFailureUpdateId &&
        attempt === 1 &&
        !preEffectFailureObserved
      ) {
        preEffectFailureObserved = true;
        return false;
      }

      effects.set(updateId, (effects.get(updateId) ?? 0) + 1);
      completed.add(updateId);
      latencies.push(Math.max(0, performance.now() - (enqueuedAt.get(updateId) ?? startedAt)));

      if (
        updateId === options.acknowledgementLossUpdateId &&
        attempt === 1 &&
        !acknowledgementLossObserved
      ) {
        acknowledgementLossObserved = true;
        return false;
      }
      return (
        updateLease.leaderToken === activeLeader.leaseToken &&
        updateLease.leaderFence === activeLeader.fence
      );
    },
  };

  try {
    while (
      performance.now() < endAt ||
      nextEnqueueAt < endAt ||
      confirmedBefore <= updates.length
    ) {
      const now = performance.now();
      while (nextEnqueueAt <= now && nextEnqueueAt < endAt) {
        const updateId = updates.length + 1;
        updates.push(buildUpdate(updateId));
        enqueuedAt.set(updateId, nextEnqueueAt);
        nextEnqueueAt += options.enqueueIntervalMs;

        if (options.mediaEveryUpdates > 0 && updateId % options.mediaEveryUpdates === 0) {
          if (makeMediaFixture(options.mediaFixtureBytes, updateId)) mediaAccepted += 1;
          else mediaRejected += 1;
        }
      }

      if (!staleLeader && updates.length >= handoffAfterUpdates) {
        staleLeader = activeLeader;
        activeLeader = leaders[1]!;
        staleProbePending = true;
      }
      if (!offsetLossReplayPassed && updates.length >= offsetLossAfterUpdates) {
        offset = undefined;
        offsetLossReplayPassed = true;
      }

      maxQueueDepth = Math.max(maxQueueDepth, queueDepth());
      if (staleProbePending && confirmedBefore <= updates.length && staleLeader) {
        const staleResult = await runTelegramPollingCycleCore(offset, staleLeader, deps);
        if (staleResult.retryAfterMs > 0) retries += 1;
        staleProbePending = false;
      }

      const result = await runTelegramPollingCycleCore(offset, activeLeader, deps);
      offset = result.offset;
      if (result.retryAfterMs > 0) {
        retries += 1;
        await delay(Math.min(result.retryAfterMs, options.retryDelayCapMs));
      } else if (confirmedBefore > updates.length && performance.now() < endAt) {
        await delay(Math.min(10, Math.max(1, nextEnqueueAt - performance.now())));
      } else {
        await delay(0);
      }

      if (
        options.progressIntervalMs > 0 &&
        performance.now() >= nextProgressAt &&
        options.onProgress
      ) {
        sampleResources();
        options.onProgress(progressSnapshot());
        nextProgressAt += options.progressIntervalMs;
      }
    }
  } finally {
    clearInterval(resourceTimer);
    sampleResources();
    loopDelay.disable();
  }

  const elapsedMs = performance.now() - startedAt;
  const cpu = process.cpuUsage(initialCpu);
  const duplicateEffects = [...effects.values()].filter((count) => count !== 1).length;
  const lostUpdates = updates.length - effects.size;
  const maxAttempts = Math.max(0, ...attempts.values());
  const updateLatencyP95Ms = percentile(latencies, 0.95);
  const updateLatencyP99Ms = percentile(latencies, 0.99);
  const updateLatencyMaxMs = Math.max(0, ...latencies);
  const eventLoopP99Ms = histogramMs(loopDelay.percentile(99));
  const eventLoopMeanMs = histogramMs(loopDelay.mean);
  const eventLoopMaxMs = histogramMs(loopDelay.max);
  const rssGrowthMb = (maxRss - initialMemory.rss) / MIB;
  const failures: string[] = [];

  if (elapsedMs < options.durationMs) failures.push("duration_short");
  if (completed.size !== updates.length) failures.push("incomplete_updates");
  if (lostUpdates !== 0) failures.push("lost_updates");
  if (duplicateEffects !== 0) failures.push("duplicate_effects");
  if (maxAttempts > 2) failures.push("attempts_unbounded");
  if (!staleLeaderRejected) failures.push("stale_leader_rejection_missing");
  if (!offsetLossReplayPassed) failures.push("offset_loss_replay_missing");
  if (!preEffectFailureObserved) failures.push("pre_effect_failure_missing");
  if (!acknowledgementLossObserved) failures.push("ack_loss_missing");
  if (mediaAccepted === 0) failures.push("media_fixture_missing");
  if (maxQueueDepth > options.maxQueueDepth) failures.push("queue_depth_exceeded");
  if (maxRss / MIB > options.maxRssMb) failures.push("rss_limit_exceeded");
  if (rssGrowthMb > options.maxRssGrowthMb) failures.push("rss_growth_exceeded");
  if (eventLoopP99Ms > options.maxEventLoopP99Ms) failures.push("event_loop_p99_exceeded");
  if (updateLatencyMaxMs > options.maxUpdateLatencyMs) failures.push("latency_limit_exceeded");

  return {
    ...progressSnapshot(),
    passed: failures.length === 0,
    failures,
    requestedDurationMs: options.durationMs,
    elapsedMs: round(elapsedMs),
    duplicateEffects,
    lostUpdates,
    maxAttempts,
    maxQueueDepth,
    maxRssMb: round(maxRss / MIB),
    rssGrowthMb: round(rssGrowthMb),
    heapUsedMb: round(lastMemory.heapUsed / MIB),
    externalMb: round(lastMemory.external / MIB),
    eventLoopMeanMs,
    eventLoopMaxMs,
    updateLatencyP95Ms: round(updateLatencyP95Ms),
    updateLatencyP99Ms: round(updateLatencyP99Ms),
    updateLatencyMaxMs: round(updateLatencyMaxMs),
    cpuUserMs: round(cpu.user / 1000),
    cpuSystemMs: round(cpu.system / 1000),
    staleLeaderRejected,
    offsetLossReplayPassed,
    preEffectFailureObserved,
    acknowledgementLossObserved,
    mediaAccepted,
    mediaRejected,
  };
}
