import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  response: { data: null as unknown, error: null as unknown },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      h.calls.push({ name, args });
      return h.response;
    },
  },
}));

import {
  beginTelegramUpdate,
  completeTelegramUpdate,
  type TelegramUpdateLease,
} from "./update-lifecycle.server";

beforeEach(() => {
  h.calls.length = 0;
  h.response = { data: null, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Telegram update lifecycle RPC boundary", () => {
  it("returns an acquired metadata-only lease from a strict result", async () => {
    h.response.data = [
      {
        decision: "acquired",
        processing_fence: 4,
        retry_after_sec: 0,
        lease_expires_at: "2026-07-11T05:30:00.000Z",
        attempt_count: 2,
      },
    ];

    const result = await beginTelegramUpdate(123);

    expect(result.decision).toBe("acquired");
    expect(h.calls[0].name).toBe("begin_telegram_update");
    expect(h.calls[0].args).toEqual({
      p_update_id: 123,
      p_lease_token: expect.any(String),
      p_lease_seconds: 120,
      p_leader_token: null,
      p_leader_fence: null,
    });
    expect(JSON.stringify(h.calls[0].args)).not.toMatch(/text|chat|user|payload|message/i);
  });

  it.each([
    ["completed", { decision: "completed" }],
    ["busy", { decision: "busy", retryAfterSec: 7 }],
  ] as const)("parses the %s decision", async (decision, expected) => {
    h.response.data = [{ decision, retry_after_sec: 7 }];
    await expect(beginTelegramUpdate(124)).resolves.toEqual(expected);
  });

  it("fails closed when the RPC result is missing or ambiguous", async () => {
    await expect(beginTelegramUpdate(125)).resolves.toEqual({
      decision: "unavailable",
      retryAfterSec: 1,
    });
    expect(console.error).toHaveBeenCalledWith("telegram update lifecycle unavailable", "begin");
  });

  it("treats an ambiguous completion commit as incomplete", async () => {
    const lease: TelegramUpdateLease = {
      updateId: 126,
      leaseToken: "2397f071-8fbd-4c97-a6df-5d22737143a1",
      processingFence: 1,
      leaseExpiresAt: "2026-07-11T05:30:00.000Z",
    };
    h.response = { data: null, error: { message: "connection lost after commit" } };

    await expect(completeTelegramUpdate(lease)).resolves.toBe(false);
  });
});
