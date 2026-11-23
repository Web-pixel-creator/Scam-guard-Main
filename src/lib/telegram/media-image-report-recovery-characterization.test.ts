import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx, TelegramUpdate } from "./router";
import type { Session } from "./session.server";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { SendMessageResult } from "./api.server";

// Bounded application characterization, not SQL/locking/ACL or delivery proof.
// Image/report handlers, consent adapters, image provider core and polling run
// for real. Only routing selection, Telegram I/O, scoring/session persistence,
// QR decoding and the database boundary are modeled. No real fetch is retained.
type Kind = "image" | "report_image";
interface ConsentRow {
  userId: number;
  chatId: number;
  chatType: unknown;
  kind: unknown;
  reportFlowId: unknown;
  promptId: number;
  lastUpdateId: number;
  grantedUpdateId: number | null;
  consumedUpdateId: number | null;
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
  session: null as Session | null,
  completed: new Set<number>(),
  transitions: [] as Array<{ operation: string; updateId: number; applied: boolean }>,
  nextMessageId: 1_000,
  nextSendFailure: null as SendMessageResult | null,
  loseClaimResponse: false,
  loseProviderResponse: false,
  loseCompletion: false,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: h.rpc,
    from: () => {
      throw new Error("Unexpected database access in image recovery characterization");
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
vi.mock("@/lib/risk/qr-decoder", () => ({
  decodeQrFromDataUrl: vi.fn(async () => ({ values: [], urls: [] })),
}));
vi.mock("@/lib/report.functions", () => ({ submitReport: vi.fn() }));

import { __resetAiCircuitBreakerForTests } from "@/lib/risk/check-core";
import { escapeMarkdownV2 } from "./api.server";
import { bt } from "./bot-i18n";
import { reportSkipKeyboard, REPORT_SKIP_CALLBACK } from "./report-flow";
import { handleCallback } from "./handlers/misc";
import { __resetTelegramCheckCachesForTests, handleImage } from "./handlers/check";
import { handleReportSkip, handleScenarioImage } from "./handlers/report";
import { requestMediaProviderConsent } from "./media-provider-consent.server";
import { runTelegramPollingCycleCore } from "./polling-cycle";
import { beginTelegramUpdate } from "./update-lifecycle.server";
import { executeAndCompleteTelegramUpdate } from "./webhook.server";
import { handleReportImageDeliveryRecovery } from "./report-image-delivery.server";

const FLOW_ID = "33333333-3333-4333-8333-333333333333";
const DATA_URL = "data:image/png;base64,c3ludGhldGljLWltYWdl";
const RESULT: RunCheckResult = {
  type: "text",
  display: "A caller is asking for money",
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
const EVIDENCE = {
  text: "A caller is asking for money",
  visualCategory: "chat_screenshot",
  confidence: "high",
  qr: { present: false, visibleUrl: null, purpose: "unknown" },
  riskHints: ["payment_request"],
  summary: "The message asks for a transfer",
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

function setScenario(kind: Kind, lang: Session["lang"] = "en"): void {
  h.session = {
    telegramUserId: 42,
    lang,
    scenario: kind === "report_image" ? "report_desc" : "none",
    scenarioStep: kind === "report_image" ? 1 : 0,
    scenarioData:
      kind === "report_image"
        ? { noValue: true, reportFlowId: FLOW_ID, chatScope: { chatId: 42, chatType: "private" } }
        : {},
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function context(): HandlerCtx {
  if (!h.session) throw new Error("Missing synthetic session");
  return {
    userId: 42,
    chatId: 42,
    chatType: "private",
    messageId: h.row?.promptId ?? 1_000,
    session: structuredClone(h.session),
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
      text: "synthetic image recovery fixture",
    },
  };
  return runTelegramPollingCycleCore(updateId, LEADER, {
    fetchUpdates: async () => [update],
    begin: beginTelegramUpdate,
    execute: executeAndCompleteTelegramUpdate,
  });
}

function upload(kind: Kind) {
  return kind === "image"
    ? handleImage("synthetic-image-file", context())
    : handleScenarioImage("synthetic-image-file", context());
}

async function routedReportUpload(updateId: number) {
  const router = await vi.importActual<typeof import("./router")>("./router");
  return router.dispatchUpdate(
    {
      update_id: updateId,
      message: {
        message_id: updateId,
        from: { id: 42, first_name: "Synthetic" },
        chat: { id: 42, type: "private" },
        photo: [{ file_id: "synthetic-image-file", width: 10, height: 10 }],
      },
    },
    {
      loadSession: async () => structuredClone(h.session!),
      handlers: {
        ...router.getHandlers(),
        handleScenarioImage,
        handleReportImageDeliveryRecovery,
        handleScenarioStep: async () => {
          throw new Error("Old upload reached a new report step");
        },
      },
    },
  );
}

function reachRetryTime() {
  vi.spyOn(Date, "now").mockReturnValue(h.session!.scenarioData.reportImageDelivery!.retryAt);
}

function allow(kind: Kind) {
  return handleCallback(`media_consent:${kind}`, context(), "synthetic-allow");
}

async function granted(kind: Kind, lang: Session["lang"] = "en") {
  setScenario(kind, lang);
  await cycle(100, () => requestMediaProviderConsent(context(), kind));
  await cycle(101, () => allow(kind));
  expect(h.row).toMatchObject({ kind, grantedUpdateId: 101, consumedUpdateId: null });
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
  if (name === "complete_telegram_update") {
    if (h.loseCompletion) {
      h.loseCompletion = false;
      return { data: false, error: null };
    }
    h.completed.add(updateId);
  }
  if (
    name === "complete_telegram_update" ||
    name === "mark_telegram_update_failure" ||
    name === "renew_telegram_update" ||
    name === "telegram_update_lease_current"
  ) {
    return { data: true, error: null };
  }
  const row = h.row;
  const matches = Boolean(
    row &&
    row.userId === args.p_telegram_user_id &&
    row.chatId === args.p_chat_id &&
    row.chatType === args.p_chat_type &&
    row.kind === args.p_media_kind &&
    row.reportFlowId === args.p_report_flow_id,
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
        reportFlowId: args.p_report_flow_id,
        promptId: Number(args.p_prompt_message_id),
        lastUpdateId: updateId,
        grantedUpdateId: null,
        consumedUpdateId: null,
      };
    }
  } else if (name === "grant_telegram_media_provider_consent") {
    applied = Boolean(
      row &&
      matches &&
      row.promptId === args.p_prompt_message_id &&
      row.consumedUpdateId === null &&
      (row.grantedUpdateId === null ? updateId > row.lastUpdateId : updateId === row.lastUpdateId),
    );
    if (row && applied) {
      row.grantedUpdateId ??= updateId;
      row.lastUpdateId = updateId;
    }
  } else if (name === "claim_telegram_media_provider_consent") {
    applied = Boolean(
      row &&
      matches &&
      row.grantedUpdateId !== null &&
      row.consumedUpdateId === null &&
      updateId > row.lastUpdateId,
    );
    if (row && applied) {
      row.consumedUpdateId = updateId;
      row.lastUpdateId = updateId;
    }
  } else throw new Error("Unexpected RPC in bounded image recovery characterization");
  h.transitions.push({ operation: name, updateId, applied });
  if (name === "claim_telegram_media_provider_consent" && applied && h.loseClaimResponse) {
    h.loseClaimResponse = false;
    return { data: null, error: { code: "SYNTHETIC_RESPONSE_LOSS" } };
  }
  return { data: [{ lease_valid: true, applied }], error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetTelegramCheckCachesForTests();
  __resetAiCircuitBreakerForTests();
  h.row = null;
  h.session = null;
  h.completed.clear();
  h.transitions.length = 0;
  h.nextMessageId = 1_000;
  h.nextSendFailure = null;
  h.loseClaimResponse = false;
  h.loseProviderResponse = false;
  h.loseCompletion = false;
  h.rpc.mockImplementation(activeRowRpcModel);
  h.saveSession.mockImplementation(async (_userId: number, patch: Partial<Session>) => {
    if (!h.session) throw new Error("Missing synthetic session");
    h.session = { ...h.session, ...structuredClone(patch) };
    return { ok: true };
  });
  h.runCheck.mockResolvedValue(RESULT);
  h.getFile.mockResolvedValue({ filePath: "synthetic/image.png", fileSize: 128 });
  h.download.mockResolvedValue(DATA_URL);
  h.send.mockImplementation(async () => {
    if (h.nextSendFailure) {
      const failure = h.nextSendFailure;
      h.nextSendFailure = null;
      return failure;
    }
    return { ok: true, messageId: h.nextMessageId++ };
  });
  vi.stubEnv("OPENAI_API_KEY", "synthetic-image-recovery-key");
  vi.stubEnv("OPENAI_BASE_URL", "https://image.invalid/v1");
  vi.stubEnv("OPENAI_FALLBACK_API_KEY", "synthetic-fallback-must-not-be-used");
  vi.stubEnv("OPENAI_FALLBACK_BASE_URL", "https://fallback.invalid/v1");
  h.providerFetch.mockImplementation(async () => {
    if (h.loseProviderResponse) throw new Error("Synthetic lost provider response");
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(EVIDENCE) } }] }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  });
  vi.stubGlobal("fetch", h.providerFetch);
});

