import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "./router";
import type { Session } from "./session.server";
import type { TelegramUpdateLease } from "./update-lifecycle.server";

const h = vi.hoisted(() => ({
  sends: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  nextMessageId: 77 as number | undefined,
  sendOk: true,
  sendFailure: {
    certainty: "definitive" as "definitive" | "ambiguous",
    retryable: false,
  },
  register: vi.fn(),
  grant: vi.fn(),
  revoke: vi.fn(),
  claim: vi.fn(),
  supported: true,
  leaseCurrent: vi.fn(),
}));

vi.mock("./api.server", () => ({
  escapeMarkdownV2: (value: string) => value,
  sendMessage: (options: { chatId: number; text: string; keyboard?: unknown }) => {
    h.sends.push(options);
    return Promise.resolve(
      h.sendOk
        ? h.nextMessageId === undefined
          ? { ok: true }
          : { ok: true, messageId: h.nextMessageId }
        : { ok: false, ...h.sendFailure },
    );
  },
}));

vi.mock("./media-provider-consent-store.server", () => ({
  registerMediaProviderConsent: h.register,
  grantMediaProviderConsent: h.grant,
  revokeMediaProviderConsent: h.revoke,
  claimMediaProviderConsent: h.claim,
  isMediaProviderConsentSupported: () => h.supported,
}));

vi.mock("./update-lifecycle.server", () => ({
  isTelegramUpdateLeaseCurrent: h.leaseCurrent,
}));

import {
  consumeMediaProviderConsent,
  handleMediaProviderConsentCallback,
  requestMediaProviderConsent,
  assertMediaProviderTransferAllowed,
} from "./media-provider-consent.server";
import { runWithTelegramUpdateExecution } from "./update-execution.server";

const USER_ID = 42;
const CHAT_ID = -100123;
const REPORT_FLOW_ID = "4a761fe8-d3d6-4ff4-996c-59bef651ed86";
const LEASE: TelegramUpdateLease = {
  updateId: 101,
  leaseToken: "11111111-1111-4111-8111-111111111111",
  processingFence: 3,
  leaseExpiresAt: "2026-09-04T10:02:00.000Z",
  leaderToken: "22222222-2222-4222-8222-222222222222",
  leaderFence: 7,
};

function ctx(scenario: Session["scenario"] = "none"): HandlerCtx {
  return {
    userId: USER_ID,
    chatId: CHAT_ID,
    chatType: "supergroup",
    messageId: 77,
    session: {
      telegramUserId: USER_ID,
      lang: "ru",
      scenario,
      scenarioStep: 0,
      scenarioData: scenario === "report_desc" ? { reportFlowId: REPORT_FLOW_ID } : {},
      updatedAt: new Date(0).toISOString(),
    },
  };
}

beforeEach(() => {
  h.sends.length = 0;
  h.nextMessageId = 77;
  h.sendOk = true;
  h.sendFailure = { certainty: "definitive", retryable: false };
  h.register.mockReset().mockResolvedValue("applied");
  h.grant.mockReset().mockResolvedValue("applied");
  h.revoke.mockReset().mockResolvedValue("applied");
  h.claim.mockReset().mockResolvedValue("applied");
  h.supported = true;
  h.leaseCurrent.mockReset().mockResolvedValue(true);
});

