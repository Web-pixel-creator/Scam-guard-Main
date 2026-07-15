import { getTelegramUpdateDeliveryMode } from "@/lib/config.server";
import { getUpdates } from "@/lib/telegram/api.server";
import { installTelegramHandlers } from "@/lib/telegram/handlers";
import {
  runTelegramPollingCycleCore,
  type TelegramPollingCycleDeps,
  type TelegramPollingCycleResult,
} from "@/lib/telegram/polling-cycle";
import {
  acquireTelegramUpdateLeader,
  beginTelegramUpdate,
  releaseTelegramUpdateLeader,
  renewTelegramUpdateLeader,
  type TelegramUpdateLeaderLease,
} from "@/lib/telegram/update-lifecycle.server";
import { executeAndCompleteTelegramUpdate } from "@/lib/telegram/webhook.server";
import { runWithTelegramUpdateDispatchOptions } from "@/lib/telegram/update-dispatch.server";

const LONG_POLL_SECONDS = 25;
const POLL_BATCH_SIZE = 20;
const LEADER_RETRY_MS = 5_000;
const LEADER_LEASE_MS = 60_000;
const LEADER_RENEW_MS = 20_000;
const LEADER_SAFETY_MARGIN_MS = 10_000;
const LEADER_RENEW_TIMEOUT_MS = 5_000;

export type { TelegramPollingCycleDeps, TelegramPollingCycleResult };

const defaultCycleDeps: TelegramPollingCycleDeps = {
  fetchUpdates: (offset) =>
    getUpdates({ offset, timeout: LONG_POLL_SECONDS, limit: POLL_BATCH_SIZE }),
  begin: (updateId, leader) => beginTelegramUpdate(updateId, leader),
  execute: (update, lease) =>
    runWithTelegramUpdateDispatchOptions({ allowStatelessInlineConcurrency: true }, () =>
      executeAndCompleteTelegramUpdate(update, lease),
    ),
  prepareHandlers: installTelegramHandlers,
};

export async function runTelegramPollingCycle(
  offset: number | undefined,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps = defaultCycleDeps,
): Promise<TelegramPollingCycleResult> {
  return runTelegramPollingCycleCore(offset, leader, deps);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export interface TelegramPollingSupervisorDeps {
  acquireLeader: () => Promise<TelegramUpdateLeaderLease | null>;
  renewLeader: (leader: TelegramUpdateLeaderLease) => Promise<boolean>;
  releaseLeader: (leader: TelegramUpdateLeaderLease) => Promise<boolean>;
  cycleDeps: TelegramPollingCycleDeps;
  now: () => number;
}

const defaultSupervisorDeps: TelegramPollingSupervisorDeps = {
  acquireLeader: acquireTelegramUpdateLeader,
  renewLeader: renewTelegramUpdateLeader,
  releaseLeader: releaseTelegramUpdateLeader,
  cycleDeps: defaultCycleDeps,
  now: Date.now,
};

interface LocalLeaderGuard {
  current: boolean;
  usableUntilMs: number;
}

function acquiredLeaderUsableUntilMs(leader: TelegramUpdateLeaderLease, nowMs: number): number {
  const databaseExpiryMs = Date.parse(leader.leaseExpiresAt);
  if (!Number.isFinite(databaseExpiryMs)) return Number.NEGATIVE_INFINITY;
  return Math.min(databaseExpiryMs, nowMs + LEADER_LEASE_MS) - LEADER_SAFETY_MARGIN_MS;
}

function leaderIsLocallyUsable(guard: LocalLeaderGuard, nowMs: number): boolean {
  if (!guard.current || !Number.isFinite(nowMs) || nowMs >= guard.usableUntilMs) {
    guard.current = false;
    return false;
  }
  return true;
}

function renewLeaderWithDeadline(
  leader: TelegramUpdateLeaderLease,
  renew: TelegramPollingSupervisorDeps["renewLeader"],
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (renewed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(renewed);
    };
    const timeout = setTimeout(() => finish(false), LEADER_RENEW_TIMEOUT_MS);
    timeout.unref?.();

    try {
      void renew(leader).then(
        (renewed) => finish(renewed === true),
        () => finish(false),
      );
    } catch {
      finish(false);
    }
  });
}

