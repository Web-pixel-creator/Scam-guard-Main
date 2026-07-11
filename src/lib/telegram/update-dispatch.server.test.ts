import { describe, expect, it, vi } from "vitest";
import type { TelegramUpdate } from "@/lib/telegram/router";
import { executeTelegramUpdate } from "@/lib/telegram/update-dispatch.server";
import { markTelegramSessionStorageFailure } from "@/lib/telegram/update-execution.server";
import { __resetTelegramUserUpdateQueuesForTests } from "@/lib/telegram/update-serialization.server";

function messageUpdate(updateId: number, userId: number): TelegramUpdate {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: userId, first_name: "Test" },
      chat: { id: userId, type: "private" },
      text: "test",
    },
  };
}

describe("executeTelegramUpdate", () => {
  it("reports a session write failure after dispatch without exposing state", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const notify = vi.fn(async () => undefined);

    await executeTelegramUpdate(messageUpdate(101, 42), {
      dispatch: async () => {
        markTelegramSessionStorageFailure();
      },
      onSessionWriteFailure: notify,
    });

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("reports a storage failure even when dispatch subsequently throws", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const notify = vi.fn(async () => undefined);

    await expect(
      executeTelegramUpdate(messageUpdate(103, 42), {
        dispatch: async () => {
          markTelegramSessionStorageFailure();
          throw new Error("later handler failure");
        },
        onSessionWriteFailure: notify,
      }),
    ).rejects.toThrow("later handler failure");

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not emit a failure warning for a successful or stale-safe dispatch", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const notify = vi.fn(async () => undefined);

    await executeTelegramUpdate(messageUpdate(102, 42), {
      dispatch: async () => undefined,
      onSessionWriteFailure: notify,
    });

    expect(notify).not.toHaveBeenCalled();
  });
});
