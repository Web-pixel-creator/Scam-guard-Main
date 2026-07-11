import { describe, expect, it, vi } from "vitest";
import {
  currentTelegramSessionLanguage,
  currentTelegramUpdateId,
  markTelegramSessionStorageFailure,
  rememberTelegramSessionLanguage,
  runWithTelegramUpdateExecution,
} from "@/lib/telegram/update-execution.server";
import {
  __resetTelegramUserUpdateQueuesForTests,
  serializeTelegramUserUpdate,
} from "@/lib/telegram/update-serialization.server";

describe("Telegram update execution context", () => {
  it("exposes request-local session state only inside the async execution", async () => {
    expect(currentTelegramUpdateId()).toBeNull();
    expect(currentTelegramSessionLanguage()).toBeNull();

    const result = await runWithTelegramUpdateExecution(101, async () => {
      expect(currentTelegramUpdateId()).toBe(101);
      rememberTelegramSessionLanguage("uz");
      expect(currentTelegramSessionLanguage()).toBe("uz");
      await Promise.resolve();
      markTelegramSessionStorageFailure();
      return "done";
    });

    expect(result).toEqual({ value: "done", sessionStorageFailed: true });
    expect(currentTelegramUpdateId()).toBeNull();
    expect(currentTelegramSessionLanguage()).toBeNull();
  });
});

describe("per-user Telegram update serialization", () => {
  it("finishes an older update before starting the next update for the same user", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = serializeTelegramUserUpdate(42, async () => {
      events.push("start-1");
      await firstGate;
      events.push("end-1");
    });
    const second = serializeTelegramUserUpdate(42, async () => {
      events.push("start-2");
      events.push("end-2");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toEqual(["start-1"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("does not serialize independent users behind each other", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = serializeTelegramUserUpdate(1, async () => {
      events.push("start-1");
      await firstGate;
    });
    const second = serializeTelegramUserUpdate(2, async () => {
      events.push("start-2");
    });

    await second;
    expect(events).toEqual(["start-1", "start-2"]);
    releaseFirst();
    await first;
  });

  it("does not release a same-user queue while the older work is still running", async () => {
    vi.useFakeTimers();
    __resetTelegramUserUpdateQueuesForTests();
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = serializeTelegramUserUpdate(9, async () => {
      events.push("start-1");
      await firstGate;
      events.push("end-1");
    });
    const second = serializeTelegramUserUpdate(9, async () => {
      events.push("start-2");
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(events).toEqual(["start-1"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["start-1", "end-1", "start-2"]);
    vi.useRealTimers();
  });
});
