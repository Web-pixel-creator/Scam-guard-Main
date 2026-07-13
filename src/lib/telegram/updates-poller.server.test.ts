import { describe, expect, it, vi } from "vitest";
import type {
  BeginTelegramUpdateResult,
  TelegramUpdateLeaderLease,
  TelegramUpdateLease,
} from "./update-lifecycle.server";
import { runTelegramPollingCycle, type TelegramPollingCycleDeps } from "./updates-poller.server";

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

describe("single-leader Telegram polling crash contract", () => {
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
