import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelegramUpdate } from "./router";
import { TelegramInlineAnswerDeliveryError } from "./inline-answer-delivery-error";
import type {
  BeginTelegramUpdateResult,
  TelegramUpdateLeaderLease,
  TelegramUpdateLease,
} from "./update-lifecycle.server";

const apiMocks = vi.hoisted(() => ({ getUpdates: vi.fn() }));

vi.mock("@/lib/telegram/api.server", async () => {
  const actual = await vi.importActual<typeof import("./api.server")>("./api.server");
  return { ...actual, getUpdates: apiMocks.getUpdates };
});

import {
  __superviseTelegramPollingForTests,
  runTelegramPollingCycle,
  type TelegramPollingCycleDeps,
  type TelegramPollingSupervisorDeps,
} from "./updates-poller.server";

const leader: TelegramUpdateLeaderLease = {
  leaseToken: "00000000-0000-4000-8000-000000000010",
  fence: 3,
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
};

const update = {
  update_id: 77,
  message: {
    message_id: 1,
    from: { id: 9, language_code: "ru" },
    chat: { id: 9 },
    text: "hello",
  },
};

const lease: TelegramUpdateLease = {
  updateId: 77,
  leaseToken: "00000000-0000-4000-8000-000000000011",
  processingFence: 1,
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
  leaderToken: leader.leaseToken,
  leaderFence: leader.fence,
};

function updateLease(updateId: number): TelegramUpdateLease {
  return {
    ...lease,
    updateId,
    leaseToken: `00000000-0000-4000-8000-${String(updateId).padStart(12, "0")}`,
  };
}

function inlineUpdate(updateId: number, userId = 9) {
  return {
    update_id: updateId,
    inline_query: {
      id: `inline-${updateId}`,
      from: { id: userId, first_name: "Test", language_code: "ru" },
      query: `query-${updateId}`,
    },
  };
}

function messageUpdate(updateId: number, userId = 9) {
  return {
    ...update,
    update_id: updateId,
    message: {
      ...update.message,
      message_id: updateId,
      from: { id: userId, language_code: "ru" },
      chat: { id: userId },
      text: `message-${updateId}`,
    },
  };
}

function callbackUpdate(updateId: number, userId = 9) {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { id: userId, first_name: "Test", language_code: "ru" },
      data: "new_check",
    },
  };
}

function acquiredBegin() {
  return vi.fn(
    async (updateId: number): Promise<BeginTelegramUpdateResult> => ({
      decision: "acquired",
      attemptCount: 1,
      lease: updateLease(updateId),
    }),
  );
}

