import { telegramUpdateSchema, type TelegramUpdate } from "@/lib/telegram/router";
import type {
  BeginTelegramUpdateResult,
  TelegramUpdateLeaderLease,
} from "@/lib/telegram/update-lifecycle.server";

const POLL_RETRY_MS = 2_000;

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
  prepareHandlers?: () => void;
}

export interface TelegramPollingCycleResult {
  offset?: number;
  retryAfterMs: number;
}

export async function runTelegramPollingCycleCore(
  offset: number | undefined,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
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

  deps.prepareHandlers?.();
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
