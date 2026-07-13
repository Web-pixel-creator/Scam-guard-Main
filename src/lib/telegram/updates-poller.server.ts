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

const LONG_POLL_SECONDS = 25;
const LEADER_RETRY_MS = 5_000;
const LEADER_RENEW_MS = 20_000;

export type { TelegramPollingCycleDeps, TelegramPollingCycleResult };

const defaultCycleDeps: TelegramPollingCycleDeps = {
  fetchUpdates: (offset) => getUpdates({ offset, timeout: LONG_POLL_SECONDS, limit: 1 }),
  begin: (updateId, leader) => beginTelegramUpdate(updateId, leader),
  execute: executeAndCompleteTelegramUpdate,
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

async function superviseTelegramPolling(signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    const leader = await acquireTelegramUpdateLeader();
    if (!leader) {
      await delay(LEADER_RETRY_MS, signal);
      continue;
    }

    let leaderCurrent = true;
    let renewalRunning = false;
    const renewalTimer = setInterval(() => {
      if (renewalRunning || !leaderCurrent) return;
      renewalRunning = true;
      void renewTelegramUpdateLeader(leader)
        .then((renewed) => {
          if (!renewed) leaderCurrent = false;
        })
        .finally(() => {
          renewalRunning = false;
        });
    }, LEADER_RENEW_MS);
    renewalTimer.unref?.();

    let offset: number | undefined;
    try {
      while (!signal.aborted && leaderCurrent) {
        const result = await runTelegramPollingCycle(offset, leader);
        offset = result.offset;
        await delay(result.retryAfterMs, signal);
      }
    } catch {
      console.error("telegram polling cycle failed", "exception");
    } finally {
      clearInterval(renewalTimer);
      await releaseTelegramUpdateLeader(leader);
    }
  }
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
