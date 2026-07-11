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
});
