import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type {
  TelegramUpdateLeaderLease,
  TelegramUpdateLease,
} from "@/lib/telegram/update-lifecycle.server";

const h = vi.hoisted(() => ({
  dispatch: vi.fn(),
  send: vi.fn(),
  register: vi.fn(),
  grant: vi.fn(),
  revoke: vi.fn(),
  failure: vi.fn(),
  complete: vi.fn(),
  fetch: vi.fn(),
}));

// The test runs the real consent -> execution/lifecycle -> polling seam. Only
// dispatch selection, Telegram I/O and the database boundary are substituted.
vi.mock("@/lib/telegram/router", () => ({
  dispatchUpdate: h.dispatch,
  telegramUpdateSchema: { safeParse: (data: unknown) => ({ success: true, data }) },
}));
vi.mock("@/lib/telegram/handlers", () => ({ installTelegramHandlers: () => {} }));
vi.mock("@/lib/telegram/session.server", () => ({ langFromTelegramCode: () => "en" }));
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: h.send,
  escapeMarkdownV2: (text: string) => text,
}));
vi.mock("@/lib/telegram/media-provider-consent-store.server", () => ({
  isMediaProviderConsentSupported: () => true,
  registerMediaProviderConsent: h.register,
  grantMediaProviderConsent: h.grant,
  revokeMediaProviderConsent: h.revoke,
  claimMediaProviderConsent: vi.fn(),
}));
vi.mock("@/lib/telegram/update-lifecycle.server", () => ({
  beginTelegramUpdate: vi.fn(),
  renewTelegramUpdateLease: vi.fn().mockResolvedValue(true),
  isTelegramUpdateLeaseCurrent: vi.fn().mockResolvedValue(true),
  completeTelegramUpdate: h.complete,
  markTelegramUpdateFailure: h.failure,
}));

import {
  handleMediaProviderConsentCallback,
  requestMediaProviderConsent,
} from "@/lib/telegram/media-provider-consent.server";
import { executeAndCompleteTelegramUpdate } from "@/lib/telegram/webhook.server";
import { runTelegramPollingCycleCore } from "@/lib/telegram/polling-cycle";
import { TelegramDirectResultDeliveryError } from "@/lib/telegram/direct-result-delivery-error";

const LEADER: TelegramUpdateLeaderLease = {
  leaseToken: "22222222-2222-4222-8222-222222222222",
  fence: 1,
  leaseExpiresAt: "2099-01-01T00:00:00Z",
};
const LEASE: TelegramUpdateLease = {
  updateId: 501,
  leaseToken: "11111111-1111-4111-8111-111111111111",
  processingFence: 1,
  leaseExpiresAt: "2099-01-01T00:00:00Z",
  leaderToken: LEADER.leaseToken,
  leaderFence: LEADER.fence,
};
const CTX: HandlerCtx = {
  userId: 42,
  chatId: 42,
  chatType: "private",
  messageId: 90,
  session: {
    telegramUserId: 42,
    lang: "en",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2099-01-01T00:00:00Z",
  },
};
const OPERATIONS = ["prompt", "grant_confirmation", "cancel_confirmation"] as const;
type Operation = (typeof OPERATIONS)[number];

function selectOperation(operation: Operation): void {
  h.dispatch.mockImplementation(async () => {
    if (operation === "prompt") await requestMediaProviderConsent(CTX, "image");
    else {
      await handleMediaProviderConsentCallback(
        CTX,
        operation === "grant_confirmation"
          ? { action: "allow", kind: "image" }
          : { action: "cancel" },
      );
    }
  });
}

