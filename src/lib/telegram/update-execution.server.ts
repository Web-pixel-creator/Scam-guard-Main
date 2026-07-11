import { AsyncLocalStorage } from "node:async_hooks";
import type { TelegramUpdateLease } from "@/lib/telegram/update-lifecycle.server";

interface TelegramUpdateExecutionState {
  updateId: number;
  sessionStorageFailed: boolean;
  sessionLanguage?: "ru" | "uz" | "en";
  lease?: TelegramUpdateLease;
}

export interface TelegramUpdateExecutionResult<T> {
  value: T;
  sessionStorageFailed: boolean;
}

const executionStorage = new AsyncLocalStorage<TelegramUpdateExecutionState>();

export function currentTelegramUpdateId(): number | null {
  return executionStorage.getStore()?.updateId ?? null;
}

export function currentTelegramUpdateLease(): TelegramUpdateLease | null {
  return executionStorage.getStore()?.lease ?? null;
}

export function markTelegramSessionStorageFailure(): void {
  const state = executionStorage.getStore();
  if (state) state.sessionStorageFailed = true;
}

export function rememberTelegramSessionLanguage(lang: "ru" | "uz" | "en"): void {
  const state = executionStorage.getStore();
  if (state) state.sessionLanguage = lang;
}

export function currentTelegramSessionLanguage(): "ru" | "uz" | "en" | null {
  return executionStorage.getStore()?.sessionLanguage ?? null;
}

export async function runWithTelegramUpdateExecution<T>(
  updateId: number,
  work: () => Promise<T>,
  options?: { lease?: TelegramUpdateLease },
): Promise<TelegramUpdateExecutionResult<T>> {
  const state: TelegramUpdateExecutionState = {
    updateId,
    sessionStorageFailed: false,
    lease: options?.lease,
  };

  return executionStorage.run(state, async () => ({
    value: await work(),
    sessionStorageFailed: state.sessionStorageFailed,
  }));
}
