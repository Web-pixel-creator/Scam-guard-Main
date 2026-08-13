// Integration tests for the Telegram /report scenario handler (`report.ts`).
//
// Task 8.9 — exercises the multi-step complaint flow end-to-end at the handler
// level (no real network / DB):
//
//     startReport → report_value → report_desc → report_scamType?
//                 → report_city? → report_amount? → submitReport
//
// What we verify:
//   - State is persisted to `telegram_sessions` ON EVERY STEP via `saveSession`
//     with the expected `scenario` / `scenarioStep` / `scenarioData` (R15.2).
//   - Invalid input (value > 500, description < 5 or > 5000, empty value) is
//     rejected and the step does NOT advance — no `saveSession` is issued
//     (R6.5, R6.6).
//   - A successful `submitReport` is called with the correct payload (value,
//     description, optional fields, lang) — i.e. the handler delegates to the
//     existing Report_Pipeline that performs the moderated `entities` upsert
//     with `moderation_status='new'` (R6.4, R9.1) instead of writing its own
//     path — and the user is told the entry is public ONLY after moderation
//     (R6.7).
//   - A failed (`{ ok:false }`) or throwing `submitReport` shows a friendly
//     retry message and resets the scenario without crashing (R6.8, R15.5).
//   - Skipping optional fields ("-" / the «Skip» button) omits them from the
//     payload.
//
// Interruption by a command mid-scenario (R15.4) is the ROUTER's responsibility
// and is covered by `router.test.ts` (task 8.8); here we only confirm the report
// steps switch state correctly and that invalid input keeps the step in place.
//
// Validates: Requirements 6.4, 6.7, 9.1, 15.2
//
// We DON'T touch report.ts or any shared module — only this test file. External
// dependencies are mocked so no real Supabase / Telegram calls happen:
//   - `@/lib/telegram/session.server` — capture `saveSession` / `resetScenario`.
//   - `@/lib/telegram/api.server`     — capture `sendMessage`; escape = identity.
//   - `@/lib/report.functions`        — `submitReport` stub (ok / fail / throw).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { ReportDraft, Session } from "@/lib/telegram/session.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { INCIDENT_ONLY_REDACTED_VALUE } from "@/lib/report-boundary";

// ---------------------------------------------------------------------------
// Hoisted capture buffers — referenced inside the (hoisted) vi.mock factories.
// ---------------------------------------------------------------------------

interface SavePatch {
  scenario?: Session["scenario"];
  scenarioStep?: number;
  scenarioData?: ReportDraft;
  lang?: Session["lang"];
}
interface SubmitArg {
  data: {
    target?: {
      type: "phone" | "telegram" | "url" | "text" | "payment" | "apk" | "unknown";
      hash: string;
      display: string;
      incidentOnly: boolean;
    };
    description?: string;
    scamType?: string;
    city?: string;
    amountLostUzs?: number;
    incidentOnly?: boolean;
    lang?: string;
  };
  rateLimitKey?: string;
}
type SubmitResult = { ok: true } | { ok: false; error?: string; retryAfterSec?: number };
type ReportTargetType = NonNullable<SubmitArg["data"]["target"]>["type"];

function expectedTarget(
  value: string,
  incidentOnly = false,
): NonNullable<SubmitArg["data"]["target"]> {
  const type: ReportTargetType = incidentOnly
    ? "text"
    : value.startsWith("@") || value.includes("t.me")
      ? "telegram"
      : value.startsWith("http")
        ? "url"
        : value.replace(/\D/g, "").length >= 7
          ? "phone"
          : "text";
  return {
    type,
    hash: `hash:${type}:${value.length}`,
    display: incidentOnly ? INCIDENT_ONLY_REDACTED_VALUE : `[${type}]`,
    incidentOnly,
  };
}