async function cycle() {
  return runTelegramPollingCycleCore(501, LEADER, {
    fetchUpdates: async () => [{ update_id: 501, message: { from: { id: 42 } } }],
    begin: async () => ({ decision: "acquired", lease: LEASE, attemptCount: 1 }),
    execute: executeAndCompleteTelegramUpdate,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.send.mockResolvedValue({ ok: true, messageId: 90 });
  h.register.mockResolvedValue("applied");
  h.grant.mockResolvedValue("applied");
  h.revoke.mockResolvedValue("applied");
  h.complete.mockResolvedValue(true);
  h.failure.mockResolvedValue(undefined);
  h.fetch.mockImplementation(async () => {
    throw new Error("Unexpected network request in consent delivery test");
  });
  vi.stubGlobal("fetch", h.fetch);
});

afterEach(() => {
  expect(h.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("consent delivery preserves polling flood waits", () => {
  for (const operation of OPERATIONS) {
    describe(operation, () => {
      it.each([
        { seconds: 30, expected: 30_000 },
        { seconds: 60, expected: 60_000 },
        { seconds: 1, expected: 1_000 },
        { seconds: 61, expected: 60_000 },
        { seconds: Number.MAX_SAFE_INTEGER, expected: 60_000 },
        { seconds: undefined, expected: 2_000 },
        { seconds: null, expected: 2_000 },
        { seconds: "30", expected: 2_000 },
        { seconds: 0, expected: 2_000 },
        { seconds: -1, expected: 2_000 },
        { seconds: 0.5, expected: 2_000 },
        { seconds: Number.NaN, expected: 2_000 },
        { seconds: Number.POSITIVE_INFINITY, expected: 2_000 },
        { seconds: Number.MAX_SAFE_INTEGER + 1, expected: 2_000 },
      ])("retains a bounded delay for retry_after=$seconds", async ({ seconds, expected }) => {
        selectOperation(operation);
        h.send.mockResolvedValue({
          ok: false,
          certainty: "definitive",
          retryable: true,
          errorCode: 429,
          retryAfterSec: seconds,
        });
        expect(await cycle()).toEqual({ offset: 501, retryAfterMs: expected });
        expect(h.send).toHaveBeenCalledTimes(1);
        expect(h.failure).toHaveBeenCalledExactlyOnceWith(LEASE, "dispatch");
        expect(h.complete).not.toHaveBeenCalled();
        if (operation === "prompt") expect(h.register).not.toHaveBeenCalled();
      });

      it.each([false, true])(
        "does not replay ambiguous delivery (retryable=%s)",
        async (retryable) => {
          selectOperation(operation);
          h.send.mockResolvedValue({
            ok: false,
            certainty: "ambiguous",
            retryable,
            retryAfterSec: 30,
          });
          expect(await cycle()).toEqual({ offset: 502, retryAfterMs: 0 });
          expect(h.failure).not.toHaveBeenCalled();
          expect(h.complete).toHaveBeenCalledExactlyOnceWith(LEASE);
          expect(h.send).toHaveBeenCalledTimes(1);
          if (operation === "prompt") expect(h.register).not.toHaveBeenCalled();
        },
      );

      it("drains permanent no-effect rejection without retry", async () => {
        selectOperation(operation);
        h.send.mockResolvedValue({
          ok: false,
          certainty: "definitive",
          retryable: false,
          errorCode: 403,
        });
        expect(await cycle()).toEqual({ offset: 502, retryAfterMs: 0 });
        expect(h.failure).not.toHaveBeenCalled();
        expect(h.complete).toHaveBeenCalledExactlyOnceWith(LEASE);
      });

      it("keeps consent storage failure separate and retryable", async () => {
        selectOperation(operation);
        const rpc =
          operation === "prompt"
            ? h.register
            : operation === "grant_confirmation"
              ? h.grant
              : h.revoke;
        rpc.mockResolvedValueOnce("storage");
        expect(await cycle()).toEqual({ offset: 501, retryAfterMs: 2_000 });
        expect(h.failure).toHaveBeenCalledExactlyOnceWith(LEASE, "dispatch");
        expect(h.complete).not.toHaveBeenCalled();
        expect(h.send).toHaveBeenCalledTimes(operation === "prompt" ? 1 : 0);
      });
    });
  }

  it("positive control: existing direct-delivery errors retain the same delay", async () => {
    h.dispatch.mockImplementation(async () => {
      throw new TelegramDirectResultDeliveryError(30_000);
    });
    expect(await cycle()).toEqual({ offset: 501, retryAfterMs: 30_000 });
  });
});
