import { AsyncLocalStorage } from "node:async_hooks";
import type { TelegramUpdate } from "@/lib/telegram/router";
import { runWithTelegramUpdateExecution } from "@/lib/telegram/update-execution.server";
import { serializeTelegramUserUpdate } from "@/lib/telegram/update-serialization.server";
import type { TelegramUpdateLease } from "@/lib/telegram/update-lifecycle.server";

export interface ExecuteTelegramUpdateDeps {
  dispatch: (update: TelegramUpdate) => Promise<void>;
  onSessionWriteFailure: (update: TelegramUpdate) => Promise<void>;
}

export interface ExecuteTelegramUpdateOptions {
  lease?: TelegramUpdateLease;
  /**
   * Polling-only escape hatch for stateless Inline previews. It is ignored for
   * every message, callback and hybrid update so webhook/stateful ordering stays
   * serialized even if a caller accidentally enables it.
   */
  allowStatelessInlineConcurrency?: boolean;
}

const scopedExecutionOptions = new AsyncLocalStorage<ExecuteTelegramUpdateOptions>();

export async function runWithTelegramUpdateDispatchOptions<T>(
  options: ExecuteTelegramUpdateOptions,
  work: () => Promise<T>,
): Promise<T> {
  return scopedExecutionOptions.run(options, work);
}

export function telegramUpdateUserId(update: TelegramUpdate): number | null {
  return (
    update.inline_query?.from.id ??
    update.callback_query?.from.id ??
    update.message?.from?.id ??
    null
  );
}

export async function executeTelegramUpdate(
  update: TelegramUpdate,
  deps: ExecuteTelegramUpdateDeps,
  options?: ExecuteTelegramUpdateOptions,
): Promise<void> {
  const scopedOptions = scopedExecutionOptions.getStore();
  const lease = options?.lease ?? scopedOptions?.lease;
  const allowStatelessInlineConcurrency =
    options?.allowStatelessInlineConcurrency ??
    scopedOptions?.allowStatelessInlineConcurrency ??
    false;
  const execute = async () => {
    let dispatchFailed = false;
    let dispatchError: unknown;
    const result = await runWithTelegramUpdateExecution(
      update.update_id,
      async () => {
        try {
          await deps.dispatch(update);
        } catch (error) {
          dispatchFailed = true;
          dispatchError = error;
        }
      },
      { lease },
    );
    if (result.sessionStorageFailed) await deps.onSessionWriteFailure(update);
    if (dispatchFailed) throw dispatchError;
  };

  if (allowStatelessInlineConcurrency && isStrictInlineOnly(update)) {
    await execute();
    return;
  }

  const userId = telegramUpdateUserId(update);
  if (userId === null) {
    await execute();
    return;
  }
  await serializeTelegramUserUpdate(userId, execute);
}

function isStrictInlineOnly(update: TelegramUpdate): boolean {
  return Boolean(update.inline_query) && !update.message && !update.callback_query;
}