function leaderGuardedCycleDeps(
  base: TelegramPollingCycleDeps,
  guard: LocalLeaderGuard,
  now: () => number,
): TelegramPollingCycleDeps {
  const usable = () => leaderIsLocallyUsable(guard, now());
  return {
    ...base,
    fetchUpdates: async (offset) => {
      if (!usable()) return null;
      const updates = await base.fetchUpdates(offset);
      // A long poll may finish after renewal became uncertain. Do not claim or
      // dispatch that batch; leaving the offset unchanged lets the next fenced
      // leader retrieve it.
      return usable() ? updates : null;
    },
    begin: (updateId, leader) =>
      usable()
        ? base.begin(updateId, leader)
        : Promise.resolve({ decision: "unavailable", retryAfterSec: 1 }),
    execute: (update, lease) => (usable() ? base.execute(update, lease) : Promise.resolve(false)),
  };
}

async function superviseTelegramPolling(
  signal: AbortSignal,
  deps: TelegramPollingSupervisorDeps = defaultSupervisorDeps,
): Promise<void> {
  while (!signal.aborted) {
    const leader = await deps.acquireLeader();
    if (!leader) {
      await delay(LEADER_RETRY_MS, signal);
      continue;
    }

    const guard: LocalLeaderGuard = {
      current: true,
      usableUntilMs: acquiredLeaderUsableUntilMs(leader, deps.now()),
    };
    let renewalRunning = false;
    const renewalTimer = setInterval(() => {
      if (renewalRunning || !leaderIsLocallyUsable(guard, deps.now())) return;
      renewalRunning = true;
      const renewalStartedAtMs = deps.now();
      void renewLeaderWithDeadline(leader, deps.renewLeader)
        .then((renewed) => {
          if (!renewed) {
            guard.current = false;
            return;
          }
          // The renewal RPC is bounded to less than the safety margin, so this
          // local absolute deadline remains earlier than the 60-second DB lease.
          guard.usableUntilMs = renewalStartedAtMs + LEADER_LEASE_MS - LEADER_SAFETY_MARGIN_MS;
        })
        .catch(() => {
          guard.current = false;
        })
        .finally(() => {
          renewalRunning = false;
        });
    }, LEADER_RENEW_MS);
    renewalTimer.unref?.();

    let offset: number | undefined;
    const cycleDeps = leaderGuardedCycleDeps(deps.cycleDeps, guard, deps.now);
    try {
      while (!signal.aborted && leaderIsLocallyUsable(guard, deps.now())) {
        const result = await runTelegramPollingCycle(offset, leader, cycleDeps);
        if (signal.aborted || !leaderIsLocallyUsable(guard, deps.now())) break;
        offset = result.offset;
        await delay(result.retryAfterMs, signal);
      }
    } catch {
      console.error("telegram polling cycle failed", "exception");
    } finally {
      clearInterval(renewalTimer);
      await deps.releaseLeader(leader);
    }
  }
}

export function __superviseTelegramPollingForTests(
  signal: AbortSignal,
  deps: TelegramPollingSupervisorDeps,
): Promise<void> {
  return superviseTelegramPolling(signal, deps);
}

let pollingAbortController: AbortController | undefined;

export function startTelegramUpdatesPollingIfConfigured(): (() => void) | null {
  if (getTelegramUpdateDeliveryMode() !== "polling") return null;
  if (pollingAbortController) return () => pollingAbortController?.abort();
  pollingAbortController = new AbortController();
  const controller = pollingAbortController;
  void superviseTelegramPolling(controller.signal).finally(() => {
    if (pollingAbortController === controller) pollingAbortController = undefined;
  });
  return () => controller.abort();
}

export function __resetTelegramPollingForTests(): void {
  pollingAbortController?.abort();
  pollingAbortController = undefined;
}
