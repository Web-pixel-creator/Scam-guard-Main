import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ current: false, checks: [] as unknown[] }));

vi.mock("@/lib/config.server", () => ({
  getTelegramBotToken: () => "fake-token",
}));

vi.mock("@/lib/telegram/update-lifecycle.server", () => ({
  isTelegramUpdateLeaseCurrent: vi.fn(async (lease: unknown) => {
    h.checks.push(lease);
    return h.current;
  }),
}));

import { sendMessage } from "./api.server";
import {
  __resetTelegramOutboundEffectFenceForTests,
  installTelegramOutboundEffectFence,
} from "./outbound-effect-fence.server";
import { __resetTelegramOutboundEffectGuardForTests } from "./outbound-effect-guard";
import { runWithTelegramUpdateExecution } from "./update-execution.server";

const lease = {
  updateId: 55,
  leaseToken: "00000000-0000-4000-8000-000000000055",
  processingFence: 2,
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
};

beforeEach(() => {
  h.current = false;
  h.checks.length = 0;
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => {});
  __resetTelegramOutboundEffectGuardForTests();
  __resetTelegramOutboundEffectFenceForTests();
  installTelegramOutboundEffectFence();
});

describe("Telegram outbound effect fencing", () => {
  it("blocks a send from a stale update worker before network I/O", async () => {
    const result = await runWithTelegramUpdateExecution(
      lease.updateId,
      () => sendMessage({ chatId: 1, text: "safe test" }),
      { lease },
    );

    expect(result.value).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(h.checks).toEqual([lease]);
    expect(console.error).toHaveBeenCalledWith(
      "telegram sendMessage skipped",
      "stale_update_lease",
    );
  });

  it("allows a send only while the DB lease/fence is current", async () => {
    h.current = true;
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
    );

    const result = await runWithTelegramUpdateExecution(
      lease.updateId,
      () => sendMessage({ chatId: 1, text: "safe test" }),
      { lease },
    );

    expect(result.value).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
