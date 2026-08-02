import { describe, expect, it, vi } from "vitest";
import type { TelegramUpdate } from "@/lib/telegram/router";
import {
  executeTelegramUpdate,
  runWithTelegramUpdateDispatchOptions,
} from "@/lib/telegram/update-dispatch.server";
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

function inlineUpdate(updateId: number, userId: number): TelegramUpdate {
  return {
    update_id: updateId,
    inline_query: {
      id: `inline-${updateId}`,
      from: { id: userId, first_name: "Test" },
      query: "check",
    },
  };
}

function hybridUpdate(updateId: number, userId: number): TelegramUpdate {
  return {
    ...messageUpdate(updateId, userId),
    inline_query: inlineUpdate(updateId, userId).inline_query,
  };
}

async function observedMaxConcurrency(
  updates: TelegramUpdate[],
  options?: { allowStatelessInlineConcurrency?: boolean; scoped?: boolean },
): Promise<number> {
  let active = 0;
  let maxActive = 0;
  const deps = {
    dispatch: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    },
    onSessionWriteFailure: async () => undefined,
  };
  const run = () =>
    Promise.all(
      updates.map((update) =>
        executeTelegramUpdate(update, deps, {
          allowStatelessInlineConcurrency: options?.allowStatelessInlineConcurrency,
        }),
      ),
    );
  if (options?.scoped) {
    await runWithTelegramUpdateDispatchOptions({ allowStatelessInlineConcurrency: true }, run);
  } else {
    await run();
  }
  return maxActive;
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

  it("keeps a post-delivery operator-only storage failure silent for the user", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    const notify = vi.fn(async () => undefined);

    await executeTelegramUpdate(messageUpdate(104, 42), {
      dispatch: async () => {
        markTelegramSessionStorageFailure("operator_only");
      },
      onSessionWriteFailure: notify,
    });

    expect(notify).not.toHaveBeenCalled();
  });

  it("allows explicit concurrency only for strict inline-only updates", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    await expect(
      observedMaxConcurrency([inlineUpdate(201, 42), inlineUpdate(202, 42)], {
        allowStatelessInlineConcurrency: true,
      }),
    ).resolves.toBe(2);
  });

  it("keeps inline updates serialized unless the caller explicitly opts in", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    await expect(
      observedMaxConcurrency([inlineUpdate(203, 42), inlineUpdate(204, 42)]),
    ).resolves.toBe(1);
  });

  it("keeps messages and hybrid inline/message payloads serialized even with opt-in", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    await expect(
      observedMaxConcurrency([messageUpdate(205, 42), messageUpdate(206, 42)], {
        allowStatelessInlineConcurrency: true,
      }),
    ).resolves.toBe(1);

    __resetTelegramUserUpdateQueuesForTests();
    await expect(
      observedMaxConcurrency([hybridUpdate(207, 42), hybridUpdate(208, 42)], {
        allowStatelessInlineConcurrency: true,
      }),
    ).resolves.toBe(1);
  });

  it("propagates polling's scoped explicit opt-in through the lifecycle wrapper", async () => {
    __resetTelegramUserUpdateQueuesForTests();
    await expect(
      observedMaxConcurrency([inlineUpdate(209, 42), inlineUpdate(210, 42)], {
        scoped: true,
      }),
    ).resolves.toBe(2);
  });
});