afterEach(() => {
  for (const [url, options] of h.providerFetch.mock.calls) {
    expect(url).toBe("https://image.invalid/v1/chat/completions");
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
    expect(String(options.body)).toContain(DATA_URL);
  }
  expect(JSON.stringify({ session: h.session, ledger: h.row })).not.toContain(DATA_URL);
  __resetTelegramCheckCachesForTests();
  __resetAiCircuitBreakerForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(["image", "report_image"] as const)("%s recovery characterization", (kind) => {
  it("does not confuse a committed claim with a provider transfer when the claim response is lost", async () => {
    await granted(kind);
    h.loseClaimResponse = true;
    expect(await cycle(102, () => upload(kind))).toEqual({ offset: 102, retryAfterMs: 2_000 });
    expect(h.row).toMatchObject({ consumedUpdateId: 102 });
    expect(h.providerFetch).not.toHaveBeenCalled();
    expect(h.download).not.toHaveBeenCalled();

    expect(await cycle(102, () => upload(kind))).toEqual({ offset: 103, retryAfterMs: 0 });
    expect(h.providerFetch).not.toHaveBeenCalled();
    expect(h.row).toMatchObject({ grantedUpdateId: null, consumedUpdateId: null });
    expect(
      h.transitions
        .filter(({ operation }) => operation.startsWith("claim_"))
        .map(({ applied }) => applied),
    ).toEqual([true, false]);
    await cycle(103, () => allow(kind));
    await cycle(104, () => upload(kind));
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ grantedUpdateId: 103, consumedUpdateId: 104 });
  });

  it("makes no retry or fallback after a lost provider response, and requires user action before a new transfer", async () => {
    await granted(kind);
    h.loseProviderResponse = true;
    expect(await cycle(102, () => upload(kind))).toEqual({ offset: 103, retryAfterMs: 0 });
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ consumedUpdateId: 102 });
    expect(h.runCheck).not.toHaveBeenCalled();
    if (kind === "report_image") {
      expect(h.session).toMatchObject({ scenario: "report_desc", scenarioStep: 1 });
      expect(h.session?.scenarioData.description).toBeUndefined();
    }
    const sends = h.send.mock.calls.length;
    await cycle(102, () => upload(kind));
    expect(h.send).toHaveBeenCalledTimes(sends);
    expect(h.providerFetch).toHaveBeenCalledTimes(1);

    h.loseProviderResponse = false;
    await cycle(103, () => upload(kind));
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ grantedUpdateId: null, consumedUpdateId: null });
    await cycle(104, () => allow(kind));
    await cycle(105, () => upload(kind));
    expect(h.providerFetch).toHaveBeenCalledTimes(2);
    expect(h.row).toMatchObject({ grantedUpdateId: 104, consumedUpdateId: 105 });
    if (kind === "report_image") {
      expect(h.session).toMatchObject({ scenario: "report_scamType", scenarioStep: 2 });
      expect(h.session?.scenarioData.description).toContain("Screenshot:");
    } else expect(h.runCheck).toHaveBeenCalledTimes(1);
  });

  it("does not register or replay an ambiguous consent prompt", async () => {
    setScenario(kind);
    h.nextSendFailure = { ok: false, certainty: "ambiguous", retryable: false };
    expect(await cycle(100, () => upload(kind))).toEqual({ offset: 101, retryAfterMs: 0 });
    expect(h.row).toBeNull();
    expect(h.transitions.some(({ operation }) => operation.startsWith("register_"))).toBe(false);
    expect(h.providerFetch).not.toHaveBeenCalled();
    await cycle(100, () => upload(kind));
    expect(h.send).toHaveBeenCalledTimes(1);
    await cycle(101, () => upload(kind));
    await cycle(102, () => allow(kind));
    await cycle(103, () => upload(kind));
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ consumedUpdateId: 103 });
  });

  it("characterizes ambiguous result delivery without claiming that the result arrived", async () => {
    await granted(kind);
    const sendsBefore = h.send.mock.calls.length;
    h.nextSendFailure = { ok: false, certainty: "ambiguous", retryable: false };
    expect(await cycle(102, () => upload(kind))).toEqual({ offset: 103, retryAfterMs: 0 });
    expect(h.row).toMatchObject({ consumedUpdateId: 102 });
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    if (kind === "report_image") {
      // The redacted draft is saved, but summary and next question share one
      // send: uncertainty must not cause a separate follow-on question.
      expect(h.session).toMatchObject({ scenario: "report_scamType", scenarioStep: 2 });
      expect(h.session?.scenarioData.description).toContain("Screenshot:");
      expect(h.send).toHaveBeenCalledTimes(sendsBefore + 1);
      expect(h.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: escapeMarkdownV2(
            `${bt("report_image_added", "en", { summary: h.session?.scenarioData.description ?? "" })}\n\n${bt("report_ask_scam_type", "en")}`,
          ),
          keyboard: reportSkipKeyboard("en"),
        }),
      );
    } else {
      expect(h.session?.scenarioData.lastCheck).toMatchObject({ level: "unknown" });
      expect(h.send).toHaveBeenCalledTimes(sendsBefore + 1);
    }
    const sendsAfter = h.send.mock.calls.length;
    await cycle(102, () => upload(kind));
    expect(h.send).toHaveBeenCalledTimes(sendsAfter);
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
  });

  it("recovers a report 429 from its draft without repeating the consumed provider operation", async () => {
    await granted(kind);
    h.nextSendFailure = TRANSIENT;
    const first = await cycle(102, () => upload(kind));
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.row).toMatchObject({ consumedUpdateId: 102 });
    if (kind === "image") {
      expect(first).toEqual({ offset: 102, retryAfterMs: 30_000 });
      expect(h.session?.scenarioData.lastCheck).toBeUndefined();
      expect(await cycle(102, () => upload(kind))).toEqual({ offset: 103, retryAfterMs: 0 });
      expect(h.row).toMatchObject({ grantedUpdateId: null, consumedUpdateId: null });
      expect(h.runCheck).toHaveBeenCalledTimes(1);
    } else {
      expect(first).toEqual({ offset: 102, retryAfterMs: 30_000 });
      expect(h.session).toMatchObject({ scenario: "report_scamType", scenarioStep: 2 });
      const sends = h.send.mock.calls.length;
      // Real router and a fresh loaded session, not a forced handler call.
      __resetTelegramCheckCachesForTests();
      reachRetryTime();
      expect(await cycle(102, () => routedReportUpload(102))).toEqual({
        offset: 103,
        retryAfterMs: 0,
      });
      expect(h.send).toHaveBeenCalledTimes(sends + 1);
      expect(h.session?.scenarioData.reportCallbackBinding).toBeDefined();
    }
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
  });
});

