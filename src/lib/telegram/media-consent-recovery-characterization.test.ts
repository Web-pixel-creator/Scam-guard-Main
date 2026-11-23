import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx, TelegramUpdate } from "./router";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { SendMessageOptions, SendMessageResult } from "./api.server";

// Characterization, not a new recovery policy or SQL/concurrency proof. Real
// consent adapters, Voice/callback handlers, STT, execution and polling run
// against a deliberately bounded active-row RPC model. Expiry, locking, ACLs,
// malformed responses and leader races belong to the existing SQL/lease suites.
interface ConsentRow {
  userId: number;
  chatId: number;
  chatType: unknown;
  kind: unknown;
  promptId: number;
  lastUpdateId: number;
  grantedUpdateId: number | null;
  consumedUpdateId: number | null;
  revokedUpdateId: number | null;
}

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  dispatch: vi.fn(),
  send: vi.fn(),
  getFile: vi.fn(),
  download: vi.fn(),
  saveSession: vi.fn(),
  runCheck: vi.fn(),
  providerFetch: vi.fn(),
  row: null as ConsentRow | null,
  completed: new Set<number>(),
  transitions: [] as Array<{ operation: string; updateId: number; applied: boolean }>,
  nextMessageId: 1_000,
  nextFailure: null as SendMessageResult | null,
  failPrimary: false,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: h.rpc,
    from: () => {
      throw new Error("Unexpected non-RPC database access in recovery characterization");
    },
  },
}));
vi.mock("./router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./router")>()),
  dispatchUpdate: h.dispatch,
}));
vi.mock("./handlers", () => ({ installTelegramHandlers: () => {} }));
vi.mock("./api.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api.server")>()),
  sendMessage: h.send,
  sendChatAction: vi.fn(),
  answerCallbackQuery: vi.fn(),
  getFile: h.getFile,
  downloadFileAsDataUrl: h.download,
}));
vi.mock("./session.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./session.server")>()),
  saveSession: h.saveSession,
}));
vi.mock("@/lib/risk/check-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/risk/check-core")>()),
  runCheck: h.runCheck,
}));
vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(async () => ({ ok: true, remaining: 9, retryAfterSec: 0 })),
}));
vi.mock("@/lib/report.functions", () => ({ submitReport: vi.fn() }));

import { escapeMarkdownV2 } from "./api.server";
import { bt } from "./bot-i18n";
import { formatCheckResult } from "./format";
import { handleCallback } from "./handlers/misc";
import {
  __resetTelegramCheckCachesForTests,
  __telegramCheckCacheStatsForTests,
  handleVoice,
} from "./handlers/check";
import { requestMediaProviderConsent } from "./media-provider-consent.server";
import { runTelegramPollingCycleCore } from "./polling-cycle";
import { beginTelegramUpdate } from "./update-lifecycle.server";
import { executeAndCompleteTelegramUpdate } from "./webhook.server";

const RESULT: RunCheckResult = {
  type: "text",
  display: "caller asks for SMS code",
  level: "unknown",
  score: 0,
  reasons: [],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
  phoneIntelligence: null,
  phoneReputation: null,
};
const LEADER = {
  leaseToken: "22222222-2222-4222-8222-222222222222",
  fence: 7,
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
};
const TRANSIENT: SendMessageResult = {
  ok: false,
  certainty: "definitive",
  retryable: true,
  errorCode: 429,
  retryAfterSec: 30,
};
const VOICE_META = { fileSize: 128, duration: 8, fileUniqueId: "recovery-voice" };

