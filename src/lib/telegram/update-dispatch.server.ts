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
      { lease: options?.lease },
    );
    if (result.sessionStorageFailed) await deps.onSessionWriteFailure(update);
    if (dispatchFailed) throw dispatchError;
  };

  const userId = telegramUpdateUserId(update);
  if (userId === null) {
    await execute();
    return;
  }
  await serializeTelegramUserUpdate(userId, execute);
}