const h = vi.hoisted(() => ({
  saveCalls: [] as { userId: number; patch: SavePatch }[],
  resetCalls: [] as number[],
  sendCalls: [] as { chatId: number; text: string; keyboard?: unknown }[],
  submitCalls: [] as SubmitArg[],
  // Mutable submitReport behaviour, swapped per test.
  submitImpl: { current: (async () => ({ ok: true })) as (a: SubmitArg) => Promise<SubmitResult> },
  fileMeta: {
    current: { fileSize: 1024, filePath: "photos/file.jpg" } as {
      fileSize: number;
      filePath: string;
    } | null,
  },
  dataUrl: { current: "data:image/jpeg;base64,ZmFrZQ==" as string | null },
  imageEvidence: {
    current: null as {
      text: string | null;
      visualCategory: string;
      confidence: string;
      qr: {
        present: boolean;
        visibleUrl: string | null;
        purpose: string;
        decodedValues?: string[];
      };
      riskHints: string[];
      summary: string | null;
    } | null,
  },
  imageError: { current: null as Error | null },
  imageAnalysisCalls: [] as Array<{ dataUrl: string; lang: string; rateLimitKey: string }>,
  getFileCalls: [] as string[],
  downloadCalls: [] as string[],
  mediaAdmissionCalls: [] as Array<{
    scope: string;
    key: string;
    limit: number;
    windowMs: number;
  }>,
  mediaAdmissionResult: {
    current: { ok: true, remaining: 9, retryAfterSec: 0 } as {
      ok: boolean;
      remaining: number;
      retryAfterSec: number;
    },
  },
  nextMessageId: { current: undefined as number | undefined },
}));

// Session store — capture the persisted patches, never hit Supabase.
vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: (userId: number, patch: SavePatch) => {
    h.saveCalls.push({ userId, patch });
    return Promise.resolve({ ok: true });
  },
  resetScenario: (userId: number) => {
    h.resetCalls.push(userId);
    return Promise.resolve();
  },
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

// Bot API — capture outgoing messages; escapeMarkdownV2 is the identity so the
// sent text equals the raw bot-i18n string and is easy to match.
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    h.sendCalls.push({ chatId: opts.chatId, text: opts.text, keyboard: opts.keyboard });
    const messageId = h.nextMessageId.current;
    if (messageId !== undefined) h.nextMessageId.current = messageId + 1;
    return Promise.resolve(messageId === undefined ? { ok: true } : { ok: true, messageId });
  },
  escapeMarkdownV2: (s: string) => s,
  getFile: (fileId: string) => {
    h.getFileCalls.push(fileId);
    return Promise.resolve(h.fileMeta.current);
  },
  downloadFileAsDataUrl: (filePath: string) => {
    h.downloadCalls.push(filePath);
    return Promise.resolve(h.dataUrl.current);
  },
}));

vi.mock("@/lib/risk/check-core", () => ({
  analyzeImageCore: async (dataUrl: string, lang: string, rateLimitKey: string) => {
    h.imageAnalysisCalls.push({ dataUrl, lang, rateLimitKey });
    if (h.imageError.current) throw h.imageError.current;
    return h.imageEvidence.current;
  },
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async (scope: string, key: string, limit: number, windowMs: number) => {
    h.mediaAdmissionCalls.push({ scope, key, limit, windowMs });
    return h.mediaAdmissionResult.current;
  },
}));

// Report_Pipeline — the existing server fn. The real handler runs the moderated
// `entities` upsert (moderation_status='new', R9.1); here we stub it and assert
// the handler delegates to it with the correct payload (R6.4 / R9.3 — no bypass).
vi.mock("@/lib/report.functions", () => {
  function makeTarget(
    value: string,
    incidentOnly = false,
  ): NonNullable<SubmitArg["data"]["target"]> {
    const type: ReportTargetType = incidentOnly
      ? "text"
      : value.startsWith("@") || value.includes("t.me")
        ? "telegram"
        : value.startsWith("http")
          ? "url"
          : value.replace(/\D/g, "").length >= 7
            ? "phone"
            : "text";
    return {
      type,
      hash: `hash:${type}:${value.length}`,
      display: incidentOnly ? "__ishonch_guard_incident_only__" : `[${type}]`,
      incidentOnly,
    };
  }

  return {
    prepareReportIdentifier: (value: string) => Promise.resolve(makeTarget(value)),
    prepareIncidentOnlyReportTarget: (description: string) =>
      Promise.resolve(makeTarget(description, true)),
    submitPreparedReportCore: (data: SubmitArg["data"], rateLimitKey: string) => {
      const arg = { data, rateLimitKey };
      h.submitCalls.push(arg);
      return h.submitImpl.current(arg);
    },
    reportRateLimitKeyForTelegram: (userId: number) => `report:tg:${userId}`,
  };
});

import {
  startReport,
  handleScenarioStep,
  handleScenarioImage,
  handleReportSkip,
  handleReportNoValue,
  handleReportRetry,
  REPORT_NO_VALUE_CALLBACK,
  REPORT_RETRY_CALLBACK,
  REPORT_SKIP_CALLBACK,
} from "./report";
import { REPORT_CALLBACK_BINDING_TTL_MS } from "../report-flow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 777;
const CHAT_ID = 555;
const REPORT_CALLBACK_TEST_NOW = new Date("2026-08-13T08:00:00.000Z");

