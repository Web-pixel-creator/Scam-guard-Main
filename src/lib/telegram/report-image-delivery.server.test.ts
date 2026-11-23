import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "./router";
import type { Session } from "./session.server";
import type { SendMessageResult } from "./api.server";
import { runWithTelegramUpdateExecution } from "./update-execution.server";

const h = vi.hoisted(() => ({ send: vi.fn(), save: vi.fn(), fetch: vi.fn() }));
vi.mock("./api.server", async (original) => ({
  ...(await original<typeof import("./api.server")>()),
  sendMessage: h.send,
}));
vi.mock("./session.server", async (original) => ({
  ...(await original<typeof import("./session.server")>()),
  saveSession: h.save,
}));
import {
  prepareReportImageDelivery,
  sendSavedReportImageDelivery,
  handleReportImageDeliveryRecovery,
} from "./report-image-delivery.server";
import { decideRoute, dispatchUpdate, getHandlers } from "./router";
import { directDeliveryRetryAfterMs } from "./direct-result-delivery-error";

const NOW = Date.parse("2026-10-11T08:00:00Z");
const FLOW = "33333333-3333-4333-8333-333333333333";
const lease = {
  updateId: 102,
  leaseToken: "22222222-2222-4222-8222-222222222222",
  processingFence: 2,
  leaderToken: "11111111-1111-4111-8111-111111111111",
  leaderFence: 3,
  leaseExpiresAt: "2026-10-11T08:05:00Z",
};
const transient: SendMessageResult = {
  ok: false,
  certainty: "definitive",
  retryable: true,
  errorCode: 429,
  retryAfterSec: 30,
};
let ctx: HandlerCtx;
let stored: Session;