describe("database-backed media provider consent", () => {
  it("rechecks the exact live lease at the raw provider transfer boundary", async () => {
    h.leaseCurrent.mockResolvedValueOnce(false);

    await expect(
      runWithTelegramUpdateExecution(LEASE.updateId, assertMediaProviderTransferAllowed, {
        lease: LEASE,
      }),
    ).rejects.toThrow("media_provider_consent_storage");
    expect(h.leaseCurrent).toHaveBeenCalledWith(LEASE);

    h.leaseCurrent.mockResolvedValueOnce(true);
    await expect(
      runWithTelegramUpdateExecution(LEASE.updateId, assertMediaProviderTransferAllowed, {
        lease: LEASE,
      }),
    ).resolves.toMatchObject({ value: undefined });
  });

  it("registers the delivered disclosure using exact metadata only", async () => {
    expect(await requestMediaProviderConsent(ctx(), "image")).toBe(true);

    expect(h.sends[0].text).toContain("внешнему сервису");
    expect(JSON.stringify(h.sends[0].keyboard)).toContain("media_consent:image");
    expect(h.register).toHaveBeenCalledWith({
      userId: USER_ID,
      chatId: CHAT_ID,
      chatType: "supergroup",
      kind: "image",
      promptMessageId: 77,
    });
    expect(JSON.stringify(h.register.mock.calls)).not.toMatch(/fileId|data:image|transcript/u);
  });

  it("fails closed if the prompt is not delivered or registration is unavailable", async () => {
    h.sendOk = false;
    expect(await requestMediaProviderConsent(ctx(), "voice")).toBe(false);
    expect(h.register).not.toHaveBeenCalled();

    h.sendOk = true;
    h.register.mockResolvedValue("storage");
    await expect(requestMediaProviderConsent(ctx(), "voice")).rejects.toThrow(
      "media_provider_consent_storage",
    );
  });

  it("keeps a definitely-undelivered retryable prompt on the polling frontier", async () => {
    h.sendOk = false;
    h.sendFailure = { certainty: "definitive", retryable: true };

    await expect(requestMediaProviderConsent(ctx(), "image")).rejects.toThrow(
      "media_provider_consent_storage",
    );
    expect(h.register).not.toHaveBeenCalled();
  });

  it("does not render an approval keyboard outside the ordered polling frontier", async () => {
    h.supported = false;

    expect(await requestMediaProviderConsent(ctx(), "image")).toBe(false);
    expect(h.register).not.toHaveBeenCalled();
    expect(h.sends).toHaveLength(1);
    expect(h.sends[0].keyboard).toBeUndefined();
    expect(h.sends[0].text).toContain("безопасно сохранить разрешение");
  });

  it("atomically maps one successful claim to consumed and all other outcomes closed", async () => {
    expect(await consumeMediaProviderConsent(ctx(), "voice")).toBe("consumed");
    expect(h.claim).toHaveBeenCalledWith({
      userId: USER_ID,
      chatId: CHAT_ID,
      chatType: "supergroup",
      kind: "voice",
    });

    h.claim.mockResolvedValueOnce("missing");
    expect(await consumeMediaProviderConsent(ctx(), "voice")).toBe("missing");
    h.claim.mockResolvedValueOnce("storage");
    await expect(consumeMediaProviderConsent(ctx(), "voice")).rejects.toThrow(
      "media_provider_consent_storage",
    );
    h.claim.mockResolvedValueOnce("unsupported");
    expect(await consumeMediaProviderConsent(ctx(), "voice")).toBe("storage");
  });

  it("grants only the exact callback prompt and rejects replay/missing state", async () => {
    expect(
      await handleMediaProviderConsentCallback(ctx(), { action: "allow", kind: "image" }),
    ).toBe("granted");
    expect(h.grant).toHaveBeenCalledWith({
      userId: USER_ID,
      chatId: CHAT_ID,
      chatType: "supergroup",
      kind: "image",
      promptMessageId: 77,
    });
    expect(h.sends.at(-1)?.text).toContain("отправьте");

    h.grant.mockResolvedValueOnce("missing");
    expect(
      await handleMediaProviderConsentCallback(ctx(), { action: "allow", kind: "image" }),
    ).toBe("invalid");
    h.grant.mockResolvedValueOnce("storage");
    await expect(
      handleMediaProviderConsentCallback(ctx(), { action: "allow", kind: "image" }),
    ).rejects.toThrow("media_provider_consent_storage");
  });

  it("retries a granted callback when its confirmation was definitely not delivered", async () => {
    h.sendOk = false;
    h.sendFailure = { certainty: "definitive", retryable: true };

    await expect(
      handleMediaProviderConsentCallback(ctx(), { action: "allow", kind: "image" }),
    ).rejects.toThrow("media_provider_consent_storage");
    expect(h.grant).toHaveBeenCalledTimes(1);
  });

  it("keeps report-image approval bound to the active report description step", async () => {
    expect(
      await handleMediaProviderConsentCallback(ctx("none"), {
        action: "allow",
        kind: "report_image",
      }),
    ).toBe("invalid");
    expect(h.grant).not.toHaveBeenCalled();

    expect(
      await handleMediaProviderConsentCallback(ctx("report_desc"), {
        action: "allow",
        kind: "report_image",
      }),
    ).toBe("granted");
    expect(h.grant).toHaveBeenLastCalledWith(
      expect.objectContaining({ reportFlowId: REPORT_FLOW_ID }),
    );
  });

  it("revokes an exact still-visible prompt and rejects malformed message ids", async () => {
    expect(
      await handleMediaProviderConsentCallback(ctx(), {
        action: "cancel",
      }),
    ).toBe("cancelled");
    expect(h.revoke).toHaveBeenCalledWith({
      userId: USER_ID,
      chatId: CHAT_ID,
      chatType: "supergroup",
      promptMessageId: 77,
    });

    const malformed = ctx();
    malformed.messageId = undefined;
    expect(
      await handleMediaProviderConsentCallback(malformed, {
        action: "cancel",
      }),
    ).toBe("invalid");
  });

  it("retries a revoked callback when its confirmation was definitely not delivered", async () => {
    h.sendOk = false;
    h.sendFailure = { certainty: "definitive", retryable: true };

    await expect(handleMediaProviderConsentCallback(ctx(), { action: "cancel" })).rejects.toThrow(
      "media_provider_consent_storage",
    );
    expect(h.revoke).toHaveBeenCalledTimes(1);
  });
});