function makeCtx(session: Partial<Session> = {}): HandlerCtx {
  return {
    chatId: CHAT_ID,
    userId: USER_ID,
    session: {
      telegramUserId: USER_ID,
      lang: "ru",
      scenario: "report_value",
      scenarioStep: 0,
      scenarioData: {},
      updatedAt: new Date(0).toISOString(),
      ...session,
    },
  };
}

/** Apply a persisted patch onto the ctx session, exactly as the router would by
 *  re-loading the saved state before the next update (loadSession → ctx). */
function applyPatch(ctx: HandlerCtx, patch: SavePatch): void {
  if (patch.scenario !== undefined) ctx.session.scenario = patch.scenario;
  if (patch.scenarioStep !== undefined) ctx.session.scenarioStep = patch.scenarioStep;
  if (patch.scenarioData !== undefined) ctx.session.scenarioData = patch.scenarioData;
  if (patch.lang !== undefined) ctx.session.lang = patch.lang;
}

/** Run one scenario step, then advance the ctx session from the last saved patch
 *  (so the next step sees the persisted state, like the router does). Returns the
 *  patches saved during this step. */
async function runStep(ctx: HandlerCtx, text: string): Promise<SavePatch[]> {
  const before = h.saveCalls.length;
  await handleScenarioStep(text, ctx);
  const saved = h.saveCalls.slice(before).map((c) => c.patch);
  if (saved.length > 0) applyPatch(ctx, saved[saved.length - 1]);
  return saved;
}

/** All texts the bot sent, in order. */
function sentTexts(): string[] {
  return h.sendCalls.map((c) => c.text);
}

function sentKeyboardData(index = h.sendCalls.length - 1): string[] {
  const keyboard = h.sendCalls[index]?.keyboard as
    | Array<Array<{ callback_data?: string }>>
    | undefined;
  return keyboard?.flatMap((row) => row.map((button) => button.callback_data ?? "")) ?? [];
}