function deps(overrides: Partial<TelegramPollingCycleDeps> = {}): TelegramPollingCycleDeps {
  return {
    fetchUpdates: vi.fn(async () => [update]),
    begin: vi.fn(
      async (): Promise<BeginTelegramUpdateResult> => ({
        decision: "acquired",
        attemptCount: 1,
        lease,
      }),
    ),
    execute: vi.fn(async () => true),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function supervisorDeps(
  controller: AbortController,
  overrides: Partial<TelegramPollingSupervisorDeps> = {},
): TelegramPollingSupervisorDeps {
  return {
    acquireLeader: vi.fn(async () => ({
      ...leader,
      leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    })),
    renewLeader: vi.fn(async () => true),
    releaseLeader: vi.fn(async () => {
      controller.abort();
      return true;
    }),
    cycleDeps: deps({ fetchUpdates: vi.fn(async () => []) }),
    now: Date.now,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("polling leader renewal deadline", () => {
  it("stops after a hung renewal deadline and discards the completed long-poll batch", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
    const controller = new AbortController();
    const longPoll = deferred<unknown[] | null>();
    const renewal = deferred<boolean>();
    const fetchUpdates = vi.fn(() => longPoll.promise);
    const begin = acquiredBegin();
    const execute = vi.fn(async () => true);
    const renewLeader = vi.fn(() => renewal.promise);
    const configured = supervisorDeps(controller, {
      renewLeader,
      cycleDeps: deps({ fetchUpdates, begin, execute }),
    });

    const supervision = __superviseTelegramPollingForTests(controller.signal, configured);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(renewLeader).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);

    longPoll.resolve([messageUpdate(77)]);
    await supervision;

    expect(fetchUpdates).toHaveBeenCalledTimes(1);
    expect(begin).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(configured.releaseLeader).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: leader.leaseToken, fence: leader.fence }),
    );

    // A late rejection from the timed-out RPC stays observed and cannot become
    // an unhandled rejection after supervision has already stopped.
    renewal.reject(new Error("late renewal failure"));
    await Promise.resolve();
  });

  it("fails closed on an explicit lost-leader renewal result", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
    const controller = new AbortController();
    const longPoll = deferred<unknown[] | null>();
    const fetchUpdates = vi.fn(() => longPoll.promise);
    const begin = acquiredBegin();
    const configured = supervisorDeps(controller, {
      renewLeader: vi.fn(async () => false),
      cycleDeps: deps({ fetchUpdates, begin }),
    });

    const supervision = __superviseTelegramPollingForTests(controller.signal, configured);
    await vi.advanceTimersByTimeAsync(20_000);
    longPoll.resolve([messageUpdate(77)]);
    await supervision;

    expect(fetchUpdates).toHaveBeenCalledTimes(1);
    expect(begin).not.toHaveBeenCalled();
  });

  it("extends the local deadline after a bounded successful renewal", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
    const controller = new AbortController();
    const firstLongPoll = deferred<unknown[] | null>();
    const fetchUpdates = vi
      .fn<() => Promise<unknown[] | null>>()
      .mockImplementationOnce(() => firstLongPoll.promise)
      .mockImplementationOnce(async () => {
        controller.abort();
        return [];
      });
    const renewLeader = vi.fn(async () => true);
    const configured = supervisorDeps(controller, {
      renewLeader,
      cycleDeps: deps({ fetchUpdates }),
    });

    const supervision = __superviseTelegramPollingForTests(controller.signal, configured);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(renewLeader).toHaveBeenCalledTimes(1);

    firstLongPoll.resolve([]);
    await supervision;

    expect(fetchUpdates).toHaveBeenCalledTimes(2);
    expect(configured.releaseLeader).toHaveBeenCalledTimes(1);
  });

  it("does not poll when the acquired absolute lease is inside the safety margin", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T10:00:00.000Z"));
    const controller = new AbortController();
    const fetchUpdates = vi.fn(async () => []);
    const configured = supervisorDeps(controller, {
      acquireLeader: vi.fn(async () => ({
        ...leader,
        leaseExpiresAt: new Date(Date.now() + 9_000).toISOString(),
      })),
      cycleDeps: deps({ fetchUpdates }),
    });

    await __superviseTelegramPollingForTests(controller.signal, configured);

    expect(fetchUpdates).not.toHaveBeenCalled();
    expect(configured.renewLeader).not.toHaveBeenCalled();
    expect(configured.releaseLeader).toHaveBeenCalledTimes(1);
  });
});