function context(lang: HandlerCtx["session"]["lang"] = "en"): HandlerCtx {
  return {
    userId: 42,
    chatId: 42,
    chatType: "private",
    messageId: h.row?.promptId ?? 1_000,
    session: {
      telegramUserId: 42,
      lang,
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

async function cycle(updateId: number, work: () => Promise<unknown>) {
  h.dispatch.mockImplementation(async () => {
    await work();
  });
  const update: TelegramUpdate = {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: 42, first_name: "Synthetic" },
      chat: { id: 42, type: "private" },
      text: "synthetic recovery fixture",
    },
  };
  return runTelegramPollingCycleCore(updateId, LEADER, {
    fetchUpdates: async () => [update],
    begin: beginTelegramUpdate,
    execute: executeAndCompleteTelegramUpdate,
  });
}

function allow(lang: HandlerCtx["session"]["lang"] = "en") {
  return handleCallback("media_consent:voice", context(lang), "synthetic-allow");
}

function voice(lang: HandlerCtx["session"]["lang"] = "en") {
  return handleVoice("synthetic-voice-file", context(lang), VOICE_META);
}

function consentTransitions(operation: string) {
  return h.transitions.filter((entry) => entry.operation === operation);
}

function activeRowRpcModel(name: string, args: Record<string, unknown>) {
  const updateId = Number(args.p_update_id);
  if (name === "begin_telegram_update") {
    return {
      data: [
        h.completed.has(updateId)
          ? { decision: "completed" }
          : {
              decision: "acquired",
              processing_fence: 1,
              attempt_count: 1,
              lease_expires_at: "2099-01-01T00:00:00.000Z",
            },
      ],
      error: null,
    };
  }
  if (name === "complete_telegram_update") h.completed.add(updateId);
  if (
    name === "complete_telegram_update" ||
    name === "mark_telegram_update_failure" ||
    name === "renew_telegram_update" ||
    name === "telegram_update_lease_current"
  ) {
    return { data: true, error: null };
  }

  const row = h.row;
  const matchesScope = Boolean(
    row &&
    row.userId === args.p_telegram_user_id &&
    row.chatId === args.p_chat_id &&
    row.chatType === args.p_chat_type &&
    row.kind === args.p_media_kind,
  );
  let applied = false;
  if (name === "register_telegram_media_provider_consent") {
    applied = row === null || updateId >= row.lastUpdateId;
    if (applied) {
      h.row = {
        userId: Number(args.p_telegram_user_id),
        chatId: Number(args.p_chat_id),
        chatType: args.p_chat_type,
        kind: args.p_media_kind,
        promptId: Number(args.p_prompt_message_id),
        lastUpdateId: updateId,
        grantedUpdateId: null,
        consumedUpdateId: null,
        revokedUpdateId: null,
      };
    }
  } else if (name === "grant_telegram_media_provider_consent") {
    applied = Boolean(
      row &&
      matchesScope &&
      row.promptId === args.p_prompt_message_id &&
      row.consumedUpdateId === null &&
      row.revokedUpdateId === null &&
      (row.grantedUpdateId === null ? updateId > row.lastUpdateId : updateId === row.lastUpdateId),
    );
    if (row && applied) {
      row.grantedUpdateId ??= updateId;
      row.lastUpdateId = updateId;
    }
  } else if (name === "claim_telegram_media_provider_consent") {
    applied = Boolean(
      row &&
      matchesScope &&
      row.grantedUpdateId !== null &&
      row.consumedUpdateId === null &&
      row.revokedUpdateId === null &&
      updateId > row.lastUpdateId,
    );
    if (row && applied) {
      row.consumedUpdateId = updateId;
      row.lastUpdateId = updateId;
    }
  } else if (name === "revoke_telegram_media_provider_consent") {
    applied = Boolean(
      row &&
      row.userId === args.p_telegram_user_id &&
      row.chatId === args.p_chat_id &&
      row.chatType === args.p_chat_type &&
      row.promptId === args.p_prompt_message_id &&
      row.consumedUpdateId === null &&
      (row.revokedUpdateId === null ? updateId > row.lastUpdateId : updateId === row.lastUpdateId),
    );
    if (row && applied) {
      row.revokedUpdateId ??= updateId;
      row.lastUpdateId = updateId;
    }
  } else {
    throw new Error("Unexpected RPC in bounded recovery characterization");
  }
  h.transitions.push({ operation: name, updateId, applied });
  return { data: [{ lease_valid: true, applied }], error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetTelegramCheckCachesForTests();
  h.row = null;
  h.completed.clear();
  h.transitions.length = 0;
  h.nextMessageId = 1_000;
  h.nextFailure = null;
  h.failPrimary = false;
  h.rpc.mockImplementation(activeRowRpcModel);
  h.saveSession.mockResolvedValue({ ok: true });
  h.runCheck.mockResolvedValue(RESULT);
  h.getFile.mockResolvedValue({ filePath: "synthetic/voice.oga", fileSize: 128 });
  h.download.mockResolvedValue("data:audio/ogg;base64,c3ludGhldGlj");
  h.send.mockImplementation(async (options: SendMessageOptions) => {
    if (h.nextFailure) {
      const failure = h.nextFailure;
      h.nextFailure = null;
      return failure;
    }
    if (h.failPrimary && options.text === formatCheckResult(RESULT, "en").text) return TRANSIENT;
    return { ok: true, messageId: h.nextMessageId++ };
  });
  vi.stubEnv("OPENAI_API_KEY", "synthetic-recovery-key");
  vi.stubEnv("OPENAI_BASE_URL", "https://stt.invalid/v1");
  h.providerFetch.mockImplementation(
    async () =>
      new Response(JSON.stringify({ text: "caller asks for SMS code" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", h.providerFetch);
});

afterEach(() => {
  for (const [url, options] of h.providerFetch.mock.calls) {
    expect(url).toBe("https://stt.invalid/v1/audio/transcriptions");
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
  }
  __resetTelegramCheckCachesForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("known media-consent recovery boundaries (application characterization)", () => {
  for (const lang of ["ru", "uz", "en"] as const) {
    it.each([
      { action: "media_consent:voice", messageId: "current" },
      { action: "media_consent:voice", messageId: "old" },
      { action: "media_consent:cancel", messageId: "old" },
      { action: "media_consent:voice", messageId: "missing" },
      { action: "media_consent:cancel", messageId: "missing" },
    ] as const)(
      `${lang}: rejected $action on $messageId prompt explains unchanged consent`,
      async ({ action, messageId }) => {
        await cycle(100, () => requestMediaProviderConsent(context(lang), "voice"));
        await cycle(101, () => allow(lang));
        const granted = structuredClone(h.row);
        const rejectedContext = context(lang);
        if (messageId === "old") rejectedContext.messageId = 999;
        if (messageId === "missing") rejectedContext.messageId = undefined;

        expect(
          await cycle(102, () => handleCallback(action, rejectedContext, "synthetic-rejected")),
        ).toEqual({ offset: 103, retryAfterMs: 0 });
        expect(h.row).toEqual(granted);
        expect(h.getFile).not.toHaveBeenCalled();
        expect(h.download).not.toHaveBeenCalled();
        expect(h.providerFetch).not.toHaveBeenCalled();
        expect(h.runCheck).not.toHaveBeenCalled();
        const message = h.send.mock.calls.at(-1)?.[0] as SendMessageOptions;
        expect(message.text).toBe(escapeMarkdownV2(bt("media_provider_consent_invalid", lang)));
        expect(message.keyboard).toBeUndefined();
        expect(message.text).not.toBe(
          escapeMarkdownV2(bt("media_provider_consent_cancelled", lang)),
        );
        expect(message.text).not.toBe(
          escapeMarkdownV2(bt("media_voice_provider_consent_granted", lang)),
        );

        // The wording must remain truthful: none of these rejected buttons
        // revoked the earlier grant, and a user resend can still consume it.
        expect(await cycle(103, () => voice(lang))).toEqual({ offset: 104, retryAfterMs: 0 });
        expect(h.providerFetch).toHaveBeenCalledTimes(1);
        expect(h.row).toMatchObject({
          grantedUpdateId: 101,
          consumedUpdateId: 103,
          revokedUpdateId: null,
        });
      },
    );

    it(`${lang}: a valid Cancel still confirms revocation and blocks the next provider call`, async () => {
      await cycle(100, () => requestMediaProviderConsent(context(lang), "voice"));
      await cycle(101, () => allow(lang));
      expect(await cycle(102, () => handleCallback("media_consent:cancel", context(lang)))).toEqual(
        { offset: 103, retryAfterMs: 0 },
      );
      expect(h.row).toMatchObject({ revokedUpdateId: 102, consumedUpdateId: null });
      expect(h.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: escapeMarkdownV2(bt("media_provider_consent_cancelled", lang)),
        }),
      );
      await cycle(103, () => voice(lang));
      expect(h.providerFetch).not.toHaveBeenCalled();
      expect(h.row).toMatchObject({
        grantedUpdateId: null,
        revokedUpdateId: null,
        consumedUpdateId: null,
      });
    });
  }

  it("retries the same Allow after a no-effect send, but a newer Allow leaves the active grant intact and says invalid", async () => {
    await cycle(100, () => requestMediaProviderConsent(context(), "voice"));
    h.nextFailure = TRANSIENT;
    expect(await cycle(101, allow)).toEqual({ offset: 101, retryAfterMs: 30_000 });
    const granted = structuredClone(h.row);
    expect(granted).toMatchObject({ grantedUpdateId: 101, consumedUpdateId: null });

    expect(await cycle(101, allow)).toEqual({ offset: 102, retryAfterMs: 0 });
    expect(h.row).toEqual(granted);
    expect(await cycle(102, allow)).toEqual({ offset: 103, retryAfterMs: 0 });
    expect(h.row).toEqual(granted);
    expect(h.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: escapeMarkdownV2(bt("media_provider_consent_invalid", "en")),
      }),
    );
    expect(
      consentTransitions("grant_telegram_media_provider_consent").map(({ applied }) => applied),
    ).toEqual([true, true, false]);
    expect(h.providerFetch).not.toHaveBeenCalled();

    // Positive control: the rejected newer Allow did not revoke the old grant.
    expect(await cycle(103, voice)).toEqual({ offset: 104, retryAfterMs: 0 });
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ grantedUpdateId: 101, consumedUpdateId: 103 });
  });

  it("acknowledges an ambiguous prompt without registration or replay, and permits a fresh user-initiated flow", async () => {
    h.nextFailure = { ok: false, certainty: "ambiguous", retryable: false };
    expect(await cycle(100, voice)).toEqual({ offset: 101, retryAfterMs: 0 });
    expect(h.row).toBeNull();
    expect(consentTransitions("register_telegram_media_provider_consent")).toEqual([]);
    expect(await cycle(100, voice)).toEqual({ offset: 101, retryAfterMs: 0 });
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.getFile).not.toHaveBeenCalled();
    expect(h.providerFetch).not.toHaveBeenCalled();

    expect(await cycle(101, allow)).toEqual({ offset: 102, retryAfterMs: 0 });
    expect(h.row).toBeNull();
    expect(h.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: escapeMarkdownV2(bt("media_provider_consent_invalid", "en")),
      }),
    );
    await cycle(102, voice);
    expect(h.row).toMatchObject({ grantedUpdateId: null, consumedUpdateId: null });
    await cycle(103, allow);
    await cycle(104, voice);
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ grantedUpdateId: 103, consumedUpdateId: 104 });
  });

  it.each([false, true])(
    "does not transfer twice after primary delivery fails, even with cleared process cache=%s",
    async (clearCache) => {
      await cycle(100, () => requestMediaProviderConsent(context(), "voice"));
      await cycle(101, allow);
      h.failPrimary = true;
      expect(await cycle(102, voice)).toEqual({ offset: 102, retryAfterMs: 30_000 });
      expect(h.row).toMatchObject({ grantedUpdateId: 101, consumedUpdateId: 102 });
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.runCheck).toHaveBeenCalledTimes(1);
      expect(__telegramCheckCacheStatsForTests().voiceTranscriptSize).toBe(1);
      expect(h.saveSession).toHaveBeenCalledExactlyOnceWith(42, {});
      if (clearCache) __resetTelegramCheckCachesForTests();

      h.failPrimary = false;
      expect(await cycle(102, voice)).toEqual({ offset: 103, retryAfterMs: 0 });
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.download).toHaveBeenCalledTimes(1);
      expect(h.runCheck).toHaveBeenCalledTimes(1);
      expect(h.row).toMatchObject({
        lastUpdateId: 102,
        grantedUpdateId: null,
        consumedUpdateId: null,
      });
      expect(h.send).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyboard: expect.any(Array) }),
      );
      expect(
        consentTransitions("claim_telegram_media_provider_consent").map(({ applied }) => applied),
      ).toEqual([true, false]);

      // A result is recovered only after a NEW Allow and a user resend. A
      // surviving transcript cache avoids STT; cache loss needs a new grant.
      await cycle(103, allow);
      expect(await cycle(104, voice)).toEqual({ offset: 105, retryAfterMs: 0 });
      expect(h.row).toMatchObject({ grantedUpdateId: 103, consumedUpdateId: 104 });
      expect(h.providerFetch).toHaveBeenCalledTimes(clearCache ? 2 : 1);
      expect(h.runCheck).toHaveBeenCalledTimes(2);
      expect(
        h.send.mock.calls.filter(
          ([message]) => message.text === formatCheckResult(RESULT, "en").text,
        ),
      ).toHaveLength(2);
      expect(h.saveSession).toHaveBeenLastCalledWith(
        42,
        expect.objectContaining({
          scenarioData: expect.objectContaining({
            lastCheck: expect.objectContaining({ level: "unknown" }),
          }),
        }),
        { failureVisibility: "operator_only" },
      );
    },
  );
});