function bindReportCallback(
  ctx: HandlerCtx,
  messageId: number,
  action: "report_skip" | "report_no_value" | "report_retry",
  scenario: "report_value" | "report_scamType" | "report_city" | "report_amount",
): void {
  ctx.messageId = messageId;
  ctx.session.scenarioData = {
    ...ctx.session.scenarioData,
    reportCallbackBinding: {
      messageId,
      action,
      scenario,
      at: REPORT_CALLBACK_TEST_NOW.toISOString(),
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(REPORT_CALLBACK_TEST_NOW);
  h.saveCalls.length = 0;
  h.resetCalls.length = 0;
  h.sendCalls.length = 0;
  h.submitCalls.length = 0;
  h.submitImpl.current = async () => ({ ok: true });
  h.fileMeta.current = { fileSize: 1024, filePath: "photos/file.jpg" };
  h.dataUrl.current = "data:image/jpeg;base64,ZmFrZQ==";
  h.imageEvidence.current = null;
  h.imageError.current = null;
  h.imageAnalysisCalls.length = 0;
  h.getFileCalls.length = 0;
  h.downloadCalls.length = 0;
  h.mediaAdmissionCalls.length = 0;
  h.mediaAdmissionResult.current = { ok: true, remaining: 9, retryAfterSec: 0 };
  h.nextMessageId.current = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ===========================================================================
// R15.2 — state persisted on EVERY step with expected scenario/step/data
// ===========================================================================

describe("/report — persists telegram_sessions on every step (R15.2)", () => {
  it("saves the scenario immediately on start, before the first answer", async () => {
    const ctx = makeCtx({ scenario: "none" });
    await startReport(ctx);

    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0]).toEqual({
      userId: USER_ID,
      patch: {
        scenario: "report_value",
        scenarioStep: 0,
        scenarioData: { chatScope: { chatId: CHAT_ID, chatType: "private" } },
      },
    });
    // Asks for the value on the current language.
    expect(sentTexts()).toContain(bt("report_ask_value", "ru"));
    expect(sentKeyboardData()).toContain(REPORT_NO_VALUE_CALLBACK);
  });

  it("advances value → desc → scamType → city → amount, saving each transition", async () => {
    const ctx = makeCtx({ scenario: "none" });

    await startReport(ctx); // save #1 → report_value
    applyPatch(ctx, h.saveCalls[0].patch);

    const sValue = await runStep(ctx, "+998901234567"); // → report_desc
    const sDesc = await runStep(ctx, "Звонили из банка и просили код из СМС"); // → report_scamType
    const sScam = await runStep(ctx, "фейковый банк"); // → report_city
    const sCity = await runStep(ctx, "Ташкент"); // → report_amount
    const sAmount = await runStep(ctx, "500000"); // → submit (no save)

    // One save per step transition (start + value + desc + scamType + city).
    expect(sValue[0]).toEqual({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: {
        target: expectedTarget("+998901234567"),
        chatScope: { chatId: CHAT_ID, chatType: "private" },
      },
    });
    expect(sDesc[0]).toEqual({
      scenario: "report_scamType",
      scenarioStep: 2,
      scenarioData: {
        target: expectedTarget("+998901234567"),
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        description: "Звонили из банка и просили код из СМС",
      },
    });
    expect(sScam[0]).toEqual({
      scenario: "report_city",
      scenarioStep: 3,
      scenarioData: {
        target: expectedTarget("+998901234567"),
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        description: "Звонили из банка и просили код из СМС",
        scamType: "фейковый банк",
      },
    });
    expect(sCity[0]).toEqual({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: {
        target: expectedTarget("+998901234567"),
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        description: "Звонили из банка и просили код из СМС",
        scamType: "фейковый банк",
        city: "Ташкент",
      },
    });
    // The final (amount) step finalizes — it submits and resets, no extra save.
    expect(sAmount).toHaveLength(0);

    // Total saves: start + 4 transitions = 5.
    expect(h.saveCalls).toHaveLength(5);
  });

  it("persists only prepared target and redacted narrative fields in report drafts", async () => {
    const ctx = makeCtx({ scenario: "none" });
    await startReport(ctx);
    applyPatch(ctx, h.saveCalls[0].patch);

    const sValue = await runStep(ctx, "@FakeSupportBot");
    const firstDraft = JSON.stringify(sValue[0].scenarioData);
    expect(firstDraft).not.toContain("@FakeSupportBot");
    expect(sValue[0].scenarioData).toMatchObject({
      target: expectedTarget("@FakeSupportBot"),
    });

    const sDesc = await runStep(
      ctx,
      "Email victim@example.com, link https://evil.example/reset?token=secret, Telegram tg://resolve?domain=Secret_Handle&start=private-token, code 123456.",
    );
    const secondDraft = JSON.stringify(sDesc[0].scenarioData);
    expect(secondDraft).not.toContain("@FakeSupportBot");
    expect(secondDraft).not.toContain("victim@example.com");
    expect(secondDraft).not.toContain("https://evil.example/reset?token=secret");
    expect(secondDraft).not.toContain("Secret_Handle");
    expect(secondDraft).not.toContain("private-token");
    expect(secondDraft).not.toContain("123456");
    expect(secondDraft).toContain("[link]");
    expect(secondDraft).toContain("[telegram]");
  });
});

// ===========================================================================
// R6.4 / R6.7 / R9.1 — successful submit, correct payload, moderation note
// ===========================================================================

describe("/report — successful submit delegates to Report_Pipeline (R6.4, R9.1, R6.7)", () => {
  it("calls submitReport with the full payload and confirms 'public only after moderation'", async () => {
    const ctx = makeCtx({ scenario: "none" });
    await startReport(ctx);
    applyPatch(ctx, h.saveCalls[0].patch);

    await runStep(ctx, "@scammer_bank");
    await runStep(ctx, "Просили подтвердить последние 4 цифры карты");
    await runStep(ctx, "OTP-кража");
    await runStep(ctx, "Самарканд");
    await runStep(ctx, "1 200 000 сум");

    // R6.4 — handed the accumulated draft to the existing Report_Pipeline.
    expect(h.submitCalls).toHaveLength(1);
    expect(h.submitCalls[0].rateLimitKey).toBe(`report:tg:${USER_ID}`);
    expect(h.submitCalls[0].data).toEqual({
      target: expectedTarget("@scammer_bank"),
      description: "Просили подтвердить последние 4 цифры карты",
      scamType: "OTP-кража",
      city: "Самарканд",
      amountLostUzs: 1_200_000, // digits-only parse of "1 200 000 сум"
      lang: "ru",
    });

    // R6.7 — confirmation states the entry is public only after moderation.
    expect(sentTexts()).toContain(bt("report_confirm", "ru"));
    // R15.5 — scenario reset after the flow finished.
    expect(h.resetCalls).toEqual([USER_ID]);
  });

  it("omits optional fields from the payload when they are skipped with '-'", async () => {
    const ctx = makeCtx({ scenario: "none" });
    await startReport(ctx);
    applyPatch(ctx, h.saveCalls[0].patch);

    await runStep(ctx, "https://fake-bank.example");
    await runStep(ctx, "Сайт просит ввести логин и пароль от банка");
    await runStep(ctx, "-"); // skip scam type
    await runStep(ctx, "-"); // skip city
    await runStep(ctx, "-"); // skip amount

    expect(h.submitCalls).toHaveLength(1);
    expect(h.submitCalls[0].data).toEqual({
      target: expectedTarget("https://fake-bank.example"),
      description: "Сайт просит ввести логин и пароль от банка",
      scamType: undefined,
      city: undefined,
      amountLostUzs: undefined,
      lang: "ru",
    });
    expect(sentTexts()).toContain(bt("report_confirm", "ru"));
    expect(h.resetCalls).toEqual([USER_ID]);
  });

  it("submits a situation-only report when the user has no number or link", async () => {
    const ctx = makeCtx({ scenario: "none" });
    await startReport(ctx);
    applyPatch(ctx, h.saveCalls[0].patch);

    bindReportCallback(ctx, 301, REPORT_NO_VALUE_CALLBACK, "report_value");
    await handleReportNoValue(ctx);
    applyPatch(ctx, h.saveCalls[h.saveCalls.length - 1].patch);
    await runStep(ctx, "Пытались украсть аккаунт, просили прислать код из Telegram");
    await runStep(ctx, "-");
    await runStep(ctx, "-");
    await runStep(ctx, "-");

    expect(REPORT_NO_VALUE_CALLBACK).toBe("report_no_value");
    expect(h.submitCalls).toHaveLength(1);
    expect(h.submitCalls[0].data).toEqual({
      target: expectedTarget("Пытались украсть аккаунт, просили прислать код из Telegram", true),
      description: "Пытались украсть аккаунт, просили прислать код из Telegram",
      scamType: undefined,
      city: undefined,
      amountLostUzs: undefined,
      lang: "ru",
    });
    expect(sentTexts()).toContain(bt("report_confirm", "ru"));
    expect(h.resetCalls).toEqual([USER_ID]);
  });

  it("skips an optional step via the «Skip» inline button (handleReportSkip)", async () => {
    // Position the session at the optional scam-type step.
    const ctx = makeCtx({
      scenario: "report_scamType",
      scenarioStep: 2,
      scenarioData: { target: expectedTarget("@x"), description: "достаточно длинное описание" },
    });

    expect(REPORT_SKIP_CALLBACK).toBe("report_skip");
    bindReportCallback(ctx, 302, REPORT_SKIP_CALLBACK, "report_scamType");
    await handleReportSkip(ctx);

    // Advances to the city step without recording a scamType.
    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch).toEqual({
      scenario: "report_city",
      scenarioStep: 3,
      scenarioData: { target: expectedTarget("@x"), description: "достаточно длинное описание" },
    });
  });
});