describe("single-leader Telegram polling crash contract", () => {
  it("requests the default batch of 20 updates", async () => {
    apiMocks.getUpdates.mockReset();
    apiMocks.getUpdates.mockResolvedValueOnce([]);

    await expect(runTelegramPollingCycle(undefined, leader)).resolves.toEqual({
      offset: undefined,
      retryAfterMs: 0,
    });
    expect(apiMocks.getUpdates).toHaveBeenCalledWith({
      offset: undefined,
      timeout: 25,
      limit: 20,
    });
  });

  it("preserves the offset when Telegram is unavailable or returns no update", async () => {
    await expect(
      runTelegramPollingCycle(77, leader, deps({ fetchUpdates: vi.fn(async () => null) })),
    ).resolves.toEqual({ offset: 77, retryAfterMs: 2_000 });
    await expect(
      runTelegramPollingCycle(77, leader, deps({ fetchUpdates: vi.fn(async () => []) })),
    ).resolves.toEqual({ offset: 77, retryAfterMs: 0 });
  });

  it("advances exactly one update after durable execution succeeds", async () => {
    await expect(runTelegramPollingCycle(77, leader, deps())).resolves.toEqual({
      offset: 78,
      retryAfterMs: 0,
    });
  });

  it("prepares handlers only for a schema-valid update", async () => {
    const prepareHandlers = vi.fn();
    const d = deps({ prepareHandlers });

    await runTelegramPollingCycle(77, leader, d);
    expect(prepareHandlers).toHaveBeenCalledTimes(1);

    await runTelegramPollingCycle(
      77,
      leader,
      deps({ fetchUpdates: vi.fn(async () => []), prepareHandlers }),
    );
    expect(prepareHandlers).toHaveBeenCalledTimes(1);
  });

  it("advances the offset only after durable completion", async () => {
    const d = deps({ execute: vi.fn(async () => false) });
    await expect(runTelegramPollingCycle(undefined, leader, d)).resolves.toEqual({
      offset: undefined,
      retryAfterMs: 2_000,
    });
  });

  it("recovers completion-before-offset crashes without redispatch", async () => {
    const execute = vi.fn(async () => true);
    const d = deps({
      begin: vi.fn(async (): Promise<BeginTelegramUpdateResult> => ({ decision: "completed" })),
      execute,
    });

    await expect(runTelegramPollingCycle(undefined, leader, d)).resolves.toEqual({
      offset: 78,
      retryAfterMs: 0,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not advance or dispatch while another lease is busy", async () => {
    const execute = vi.fn(async () => true);
    const d = deps({
      begin: vi.fn(
        async (): Promise<BeginTelegramUpdateResult> => ({
          decision: "busy",
          retryAfterSec: 7,
        }),
      ),
      execute,
    });

    await expect(runTelegramPollingCycle(77, leader, d)).resolves.toEqual({
      offset: 77,
      retryAfterMs: 7_000,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("passes only update_id and leader metadata to the lifecycle boundary", async () => {
    const begin = vi.fn(async () => ({ decision: "completed" }) as const);
    await runTelegramPollingCycle(undefined, leader, deps({ begin }));
    expect(begin).toHaveBeenCalledWith(77, leader);
    expect(JSON.stringify(begin.mock.calls[0])).not.toContain("hello");
  });

  it("processes mixed inline/stateful/unsupported boundaries in order and prepares once", async () => {
    const unsupported = { update_id: 105, message: { message_id: "invalid" } };
    const batch = [
      inlineUpdate(101),
      inlineUpdate(102),
      messageUpdate(103),
      inlineUpdate(104),
      unsupported,
      inlineUpdate(106),
    ];
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    const prepareHandlers = vi.fn();
    const begin = acquiredBegin();
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      events.push(`start:${candidate.update_id}`);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      events.push(`end:${candidate.update_id}`);
      return true;
    });

    await expect(
      runTelegramPollingCycle(
        101,
        leader,
        deps({ fetchUpdates: vi.fn(async () => batch), begin, execute, prepareHandlers }),
      ),
    ).resolves.toEqual({ offset: 107, retryAfterMs: 0 });

    expect(prepareHandlers).toHaveBeenCalledTimes(1);
    expect(maxActive).toBe(2);
    expect(begin.mock.calls.map(([id]) => id)).toEqual([101, 102, 103, 104, 106]);
    expect(events.indexOf("end:102")).toBeLessThan(events.indexOf("start:103"));
    expect(events.indexOf("end:103")).toBeLessThan(events.indexOf("start:104"));
    expect(events.indexOf("end:104")).toBeLessThan(events.indexOf("start:106"));
  });

  it("lets different-user Inline finish beside a stateful update while the same user waits", async () => {
    const batch = [
      messageUpdate(201, 1),
      inlineUpdate(202, 2),
      inlineUpdate(203, 1),
      inlineUpdate(204, 3),
      messageUpdate(205, 4),
    ];
    const events: string[] = [];
    let releaseStateful!: () => void;
    const statefulGate = new Promise<void>((resolve) => {
      releaseStateful = resolve;
    });
    let differentFinished = 0;
    let resolveDifferent!: () => void;
    const differentUsersFinished = new Promise<void>((resolve) => {
      resolveDifferent = resolve;
    });
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      events.push(`start:${candidate.update_id}`);
      if (candidate.update_id === 201) await statefulGate;
      events.push(`end:${candidate.update_id}`);
      if (candidate.update_id === 202 || candidate.update_id === 204) {
        differentFinished += 1;
        if (differentFinished === 2) resolveDifferent();
      }
      return true;
    });

    const pending = runTelegramPollingCycle(
      201,
      leader,
      deps({
        fetchUpdates: vi.fn(async () => batch),
        begin: acquiredBegin(),
        execute,
      }),
    );

    await differentUsersFinished;
    expect(events).toContain("start:201");
    expect(events).toContain("end:202");
    expect(events).toContain("end:204");
    expect(events).not.toContain("start:203");
    releaseStateful();

    await expect(pending).resolves.toEqual({ offset: 206, retryAfterMs: 0 });
    expect(events.indexOf("end:202")).toBeLessThan(events.indexOf("end:201"));
    expect(events.indexOf("end:204")).toBeLessThan(events.indexOf("end:201"));
    expect(events.indexOf("start:203")).toBeGreaterThan(events.indexOf("end:201"));
    expect(events.indexOf("start:205")).toBeGreaterThan(events.indexOf("end:203"));
  });

  it("does not read ahead when the stateful update has no known user", async () => {
    const unknownUserMessage: TelegramUpdate = {
      update_id: 211,
      message: {
        message_id: 211,
        chat: { id: 1 },
        text: "message-211",
      },
    };
    const batch = [unknownUserMessage, inlineUpdate(212, 2)];
    const events: string[] = [];
    let releaseStateful!: () => void;
    const statefulGate = new Promise<void>((resolve) => {
      releaseStateful = resolve;
    });
    let resolveStarted!: () => void;
    const statefulStarted = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      events.push(`start:${candidate.update_id}`);
      if (candidate.update_id === 211) {
        resolveStarted();
        await statefulGate;
      }
      events.push(`end:${candidate.update_id}`);
      return true;
    });

    const pending = runTelegramPollingCycle(
      211,
      leader,
      deps({
        fetchUpdates: vi.fn(async () => batch),
        begin: acquiredBegin(),
        execute,
      }),
    );

    await statefulStarted;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(events).not.toContain("start:212");
    releaseStateful();

    await expect(pending).resolves.toEqual({ offset: 213, retryAfterMs: 0 });
    expect(events.indexOf("start:212")).toBeGreaterThan(events.indexOf("end:211"));
  });

  it("keeps the frontier at a failed read-ahead Inline and replays completed siblings once", async () => {
    const batch = [
      messageUpdate(301, 1),
      inlineUpdate(302, 2),
      inlineUpdate(303, 1),
      inlineUpdate(304, 3),
    ];
    const completed = new Set<number>();
    const effects = new Map<number, number>();
    const executed: number[] = [];
    let failReadAheadOnce = true;
    const begin = vi.fn(async (updateId: number): Promise<BeginTelegramUpdateResult> => {
      if (completed.has(updateId)) return { decision: "completed" };
      return { decision: "acquired", attemptCount: 1, lease: updateLease(updateId) };
    });
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      executed.push(candidate.update_id);
      if (candidate.update_id === 302 && failReadAheadOnce) {
        failReadAheadOnce = false;
        return false;
      }
      effects.set(candidate.update_id, (effects.get(candidate.update_id) ?? 0) + 1);
      completed.add(candidate.update_id);
      return true;
    });
    const fetchUpdates = vi.fn(async (requestedOffset?: number) =>
      batch.filter((candidate) => candidate.update_id >= (requestedOffset ?? 0)),
    );
    const lifecycleDeps = deps({ fetchUpdates, begin, execute });

    const first = await runTelegramPollingCycle(301, leader, lifecycleDeps);
    expect(first).toEqual({ offset: 302, retryAfterMs: 2_000 });
    expect(completed).toEqual(new Set([301, 304]));
    expect(executed).not.toContain(303);

    const second = await runTelegramPollingCycle(first.offset, leader, lifecycleDeps);
    expect(second).toEqual({ offset: 305, retryAfterMs: 0 });
    expect(effects).toEqual(
      new Map([
        [301, 1],
        [304, 1],
        [302, 1],
        [303, 1],
      ]),
    );
  });

  it("caps a contiguous inline segment at four and claims only the current chunk", async () => {
    const batch = Array.from({ length: 9 }, (_, index) => inlineUpdate(index + 1));
    const events: string[] = [];
    let active = 0;
    let maxActive = 0;
    const begin = vi.fn(async (updateId: number): Promise<BeginTelegramUpdateResult> => {
      events.push(`begin:${updateId}`);
      return { decision: "acquired", attemptCount: 1, lease: updateLease(updateId) };
    });
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      events.push(`start:${candidate.update_id}`);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      events.push(`end:${candidate.update_id}`);
      return true;
    });

    await expect(
      runTelegramPollingCycle(
        1,
        leader,
        deps({ fetchUpdates: vi.fn(async () => batch), begin, execute }),
      ),
    ).resolves.toEqual({ offset: 10, retryAfterMs: 0 });

    expect(maxActive).toBe(4);
    expect(events.indexOf("end:4")).toBeLessThan(events.indexOf("begin:5"));
    expect(events.indexOf("end:8")).toBeLessThan(events.indexOf("begin:9"));
  });

  it("stops at the first failed inline frontier and replays later completed work safely", async () => {
    const batch = [inlineUpdate(1), inlineUpdate(2), inlineUpdate(3), inlineUpdate(4)];
    const completed = new Set<number>();
    const effects = new Map<number, number>();
    let failSecondOnce = true;
    const begin = vi.fn(async (updateId: number): Promise<BeginTelegramUpdateResult> => {
      if (completed.has(updateId)) return { decision: "completed" };
      return { decision: "acquired", attemptCount: 1, lease: updateLease(updateId) };
    });
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      if (candidate.update_id === 2 && failSecondOnce) {
        failSecondOnce = false;
        return false;
      }
      effects.set(candidate.update_id, (effects.get(candidate.update_id) ?? 0) + 1);
      completed.add(candidate.update_id);
      return true;
    });
    const fetchUpdates = vi.fn(async (requestedOffset?: number) =>
      batch.filter((candidate) => candidate.update_id >= (requestedOffset ?? 0)),
    );
    const lifecycleDeps = deps({ fetchUpdates, begin, execute });

    const first = await runTelegramPollingCycle(1, leader, lifecycleDeps);
    expect(first).toEqual({ offset: 2, retryAfterMs: 2_000 });
    expect(completed).toEqual(new Set([1, 3, 4]));

    const second = await runTelegramPollingCycle(first.offset, leader, lifecycleDeps);
    expect(second).toEqual({ offset: 5, retryAfterMs: 0 });
    expect(effects).toEqual(
      new Map([
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ]),
    );
  });

  it("does not claim a future chunk after busy, false or thrown work", async () => {
    const batch = Array.from({ length: 6 }, (_, index) => inlineUpdate(index + 1));
    const begin = vi.fn(async (updateId: number): Promise<BeginTelegramUpdateResult> => {
      if (updateId === 2) return { decision: "busy", retryAfterSec: 7 };
      return { decision: "acquired", attemptCount: 1, lease: updateLease(updateId) };
    });

    await expect(
      runTelegramPollingCycle(1, leader, deps({ fetchUpdates: vi.fn(async () => batch), begin })),
    ).resolves.toEqual({ offset: 2, retryAfterMs: 7_000 });
    expect(begin.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4]);

    const statefulBegin = acquiredBegin();
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      if (candidate.update_id === 10) throw new Error("dispatch failed");
      return true;
    });
    await expect(
      runTelegramPollingCycle(
        10,
        leader,
        deps({
          fetchUpdates: vi.fn(async () => [messageUpdate(10), inlineUpdate(11)]),
          begin: statefulBegin,
          execute,
        }),
      ),
    ).resolves.toEqual({ offset: 10, retryAfterMs: 2_000 });
    expect(statefulBegin).toHaveBeenCalledTimes(1);
    expect(statefulBegin).toHaveBeenCalledWith(10, leader);
  });

  it("keeps the Inline frontier retryable for the bounded Bot API retry_after", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const begin = acquiredBegin();
    const execute = vi.fn(async () => {
      throw new TelegramInlineAnswerDeliveryError(17_000);
    });

    await expect(
      runTelegramPollingCycle(
        12,
        leader,
        deps({ fetchUpdates: vi.fn(async () => [inlineUpdate(12)]), begin, execute }),
      ),
    ).resolves.toEqual({ offset: 12, retryAfterMs: 17_000 });

    expect(begin).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith("telegram polling update failed", "exception");
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("query-12");
  });

  it("uses the longest retry delay from every failed Inline in an already-started chunk", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      if (candidate.update_id === 21) throw new Error("network failure");
      if (candidate.update_id === 22) throw new TelegramInlineAnswerDeliveryError(17_000);
      return true;
    });

    await expect(
      runTelegramPollingCycle(
        21,
        leader,
        deps({
          fetchUpdates: vi.fn(async () => [inlineUpdate(21, 1), inlineUpdate(22, 2)]),
          begin: acquiredBegin(),
          execute,
        }),
      ),
    ).resolves.toEqual({ offset: 21, retryAfterMs: 17_000 });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("query-");
  });

  it("preserves a longer failed read-ahead delay when the stateful frontier also fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const statefulGate = deferred<void>();
    const inlineAttempted = deferred<void>();
    const execute = vi.fn(async (candidate: TelegramUpdate) => {
      if (candidate.update_id === 31) {
        await statefulGate.promise;
        return false;
      }
      inlineAttempted.resolve();
      throw new TelegramInlineAnswerDeliveryError(19_000);
    });

    const pending = runTelegramPollingCycle(
      31,
      leader,
      deps({
        fetchUpdates: vi.fn(async () => [messageUpdate(31, 1), inlineUpdate(32, 2)]),
        begin: acquiredBegin(),
        execute,
      }),
    );
    await inlineAttempted.promise;
    statefulGate.resolve();

    await expect(pending).resolves.toEqual({ offset: 31, retryAfterMs: 19_000 });
    expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("query-");
  });

  it("fails closed before prepare, claim or execution for invalid or out-of-order batches", async () => {
    const cases: unknown[][] = [
      [{ message: {} }],
      [messageUpdate(20), messageUpdate(20)],
      [messageUpdate(21), messageUpdate(20)],
      [messageUpdate(19), messageUpdate(20)],
    ];

    for (const batch of cases) {
      const prepareHandlers = vi.fn();
      const begin = acquiredBegin();
      const execute = vi.fn(async () => true);
      await expect(
        runTelegramPollingCycle(
          20,
          leader,
          deps({ fetchUpdates: vi.fn(async () => batch), prepareHandlers, begin, execute }),
        ),
      ).resolves.toEqual({ offset: 20, retryAfterMs: 2_000 });
      expect(prepareHandlers).not.toHaveBeenCalled();
      expect(begin).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it("keeps stateful and hybrid inline/message updates sequential", async () => {
    const hybrid = (updateId: number) => ({
      ...messageUpdate(updateId),
      inline_query: inlineUpdate(updateId).inline_query,
    });
    const batch = [messageUpdate(31), callbackUpdate(32), hybrid(33), callbackUpdate(34)];
    let active = 0;
    let maxActive = 0;
    const execute = vi.fn(async (_candidate: TelegramUpdate) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return true;
    });

    await expect(
      runTelegramPollingCycle(
        31,
        leader,
        deps({
          fetchUpdates: vi.fn(async () => batch),
          begin: acquiredBegin(),
          execute,
        }),
      ),
    ).resolves.toEqual({ offset: 35, retryAfterMs: 0 });
    expect(maxActive).toBe(1);
    expect(execute.mock.calls.map(([candidate]) => candidate.update_id)).toEqual([31, 32, 33, 34]);
  });

  it("acknowledges a valid-id unsupported schema without claiming it", async () => {
    const begin = acquiredBegin();
    await expect(
      runTelegramPollingCycle(
        41,
        leader,
        deps({
          fetchUpdates: vi.fn(async () => [
            { update_id: 41, message: { message_id: "invalid" } },
            messageUpdate(42),
          ]),
          begin,
        }),
      ),
    ).resolves.toEqual({ offset: 43, retryAfterMs: 0 });
    expect(begin).toHaveBeenCalledTimes(1);
    expect(begin).toHaveBeenCalledWith(42, leader);
  });

  it("survives 1,000 updates, restarts, leader failover and completion uncertainty without loss or duplicate effects", async () => {
    const total = 1_000;
    const updates = Array.from({ length: total }, (_, index) => ({
      ...update,
      update_id: index + 1,
      message: { ...update.message, message_id: index + 1, text: `message-${index + 1}` },
    }));
    const leaders: TelegramUpdateLeaderLease[] = [
      { ...leader, leaseToken: "00000000-0000-4000-8000-000000000101", fence: 101 },
      { ...leader, leaseToken: "00000000-0000-4000-8000-000000000102", fence: 102 },
    ];
    let activeLeader = leaders[0];
    let confirmedBefore = 1;
    let offset: number | undefined;
    let cycles = 0;
    const completed = new Set<number>();
    const attempts = new Map<number, number>();
    const effects = new Map<number, number>();

    const lifecycleDeps: TelegramPollingCycleDeps = {
      fetchUpdates: vi.fn(async (requestedOffset?: number) => {
        if (requestedOffset !== undefined) {
          confirmedBefore = Math.max(confirmedBefore, requestedOffset);
        }
        const nextId = requestedOffset ?? confirmedBefore;
        const next = updates.find((candidate) => candidate.update_id >= nextId);
        return next ? [next] : [];
      }),
      begin: vi.fn(async (updateId, cycleLeader): Promise<BeginTelegramUpdateResult> => {
        if (
          cycleLeader.leaseToken !== activeLeader.leaseToken ||
          cycleLeader.fence !== activeLeader.fence
        ) {
          return { decision: "unavailable", retryAfterSec: 1 };
        }
        if (completed.has(updateId)) return { decision: "completed" };
        const attemptCount = (attempts.get(updateId) ?? 0) + 1;
        attempts.set(updateId, attemptCount);
        return {
          decision: "acquired",
          attemptCount,
          lease: {
            ...lease,
            updateId,
            leaseToken: `00000000-0000-4000-8000-${String(updateId).padStart(12, "0")}`,
            processingFence: attemptCount,
            leaderToken: cycleLeader.leaseToken,
            leaderFence: cycleLeader.fence,
          },
        };
      }),
      execute: vi.fn(async (candidate, updateLease) => {
        const updateId = candidate.update_id;
        expect(updateLease.leaderToken).toBe(activeLeader.leaseToken);
        expect(updateLease.leaderFence).toBe(activeLeader.fence);
        const attempt = attempts.get(updateId) ?? 0;

        // Dispatch failed before any outward effect; retry must keep the offset.
        if (updateId % 17 === 0 && attempt === 1) return false;

        effects.set(updateId, (effects.get(updateId) ?? 0) + 1);
        completed.add(updateId);

        // Completion committed but the acknowledgement was lost. On redelivery
        // begin() must return completed and skip the effect.
        if (updateId % 23 === 0) return false;
        return true;
      }),
    };

    while (confirmedBefore <= total && cycles < total * 5) {
      cycles++;

      if (cycles % 101 === 0) {
        const staleLeader = activeLeader;
        activeLeader = activeLeader.leaseToken === leaders[0].leaseToken ? leaders[1] : leaders[0];
        const staleResult = await runTelegramPollingCycle(offset, staleLeader, lifecycleDeps);
        expect(staleResult.offset).toBe(offset);
      }

      const result = await runTelegramPollingCycle(offset, activeLeader, lifecycleDeps);
      offset = result.offset;

      // A process restart forgets only its local offset. Telegram redelivery and
      // the durable completed marker must recover without executing again.
      if (cycles % 37 === 0) offset = undefined;
    }

    expect(cycles).toBeLessThan(total * 5);
    expect(completed.size).toBe(total);
    expect([...effects.values()].every((count) => count === 1)).toBe(true);
    expect(
      [...updates.map((candidate) => candidate.update_id)].every((id) => effects.has(id)),
    ).toBe(true);
    expect([...attempts.values()].every((count) => count <= 2)).toBe(true);
  });
});
