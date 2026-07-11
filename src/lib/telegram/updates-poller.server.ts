import { getTelegramUpdateDeliveryMode } from "@/lib/config.server";
import { getUpdates } from "@/lib/telegram/api.server";
import { installTelegramHandlers } from "@/lib/telegram/handlers";
import { telegramUpdateSchema, type TelegramUpdate } from "@/lib/telegram/router";
import {
  acquireTelegramUpdateLeader,
  beginTelegramUpdate,
  releaseTelegramUpdateLeader,
  renewTelegramUpdateLeader,
  type BeginTelegramUpdateResult,
  type TelegramUpdateLeaderLease,
} from "@/lib/telegram/update-lifecycle.server";
import { executeAndCompleteTelegramUpdate } from "@/lib/telegram/webhook.server";

const LONG_POLL_SECONDS = 25;
const LEADER_RETRY_MS = 5_000;
const POLL_RETRY_MS = 2_000;
const LEADER_RENEW_MS = 20_000;

export interface TelegramPollingCycleDeps {
  fetchUpdates: (offset?: number) => Promise<unknown[] | null>;
  begin: (
    updateId: number,
    leader: TelegramUpdateLeaderLease,
  ) => Promise<BeginTelegramUpdateResult>;
  execute: (
    update: TelegramUpdate,
    lease: Extract<
      BeginTelegramUpdateResult,
      {
        decision: "acquired";
      }
    >["lease"],
  ) => Promise<boolean>;
}

export interface TelegramPollingCycleResult {
  offset?: number;
  retryAfterMs: number;
}

const defaultCycleDeps: TelegramPollingCycleDeps = {
  fetchUpdates: (offset) => getUpdates({ offset, timeout: LONG_POLL_SECONDS, limit: 1 }),
  begin: (updateId, leader) => beginTelegramUpdate(updateId, leader),
  execute: executeAndCompleteTelegramUpdate,
};

export async function runTelegramPollingCycle(
  offset: number | undefined,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps = defaultCycleDeps,
): Promise<TelegramPollingCycleResult> {
  const updates = await deps.fetchUpdates(offset);
  if (updates === null) return { offset, retryAfterMs: POLL_RETRY_MS };
  if (updates.length === 0) return { offset, retryAfterMs: 0 };

  const raw = updates[0];
  const updateId = updateIdFromUnknown(raw);
  if (updateId === null) {
    console.error("telegram polling received invalid update", "missing_update_id");
    return { offset, retryAfterMs: POLL_RETRY_MS };
  }

  const parsed = telegramUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("telegram polling ignored unsupported update", "schema");
    return { offset: updateId + 1, retryAfterMs: 0 };
  }

  installTelegramHandlers();
  const claim = await deps.begin(updateId, leader);
  if (claim.decision === "completed") return { offset: updateId + 1, retryAfterMs: 0 };
  if (claim.decision !== "acquired") {
    return { offset, retryAfterMs: Math.max(1_000, claim.retryAfterSec * 1_000) };
  }

  const completed = await deps.execute(parsed.data, claim.lease);
  return completed
    ? { offset: updateId + 1, retryAfterMs: 0 }
    : { offset, retryAfterMs: POLL_RETRY_MS };
}

function updateIdFromUnknown(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const updateId = (value as Record<string, unknown>).update_id;
  return typeof updateId === "number" && Number.isSafeInteger(updateId) && updateId >= 0
    ? updateId
    : null;
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