describe("/report — callback prompt integrity", () => {
  it("binds the current no-value button to the exact prompt and accepts that callback", async () => {
    h.nextMessageId.current = 700;
    const ctx = makeCtx({ scenario: "none" });

    await startReport(ctx);

    expect(h.saveCalls).toHaveLength(2);
    const boundPatch = h.saveCalls[1].patch;
    expect(boundPatch.scenarioData?.reportCallbackBinding).toMatchObject({
      messageId: 700,
      action: REPORT_NO_VALUE_CALLBACK,
      scenario: "report_value",
    });

    applyPatch(ctx, boundPatch);
    ctx.messageId = 700;
    await handleReportNoValue(ctx);

    expect(h.saveCalls[h.saveCalls.length - 1].patch).toMatchObject({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { noValue: true },
    });
    expect(sentTexts()).not.toContain(bt("report_callback_expired", "ru"));
  });

  it("replaces the binding when an optional-step Skip prompt is delivered", async () => {
    h.nextMessageId.current = 710;
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { target: expectedTarget("@x") },
    });

    await handleScenarioStep("A sufficiently detailed report description", ctx);

    expect(h.saveCalls).toHaveLength(2);
    expect(h.saveCalls[1].patch).toMatchObject({
      scenario: "report_scamType",
      scenarioStep: 2,
      scenarioData: {
        reportCallbackBinding: {
          messageId: 710,
          action: REPORT_SKIP_CALLBACK,
          scenario: "report_scamType",
        },
      },
    });
  });

  it("binds Retry only to the newly delivered failure prompt", async () => {
    h.nextMessageId.current = 720;
    h.submitImpl.current = async () => ({ ok: false, error: "temporary" });
    const ctx = makeCtx({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: {
        target: expectedTarget("@x"),
        description: "A sufficiently detailed report description",
      },
    });

    await handleScenarioStep("-", ctx);

    expect(h.submitCalls).toHaveLength(1);
    expect(h.saveCalls).toHaveLength(2);
    expect(h.saveCalls[1].patch).toMatchObject({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: {
        reportCallbackBinding: {
          messageId: 720,
          action: REPORT_RETRY_CALLBACK,
          scenario: "report_amount",
        },
      },
    });
  });

  it("rejects an old Skip button after the flow has advanced to a newer prompt", async () => {
    const ctx = makeCtx({
      scenario: "report_city",
      scenarioStep: 3,
      scenarioData: {
        target: expectedTarget("@x"),
        description: "long enough description",
        reportCallbackBinding: {
          messageId: 802,
          action: REPORT_SKIP_CALLBACK,
          scenario: "report_city",
          at: new Date(0).toISOString(),
        },
      },
    });
    ctx.messageId = 801;

    await handleReportSkip(ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toEqual([bt("report_callback_expired", "ru")]);
  });

  it("rejects an old No value button after a newer report was started", async () => {
    const ctx = makeCtx({
      scenario: "report_value",
      scenarioStep: 0,
      scenarioData: {
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        reportCallbackBinding: {
          messageId: 902,
          action: REPORT_NO_VALUE_CALLBACK,
          scenario: "report_value",
          at: new Date(0).toISOString(),
        },
      },
    });
    ctx.messageId = 901;

    await handleReportNoValue(ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toEqual([bt("report_callback_expired", "ru")]);
  });

  it("rejects an old Retry button while a new report flow is active", async () => {
    const ctx = makeCtx({
      scenario: "report_value",
      scenarioStep: 0,
      scenarioData: {
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        reportCallbackBinding: {
          messageId: 1_002,
          action: REPORT_NO_VALUE_CALLBACK,
          scenario: "report_value",
          at: new Date(0).toISOString(),
        },
      },
    });
    ctx.messageId = 1_001;

    await handleReportRetry(ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toEqual([bt("report_callback_expired", "ru")]);
  });

  it("fails closed when Telegram does not provide the callback message id", async () => {
    const ctx = makeCtx({
      scenario: "report_scamType",
      scenarioStep: 2,
      scenarioData: {
        target: expectedTarget("@x"),
        description: "long enough description",
        reportCallbackBinding: {
          messageId: 1_100,
          action: REPORT_SKIP_CALLBACK,
          scenario: "report_scamType",
          at: new Date(0).toISOString(),
        },
      },
    });

    await handleReportSkip(ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toEqual([bt("report_callback_expired", "ru")]);
  });

  it("rejects an expired callback even when message, action, and report step still match", async () => {
    const messageId = 1_200;
    const ctx = makeCtx({
      scenario: "report_city",
      scenarioStep: 3,
      scenarioData: {
        target: expectedTarget("@x"),
        description: "long enough description",
        chatScope: { chatId: CHAT_ID, chatType: "private" },
        reportCallbackBinding: {
          messageId,
          action: REPORT_SKIP_CALLBACK,
          scenario: "report_city",
          at: new Date(
            REPORT_CALLBACK_TEST_NOW.getTime() - REPORT_CALLBACK_BINDING_TTL_MS - 1,
          ).toISOString(),
        },
      },
    });
    ctx.messageId = messageId;

    await handleReportSkip(ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toEqual([bt("report_callback_expired", "ru")]);
  });
});

// ===========================================================================
// Screenshot evidence during report description
// ===========================================================================

describe("/report — screenshot evidence in report_desc", () => {
  it("turns usable screenshot evidence into a short redacted draft description", async () => {
    h.imageEvidence.current = {
      text: null,
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: {
        present: true,
        visibleUrl: "https://evil.example/login",
        purpose: "login",
        decodedValues: ["https://evil.example/login"],
      },
      riskHints: ["otp_or_secret", "telegram_invite_or_private_link"],
      summary:
        "Пользователя просят открыть https://evil.example/login, написать @bad_actor и ввести код 123456. Телефон +998 90 123 45 67.",
    };
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { target: expectedTarget("@scammer_bank") },
    });

    await handleScenarioImage("photo-file-id", ctx);

    expect(h.mediaAdmissionCalls).toEqual([
      { scope: "check", key: "telegram-image:tg:777", limit: 10, windowMs: 60_000 },
    ]);
    expect(h.getFileCalls).toEqual(["photo-file-id"]);
    expect(h.downloadCalls).toEqual(["photos/file.jpg"]);
    expect(h.imageAnalysisCalls).toHaveLength(1);
    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch.scenario).toBe("report_scamType");
    expect(h.saveCalls[0].patch.scenarioStep).toBe(2);
    const description = h.saveCalls[0].patch.scenarioData?.description ?? "";
    expect(description).toContain("Скриншот:");
    expect(description).toContain("QR");
    expect(description).not.toContain("evil.example");
    expect(description).not.toContain("@bad_actor");
    expect(description).not.toContain("123456");
    expect(description).not.toContain("+998 90 123 45 67");
    expect(description.length).toBeLessThanOrEqual(420);
    expect(sentTexts().join("\n")).toContain("Само изображение я не сохраняю");
    expect(sentTexts()).toContain(bt("report_ask_scam_type", "ru"));
  });

  it("asks for a typed description when screenshot evidence is unreadable", async () => {
    h.imageEvidence.current = {
      text: null,
      visualCategory: "unknown",
      confidence: "low",
      qr: { present: false, visibleUrl: null, purpose: "unknown", decodedValues: [] },
      riskHints: [],
      summary: null,
    };
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { target: expectedTarget("@scammer_bank") },
    });

    await handleScenarioImage("photo-file-id", ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(sentTexts()).toContain(bt("report_image_unreadable", "ru"));
  });

  it("rejects oversized screenshot evidence without downloading it", async () => {
    h.fileMeta.current = { fileSize: 7 * 1024 * 1024, filePath: "photos/large.jpg" };
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { target: expectedTarget("@scammer_bank") },
    });

    await handleScenarioImage("photo-file-id", ctx);

    expect(h.saveCalls).toHaveLength(0);
    expect(sentTexts()).toContain(bt("image_too_large", "ru"));
  });

  it("rejects before getFile and download when the shared media budget is exhausted", async () => {
    h.mediaAdmissionResult.current = { ok: false, remaining: 0, retryAfterSec: 37 };
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { target: expectedTarget("@scammer_bank") },
    });

    await handleScenarioImage("rate-limited-photo", ctx);

    expect(h.mediaAdmissionCalls).toEqual([
      { scope: "check", key: "telegram-image:tg:777", limit: 10, windowMs: 60_000 },
    ]);
    expect(h.getFileCalls).toHaveLength(0);
    expect(h.downloadCalls).toHaveLength(0);
    expect(h.imageAnalysisCalls).toHaveLength(0);
    expect(h.saveCalls).toHaveLength(0);
    expect(sentTexts().join("\n")).toContain("37");
  });
});