describe.each(["ru", "uz", "en"] as const)("%s report image single-message handoff", (lang) => {
  it.each([
    { name: "confirmed", result: { ok: true, messageId: 2_345 } as SendMessageResult },
    { name: "success without receipt", result: { ok: true } as SendMessageResult },
    { name: "definitive 429", result: TRANSIENT },
    {
      name: "permanent rejection",
      result: {
        ok: false,
        certainty: "definitive",
        retryable: false,
        errorCode: 403,
      } as SendMessageResult,
    },
    {
      name: "ambiguous",
      result: { ok: false, certainty: "ambiguous", retryable: false } as SendMessageResult,
    },
  ])(
    "$name: one localized message, no second provider attempt or phantom binding",
    async ({ result }) => {
      await granted("report_image", lang);
      const sendsBefore = h.send.mock.calls.length;
      h.nextSendFailure = result;
      expect(await cycle(102, () => upload("report_image"))).toEqual({
        offset: result === TRANSIENT ? 102 : 103,
        retryAfterMs: result === TRANSIENT ? 30_000 : 0,
      });
      const description = h.session?.scenarioData.description ?? "";
      expect(description.length).toBeGreaterThan(5);
      expect(h.session).toMatchObject({ scenario: "report_scamType", scenarioStep: 2 });
      expect(h.send).toHaveBeenCalledTimes(sendsBefore + 1);
      const message = h.send.mock.calls.at(-1)?.[0];
      expect(message).toEqual({
        chatId: 42,
        text: escapeMarkdownV2(
          `${bt("report_image_added", lang, { summary: description })}\n\n${bt("report_ask_scam_type", lang)}`,
        ),
        keyboard: reportSkipKeyboard(lang),
      });
      expect(message.text.length).toBeLessThan(4096);
      if (result.ok && result.messageId !== undefined) {
        expect(h.session?.scenarioData.reportCallbackBinding).toMatchObject({
          messageId: result.messageId,
          action: REPORT_SKIP_CALLBACK,
          scenario: "report_scamType",
        });
      } else expect(h.session?.scenarioData.reportCallbackBinding).toBeUndefined();
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.download).toHaveBeenCalledTimes(1);
      expect(h.row).toMatchObject({ grantedUpdateId: 101, consumedUpdateId: 102 });
      expect(h.runCheck).not.toHaveBeenCalled();

      __resetTelegramCheckCachesForTests();
      if (result === TRANSIENT) reachRetryTime();
      await cycle(102, () => routedReportUpload(102));
      expect(h.send).toHaveBeenCalledTimes(sendsBefore + (result === TRANSIENT ? 2 : 1));
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.download).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["image", "report_image"] as const)(
    "repeated %s Allow leaves the modeled grant unchanged and sends no media",
    async (kind) => {
      await granted(kind, lang);
      const row = structuredClone(h.row);
      expect(await cycle(102, () => allow(kind))).toEqual({ offset: 103, retryAfterMs: 0 });
      expect(h.row).toEqual(row);
      expect(h.send).toHaveBeenLastCalledWith(
        expect.objectContaining({
          text: escapeMarkdownV2(bt("media_provider_consent_invalid", lang)),
        }),
      );
      expect(h.providerFetch).not.toHaveBeenCalled();
      expect(h.download).not.toHaveBeenCalled();
      await cycle(103, () => upload(kind));
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.row).toMatchObject({ grantedUpdateId: 101, consumedUpdateId: 103 });
    },
  );

  it("binds Skip only to the combined message and rejects a stale summary button", async () => {
    await granted("report_image", lang);
    h.nextSendFailure = { ok: true, messageId: 2_345 };
    await cycle(102, () => upload("report_image"));
    const reportBefore = structuredClone(h.session);
    const staleContext = { ...context(), messageId: 2_344 };
    await cycle(103, () => handleReportSkip(staleContext));
    expect(h.session).toEqual(reportBefore);
    expect(h.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: escapeMarkdownV2(bt("report_callback_expired", lang)),
      }),
    );
    await cycle(104, () => handleReportSkip({ ...context(), messageId: 2_345 }));
    expect(h.session).toMatchObject({ scenario: "report_city", scenarioStep: 3 });
    expect(h.session?.scenarioData.reportImageDelivery).toBeUndefined();
    expect(h.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: escapeMarkdownV2(bt("report_ask_city", lang)),
      }),
    );
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.download).toHaveBeenCalledTimes(1);
  });
});