function execute(work: () => Promise<void>, withLease = true, id = 102) {
  return runWithTelegramUpdateExecution(id, work, withLease ? { lease } : undefined);
}
function fresh() {
  return { ...ctx, session: structuredClone(stored) };
}
async function first() {
  await execute(async () => {
    const draft = prepareReportImageDelivery(ctx, ctx.session.scenarioData);
    stored.scenarioData = structuredClone(draft); // initial draft+seal save, modeled
    await sendSavedReportImageDelivery(ctx, draft);
  });
}
async function rejected() {
  h.send.mockResolvedValueOnce(transient);
  await expect(first()).rejects.toMatchObject({ retryAfterMs: 30_000 });
  expect(stored.scenarioData.reportImageDelivery?.state).toBe("retryable");
  vi.mocked(Date.now).mockReturnValue(NOW + 30_000);
  h.send.mockClear();
  h.save.mockClear();
}
async function recover(context = fresh(), withLease = true, id = 102) {
  await execute(() => handleReportImageDeliveryRecovery(context), withLease, id);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  ctx = {
    userId: 42,
    chatId: 42,
    chatType: "private",
    session: {
      telegramUserId: 42,
      lang: "en",
      scenario: "report_scamType",
      scenarioStep: 2,
      updatedAt: new Date(NOW).toISOString(),
      scenarioData: {
        noValue: true,
        reportFlowId: FLOW,
        description: "Screenshot: a stranger asks for a transfer",
        chatScope: { chatId: 42, chatType: "private" },
      },
    },
  };
  stored = structuredClone(ctx.session);
  h.send.mockResolvedValue({ ok: true, messageId: 777 });
  h.save.mockImplementation(async (_id: number, patch: Partial<Session>) => {
    stored = { ...stored, ...structuredClone(patch) };
    return { ok: true };
  });
  h.fetch.mockImplementation(() => {
    throw new Error("Unexpected external network");
  });
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => {
  expect(h.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bounded report-image delivery recovery", () => {
  it("seals before replay, binds the confirmed receipt, and keeps a no-replay tombstone", async () => {
    await rejected();
    h.send.mockImplementationOnce(async () => {
      expect(stored.scenarioData.reportImageDelivery).toMatchObject({
        state: "sealed",
        attempts: 2,
      });
      return { ok: true, messageId: 888 };
    });
    await recover();
    expect(stored.scenarioData.reportCallbackBinding?.messageId).toBe(888);
    expect(stored.scenarioData.reportImageDelivery?.state).toBe("sealed");
    await recover();
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(
      h.save.mock.calls.every(([, , options]) => options.failureVisibility === "operator_only"),
    ).toBe(true);
  });

  it("honors retry_after above the poller sleep cap without early sends", async () => {
    h.send.mockResolvedValueOnce({ ...transient, retryAfterSec: 120 });
    await expect(first()).rejects.toMatchObject({ retryAfterMs: 60_000 });
    h.send.mockClear();
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await expect(recover()).rejects.toMatchObject({ retryAfterMs: 60_000 });
    expect(h.send).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(NOW + 120_000);
    await recover();
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("stops after three sends even if Telegram keeps returning definite 429", async () => {
    await rejected();
    h.send.mockResolvedValue(transient);
    await expect(recover()).rejects.toMatchObject({ retryAfterMs: 30_000 });
    vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
    await recover();
    await recover();
    expect(h.send).toHaveBeenCalledTimes(2);
    expect(stored.scenarioData.reportImageDelivery).toMatchObject({ attempts: 3, state: "sealed" });
  });

  it.each([600, 900, Number.MAX_SAFE_INTEGER])(
    "does not arm a delay %s outside the retry window",
    async (retryAfterSec) => {
      h.send.mockResolvedValue({ ...transient, retryAfterSec });
      await first();
      await recover();
      expect(h.send).toHaveBeenCalledTimes(1);
      expect(stored.scenarioData.reportImageDelivery?.state).toBe("sealed");
    },
  );

  it.each([
    { ok: false, certainty: "ambiguous", retryable: false },
    { ok: true },
    { ok: false, certainty: "definitive", retryable: false, errorCode: 403 },
    { ok: false, certainty: "definitive", retryable: true, errorCode: 500 },
    { ok: false, certainty: "definitive", retryable: true },
    { ok: false, certainty: "ambiguous", retryable: true, errorCode: 429 },
    { ok: true, messageId: -1 },
  ] as SendMessageResult[])("never retries or binds an unconfirmed outcome %#", async (result) => {
    await rejected();
    h.send.mockResolvedValue(result);
    await recover();
    await recover();
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(stored.scenarioData.reportCallbackBinding).toBeUndefined();
  });

  it("treats a thrown send as ambiguous without a follow-on error message", async () => {
    await rejected();
    h.send.mockRejectedValueOnce(new Error("synthetic lost response"));
    await recover();
    await recover();
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "fails closed on seal-save receipt loss, committed=%s",
    async (committed) => {
      await rejected();
      h.save.mockImplementationOnce(async (_id, patch) => {
        if (committed) stored = { ...stored, ...structuredClone(patch) };
        return { ok: false, reason: "storage" };
      });
      await recover();
      expect(h.send).not.toHaveBeenCalled();
      if (committed) {
        await recover();
        expect(h.send).not.toHaveBeenCalled();
      }
    },
  );

  it.each([false, true])(
    "does not throw retry authority on retry-state save loss, committed=%s",
    async (committed) => {
      h.send.mockResolvedValueOnce(transient);
      h.save.mockImplementationOnce(async (_id, patch) => {
        if (committed) stored = { ...stored, ...structuredClone(patch) };
        return { ok: false, reason: "storage" };
      });
      await first(); // ack, not the retry control error
      expect(h.send).toHaveBeenCalledTimes(1);
    },
  );

  it("lost post-send binding response cannot reopen the seal", async () => {
    await rejected();
    h.save
      .mockImplementationOnce(async (_id, patch) => {
        stored = { ...stored, ...structuredClone(patch) };
        return { ok: true };
      })
      .mockResolvedValueOnce({ ok: false, reason: "storage" });
    await recover();
    await recover();
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(stored.scenarioData.reportCallbackBinding).toBeUndefined();
  });

  it("stale fenced write stops before the send", async () => {
    await rejected();
    h.save.mockResolvedValueOnce({ ok: false, reason: "stale" });
    await recover();
    expect(h.send).not.toHaveBeenCalled();
  });

  const mutations: Array<[string, (c: HandlerCtx) => void]> = [
    [
      "new flow",
      (c) => {
        c.session.scenarioData.reportFlowId = "44444444-4444-4444-8444-444444444444";
      },
    ],
    [
      "changed description",
      (c) => {
        c.session.scenarioData.description = "Different redacted description";
      },
    ],
    [
      "changed language",
      (c) => {
        c.session.lang = "uz";
      },
    ],
    [
      "other chat",
      (c) => {
        c.chatId = -900;
      },
    ],
    [
      "other chat type",
      (c) => {
        c.chatType = "group";
      },
    ],
    [
      "other user",
      (c) => {
        c.userId = 43;
      },
    ],
    [
      "advanced scenario",
      (c) => {
        c.session.scenario = "report_city";
      },
    ],
    [
      "advanced step",
      (c) => {
        c.session.scenarioStep = 3;
      },
    ],
    [
      "missing scope",
      (c) => {
        delete c.session.scenarioData.chatScope;
      },
    ],
    [
      "missing description",
      (c) => {
        delete c.session.scenarioData.description;
      },
    ],
    [
      "missing marker",
      (c) => {
        delete c.session.scenarioData.reportImageDelivery;
      },
    ],
    [
      "sealed",
      (c) => {
        c.session.scenarioData.reportImageDelivery!.state = "sealed";
      },
    ],
    [
      "invalid timestamp",
      (c) => {
        c.session.scenarioData.reportImageDelivery!.createdAt = NaN;
      },
    ],
    [
      "invalid attempts",
      (c) => {
        c.session.scenarioData.reportImageDelivery!.attempts = 0;
      },
    ],
    [
      "invalid retry time",
      (c) => {
        c.session.scenarioData.reportImageDelivery!.retryAt = NOW - 1;
      },
    ],
  ];
  it.each(mutations)("denies %s without a send or mutation", async (_label, mutate) => {
    await rejected();
    const candidate = fresh();
    mutate(candidate);
    await recover(candidate);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled();
  });

  it.each([NOW - 1, NOW + 600_000, NOW + 700_000])(
    "rejects expired/backwards clock %s",
    async (now) => {
      await rejected();
      vi.mocked(Date.now).mockReturnValue(now);
      await recover();
      expect(h.send).not.toHaveBeenCalled();
    },
  );
  it("does not recover without a polling lease or for a different update", async () => {
    await rejected();
    await recover(fresh(), false);
    await recover(fresh(), true, 103);
    expect(h.send).not.toHaveBeenCalled();
  });
  it("does not add a retry marker outside a polling execution", () => {
    expect(
      prepareReportImageDelivery(ctx, ctx.session.scenarioData).reportImageDelivery,
    ).toBeUndefined();
  });

  it("routes exact-update seals before the advanced scenario, but not a new user input", async () => {
    await rejected();
    const update = {
      update_id: 102,
      message: {
        message_id: 50,
        from: { id: 42 },
        chat: { id: 42, type: "private" as const },
        photo: [{ file_id: "synthetic", width: 10, height: 10 }],
      },
    };
    expect(decideRoute(update, stored)).toEqual({ kind: "reportImageDeliveryRecovery" });
    expect(decideRoute({ ...update, update_id: 103 }, stored).kind).toBe("scenarioStep");
    await execute(() =>
      dispatchUpdate(update, {
        loadSession: async () => structuredClone(stored),
        handlers: { ...getHandlers(), handleReportImageDeliveryRecovery },
      }),
    );
    expect(h.send).toHaveBeenCalledTimes(1);
    // Fresh module-independent session snapshot still contains the seal.
    await execute(() =>
      dispatchUpdate(update, {
        loadSession: async () => structuredClone(stored),
        handlers: { ...getHandlers(), handleReportImageDeliveryRecovery },
      }),
    );
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it("uses only the sanitized control error for polling backoff", async () => {
    h.send.mockResolvedValueOnce(transient);
    let caught: unknown;
    try {
      await first();
    } catch (error) {
      caught = error;
    }
    expect(directDeliveryRetryAfterMs(caught)).toBe(30_000);
    expect(String(caught)).not.toContain(ctx.session.scenarioData.description);
  });
});