// ===========================================================================
// R6.8 / R15.5 — submit failure / throw → friendly error + scenario reset
// ===========================================================================

describe("/report — submit failure handling (R6.8, R15.5)", () => {
  it("shows a retry message and keeps the draft when submitReport returns { ok:false }", async () => {
    h.submitImpl.current = async () => ({ ok: false, error: "db down" });

    const ctx = makeCtx({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: { value: "+998900000000", description: "Достаточно длинное описание" },
    });
    await handleScenarioStep("-", ctx); // skip amount → finalize

    expect(h.submitCalls).toHaveLength(1);
    expect(sentTexts()).toContain(bt("report_error", "ru"));
    expect(sentTexts()).not.toContain(bt("report_confirm", "ru"));
    expect(sentKeyboardData()).toContain(REPORT_RETRY_CALLBACK);
    expect(h.saveCalls).toEqual([
      {
        userId: USER_ID,
        patch: {
          scenario: "report_amount",
          scenarioStep: 4,
          scenarioData: {
            target: expectedTarget("+998900000000"),
            description: "Достаточно длинное описание",
          },
        },
      },
    ]);
    expect(h.resetCalls).toEqual([]);
  });

  it("never crashes and keeps the draft when submitReport throws", async () => {
    h.submitImpl.current = async () => {
      throw new Error("network boom");
    };

    const ctx = makeCtx({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: { value: "+998900000000", description: "Достаточно длинное описание" },
    });

    await expect(handleScenarioStep("-", ctx)).resolves.toBeUndefined();
    expect(h.submitCalls).toHaveLength(1);
    expect(sentTexts()).toContain(bt("report_error", "ru"));
    expect(sentKeyboardData()).toContain(REPORT_RETRY_CALLBACK);
    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch.scenario).toBe("report_amount");
    expect(JSON.stringify(h.saveCalls[0].patch.scenarioData)).not.toContain("+998900000000");
    expect(h.saveCalls[0].patch.scenarioData?.target).toEqual(expectedTarget("+998900000000"));
    expect(h.resetCalls).toEqual([]);
  });

  it("can retry a saved draft and resets after a successful retry", async () => {
    const ctx = makeCtx({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: {
        target: expectedTarget("+998900000000"),
        description: "Достаточно длинное описание",
      },
    });

    expect(REPORT_RETRY_CALLBACK).toBe("report_retry");
    bindReportCallback(ctx, 303, REPORT_RETRY_CALLBACK, "report_amount");
    await handleReportRetry(ctx);

    expect(h.submitCalls).toHaveLength(1);
    expect(h.submitCalls[0].data.target).toEqual(expectedTarget("+998900000000"));
    expect(sentTexts()).toContain(bt("report_confirm", "ru"));
    expect(h.resetCalls).toEqual([USER_ID]);
  });

  it("does not submit and resets when value/description are missing at finalize", async () => {
    // Defensive guard in finalizeReport: never call submitReport with an invalid
    // payload (it would throw on zod parse).
    const ctx = makeCtx({
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: { value: "+998900000000" }, // description missing
    });
    await handleScenarioStep("-", ctx);

    expect(h.submitCalls).toHaveLength(0);
    expect(sentTexts()).toContain(bt("report_error", "ru"));
    expect(h.resetCalls).toEqual([USER_ID]);
  });
});