describe("report delivery durable-update completion uncertainty", () => {
  it("a committed retry marker remains safe when both its receipt and completion are lost", async () => {
    await granted("report_image");
    h.nextSendFailure = TRANSIENT;
    h.saveSession.mockImplementation(async (_userId, patch) => {
      h.session = { ...h.session!, ...structuredClone(patch) };
      return patch.scenarioData?.reportImageDelivery?.state === "retryable"
        ? { ok: false, reason: "storage" }
        : { ok: true };
    });
    h.loseCompletion = true;
    expect(await cycle(102, () => routedReportUpload(102))).toEqual({
      offset: 102,
      retryAfterMs: 2_000,
    });
    const sends = h.send.mock.calls.length;
    reachRetryTime();
    expect(await cycle(102, () => routedReportUpload(102))).toEqual({
      offset: 103,
      retryAfterMs: 0,
    });
    expect(h.send).toHaveBeenCalledTimes(sends + 1);
    expect(h.session?.scenarioData.reportCallbackBinding).toBeDefined();
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.download).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ok: true, messageId: 777 },
    { ok: true },
    { ok: false, certainty: "ambiguous", retryable: false },
  ] as SendMessageResult[])(
    "replayed completion never sends the sealed report again %#",
    async (result) => {
      await granted("report_image");
      h.nextSendFailure = result;
      h.loseCompletion = true;
      expect(await cycle(102, () => routedReportUpload(102))).toEqual({
        offset: 102,
        retryAfterMs: 2_000,
      });
      const sends = h.send.mock.calls.length;
      expect(h.session?.scenarioData.reportImageDelivery?.state).toBe("sealed");
      __resetTelegramCheckCachesForTests();
      expect(await cycle(102, () => routedReportUpload(102))).toEqual({
        offset: 103,
        retryAfterMs: 0,
      });
      expect(h.send).toHaveBeenCalledTimes(sends);
      expect(h.providerFetch).toHaveBeenCalledTimes(1);
      expect(h.download).toHaveBeenCalledTimes(1);
    },
  );

  it("lost draft+seal receipt and lost completion do not rerun OCR or send the primary card", async () => {
    await granted("report_image");
    h.saveSession.mockImplementationOnce(async (_userId, patch) => {
      h.session = { ...h.session!, ...structuredClone(patch) };
      return { ok: false, reason: "storage" };
    });
    h.loseCompletion = true;
    expect(await cycle(102, () => routedReportUpload(102))).toEqual({
      offset: 102,
      retryAfterMs: 2_000,
    });
    expect(h.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: escapeMarkdownV2(bt("report_image_save_failed", "en")) }),
    );
    const sends = h.send.mock.calls.length;
    expect(await cycle(102, () => routedReportUpload(102))).toEqual({
      offset: 103,
      retryAfterMs: 0,
    });
    expect(h.send).toHaveBeenCalledTimes(sends);
    expect(h.providerFetch).toHaveBeenCalledTimes(1);
    expect(h.download).toHaveBeenCalledTimes(1);
  });
});