// ===========================================================================
// R6.5 / R6.6 — validation rejects bad input and the step does NOT advance
// ===========================================================================

describe("/report — validation keeps the step in place (R6.5, R6.6)", () => {
  it("rejects a value longer than 500 chars without advancing (R6.6)", async () => {
    const ctx = makeCtx({ scenario: "report_value", scenarioStep: 0, scenarioData: {} });
    await handleScenarioStep("a".repeat(501), ctx);

    expect(sentTexts()).toContain(bt("report_value_too_long", "ru"));
    expect(h.saveCalls).toHaveLength(0); // not advanced
    expect(ctx.session.scenario).toBe("report_value");
  });

  it("rejects generic text as the report value without advancing", async () => {
    const ctx = makeCtx({ scenario: "report_value", scenarioStep: 0, scenarioData: {} });
    await handleScenarioStep("на мошенников", ctx);

    expect(sentTexts()).toContain(bt("report_value_invalid", "ru"));
    expect(sentKeyboardData()).toContain(REPORT_NO_VALUE_CALLBACK);
    expect(h.saveCalls).toHaveLength(0);
    expect(ctx.session.scenario).toBe("report_value");
  });

  it("treats explicit no-identifier text as a situation-only report", async () => {
    const ctx = makeCtx({ scenario: "report_value", scenarioStep: 0, scenarioData: {} });
    await handleScenarioStep("нет номера", ctx);

    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch).toEqual({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { noValue: true },
    });
    expect(sentTexts()).toContain(bt("report_ask_description", "ru"));
  });

  it("re-asks for the value (no advance) when the value is empty", async () => {
    const ctx = makeCtx({ scenario: "report_value", scenarioStep: 0, scenarioData: {} });
    await handleScenarioStep("   ", ctx);

    expect(sentTexts()).toContain(bt("report_ask_value", "ru"));
    expect(h.saveCalls).toHaveLength(0);
    expect(ctx.session.scenario).toBe("report_value");
  });

  it("rejects a description shorter than 5 chars without advancing (R6.5)", async () => {
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { value: "+998901234567" },
    });
    await handleScenarioStep("hi", ctx);

    expect(sentTexts()).toContain(bt("report_description_too_short", "ru"));
    expect(h.saveCalls).toHaveLength(0);
    expect(ctx.session.scenario).toBe("report_desc");
  });

  it("rejects a description longer than 5000 chars without advancing (R6.5)", async () => {
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { value: "+998901234567" },
    });
    await handleScenarioStep("d".repeat(5001), ctx);

    expect(sentTexts()).toContain(bt("report_description_too_long", "ru"));
    expect(h.saveCalls).toHaveLength(0);
    expect(ctx.session.scenario).toBe("report_desc");
  });

  it("accepts a description at the 5-char minimum and advances (R6.5 boundary)", async () => {
    const ctx = makeCtx({
      scenario: "report_desc",
      scenarioStep: 1,
      scenarioData: { value: "+998901234567" },
    });
    await handleScenarioStep("12345", ctx);

    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch.scenario).toBe("report_scamType");
    expect(h.saveCalls[0].patch.scenarioData).toEqual({
      target: expectedTarget("+998901234567"),
      description: "••••",
    });
  });
});
