// Telegram /report scenario handler (Ishonch Guard bot).
//
// Implements the multi-step complaint flow (R6.1–R6.8, R9.1–R9.3, R15.2/R15.5):
//
//     report_value → report_desc → report_scamType? → report_city? → report_amount?
//                                   └─ optional, skippable ───────────────────┘
//                                                                  └→ submitReport
//
// State machine is driven by `session.scenario` (one of the `report_*` states)
// and persisted to `telegram_sessions` via the session store ON EVERY STEP, so
// progress survives worker restarts (R15.2). When the flow finishes the scenario
// is reset to a neutral state (R15.5).
//
// Validation (R6.5, R6.6):
//   • value       — non-empty, ≤ 500 characters
//   • description — 5 .. 5000 characters
// Optional fields (scam type / city / amount) can be skipped by sending "-" or
// tapping the inline «Skip» button (callback → `REPORT_SKIP_CALLBACK`).
//
// On success the user is told the entry becomes public ONLY after moderation
// (R6.7); on a `submitReport` failure a friendly retry message is shown (R6.8)
// and nothing throws.
//
// ── Decoupling (parallel tasks 8.2/8.3/8.5/9.1) ─────────────────────────────
// This module owns ONLY the /report flow. It does NOT import the other handler
// modules, does NOT touch the router/format/session/api modules (only reads
// their exports), and does NOT call `setHandlers`. The functions it needs to
// expose for later wiring — `startReport`, `handleScenarioStep`,
// `handleReportSkip` and `REPORT_SKIP_CALLBACK` — are exported here and wired in
// task 9.1.
//
// Server-only: pulls in `session.server.ts` (service-role Supabase) and
// `report.functions.ts` (server fn). Never import into the client bundle.
import { sendMessage, escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import { saveSession, resetScenario, type ReportDraft } from "@/lib/telegram/session.server";
import type { HandlerCtx } from "@/lib/telegram/router";
import { submitReportCore, reportRateLimitKeyForTelegram } from "@/lib/report.functions";
import type { Lang } from "@/lib/i18n";
import {
  REPORT_NO_VALUE_CALLBACK,
  REPORT_RETRY_CALLBACK,
  REPORT_SKIP_CALLBACK,
  reportRetryKeyboard,
  reportSkipKeyboard,
  reportValueKeyboard,
} from "@/lib/telegram/report-flow";

// ── Limits (mirror reportSchema in report.functions.ts) ─────────────────────
const VALUE_MAX = 500; // R6.6
const DESC_MIN = 5; // R6.5
const DESC_MAX = 5000; // R6.5
const OPTIONAL_FIELD_MAX = 80; // scamType / city column bound (reportSchema)
const AMOUNT_MAX = 10_000_000_000; // amountLostUzs bound (reportSchema)

export { REPORT_NO_VALUE_CALLBACK, REPORT_RETRY_CALLBACK, REPORT_SKIP_CALLBACK };

// ---------------------------------------------------------------------------
// Small send helpers
// ---------------------------------------------------------------------------

/** Send a plain bot-i18n string, MarkdownV2-escaped, with an optional keyboard. */
async function sendText(
  ctx: HandlerCtx,
  key: BotStringKey,
  lang: Lang,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt(key, lang)),
    keyboard,
  });
}

/** A textual skip: "-", "—" or an empty/whitespace-only message. */
function isSkip(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "" || trimmed === "-" || trimmed === "—";
}

function isNoValueInput(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}"']/g, "")
    .replace(/\s+/g, " ");

  return [
    "нет",
    "нету",
    "нет номера",
    "нет ссылки",
    "нет номера и ссылки",
    "нет номера/ссылки",
    "не знаю",
    "неизвестно",
    "без номера",
    "без ссылки",
    "no",
    "none",
    "unknown",
    "no number",
    "no link",
    "yoq",
    "yo'q",
    "raqam yoq",
    "raqam yo'q",
    "havola yoq",
    "havola yo'q",
  ].includes(normalized);
}

function looksLikeReportIdentifier(value: string): boolean {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (/^@[a-z0-9_]{3,32}$/i.test(trimmed)) return true;
  if (/^(?=.*[_0-9])[a-z0-9_]{5,32}$/i.test(trimmed)) return true;
  if (/(?:^|\b)(?:https?:\/\/)?(?:t\.me|telegram\.me)\/[a-z0-9_]{3,32}(?:\b|\/|\?)/i.test(lower)) {
    return true;
  }
  if (/^(?:https?:\/\/|www\.)[^\s]+\.[a-z]{2,24}(?:[/?#].*)?$/i.test(lower)) return true;
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{2,5})?(?:[/?#].*)?$/i.test(lower)) return true;

  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

// ---------------------------------------------------------------------------
// Step prompts
// ---------------------------------------------------------------------------

async function askValue(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_value", lang, reportValueKeyboard(lang));
}

async function askDescription(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_description", lang);
}

async function askScamType(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_scam_type", lang, reportSkipKeyboard(lang));
}

async function askCity(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_city", lang, reportSkipKeyboard(lang));
}

async function askAmount(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_amount", lang, reportSkipKeyboard(lang));
}

// ---------------------------------------------------------------------------
// Scenario entry point — called by /report command (8.2), the «Report» button
// (8.5) and after a check result (9.1). Saves the scenario state IMMEDIATELY,
// before the first user answer (R15.2).
// ---------------------------------------------------------------------------

/**
 * Start the /report scenario: persist `scenario="report_value"` and ask for the
 * value to report. A fresh draft replaces any previous one.
 */
export async function startReport(ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  await saveSession(ctx.userId, {
    scenario: "report_value",
    scenarioStep: 0,
    scenarioData: {},
  });
  await askValue(ctx, lang);
}

// ---------------------------------------------------------------------------
// Individual steps
// ---------------------------------------------------------------------------

async function stepValue(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const value = text.trim();

  if (value.length === 0) {
    // Empty value — re-ask (no state change).
    await askValue(ctx, lang);
    return;
  }
  if (value.length > VALUE_MAX) {
    // R6.6 — too long: reject and stay on this step.
    await sendText(ctx, "report_value_too_long", lang);
    return;
  }
  if (isNoValueInput(value)) {
    await advanceWithoutIdentifier(ctx);
    return;
  }
  if (!looksLikeReportIdentifier(value)) {
    await sendText(ctx, "report_value_invalid", lang, reportValueKeyboard(lang));
    return;
  }

  const draft: ReportDraft = { ...ctx.session.scenarioData, value };
  await saveSession(ctx.userId, {
    scenario: "report_desc",
    scenarioStep: 1,
    scenarioData: draft,
  });
  await askDescription(ctx, lang);
}

async function advanceWithoutIdentifier(ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft: ReportDraft = { ...ctx.session.scenarioData, noValue: true };
  delete draft.value;
  await saveSession(ctx.userId, {
    scenario: "report_desc",
    scenarioStep: 1,
    scenarioData: draft,
  });
  await askDescription({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang);
}

async function stepDescription(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const description = text.trim();

  if (description.length < DESC_MIN) {
    // R6.5 — too short: reject and stay on this step.
    await sendText(ctx, "report_description_too_short", lang);
    return;
  }
  if (description.length > DESC_MAX) {
    // R6.5 — too long: reject and stay on this step.
    await sendText(ctx, "report_description_too_long", lang);
    return;
  }

  const draft: ReportDraft = { ...ctx.session.scenarioData, description };
  await saveSession(ctx.userId, {
    scenario: "report_scamType",
    scenarioStep: 2,
    scenarioData: draft,
  });
  await askScamType(ctx, lang);
}

async function stepScamType(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft: ReportDraft = { ...ctx.session.scenarioData };
  if (!isSkip(text)) {
    draft.scamType = text.trim().slice(0, OPTIONAL_FIELD_MAX);
  }
  await saveSession(ctx.userId, {
    scenario: "report_city",
    scenarioStep: 3,
    scenarioData: draft,
  });
  await askCity({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang);
}

async function stepCity(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft: ReportDraft = { ...ctx.session.scenarioData };
  if (!isSkip(text)) {
    draft.city = text.trim().slice(0, OPTIONAL_FIELD_MAX);
  }
  await saveSession(ctx.userId, {
    scenario: "report_amount",
    scenarioStep: 4,
    scenarioData: draft,
  });
  await askAmount({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang);
}

async function stepAmount(text: string, ctx: HandlerCtx): Promise<void> {
  const draft: ReportDraft = { ...ctx.session.scenarioData };
  if (!isSkip(text)) {
    const digits = text.replace(/\D/g, "");
    if (digits.length > 0) {
      const amount = Number(digits);
      if (Number.isFinite(amount) && amount > 0) {
        draft.amountLostUzs = Math.min(amount, AMOUNT_MAX);
      }
    }
  }
  await finalizeReport(ctx, draft);
}

// ---------------------------------------------------------------------------
// Finalisation — hand the accumulated draft to the Report_Pipeline (R6.4).
// ---------------------------------------------------------------------------

async function finalizeReport(ctx: HandlerCtx, draft: ReportDraft): Promise<void> {
  const lang = ctx.session.lang;

  // Guard: value + description are guaranteed present by the flow, but never
  // call submitReport with an invalid payload (it would throw on zod parse).
  if ((!draft.value && !draft.noValue) || !draft.description) {
    await sendText(ctx, "report_error", lang);
    await resetScenario(ctx.userId);
    return;
  }
  const reportValue = draft.noValue
    ? draft.description.slice(0, VALUE_MAX)
    : (draft.value as string);

  async function keepDraftForRetry(): Promise<void> {
    await saveSession(ctx.userId, {
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: draft,
    });
  }

  try {
    const result = await submitReportCore(
      {
        value: reportValue,
        type: draft.noValue ? "text" : undefined,
        description: draft.description,
        scamType: draft.scamType,
        city: draft.city,
        amountLostUzs: draft.amountLostUzs,
        lang,
      },
      reportRateLimitKeyForTelegram(ctx.userId),
    );

    if (!result.ok && result.error === "rate_limited") {
      await keepDraftForRetry();
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(bt("rate_limited", lang, { seconds: result.retryAfterSec ?? 60 })),
        keyboard: reportRetryKeyboard(lang),
      });
      return;
    }

    if (result.ok) {
      // R6.7 — confirm receipt + "public only after moderation".
      await sendText(ctx, "report_confirm", lang);
      await resetScenario(ctx.userId);
    } else {
      // R6.8 — pipeline reported failure: friendly retry message.
      await keepDraftForRetry();
      await sendText(ctx, "report_error", lang, reportRetryKeyboard(lang));
    }
  } catch (e) {
    // R6.8 — never crash; log without Sensitive_Data (R19.2).
    console.error("telegram submitReport failed", e instanceof Error ? e.message : "unknown");
    await keepDraftForRetry();
    await sendText(ctx, "report_error", lang, reportRetryKeyboard(lang));
  }
}

// ---------------------------------------------------------------------------
// Public handlers (wired by tasks 8.5 / 9.1)
// ---------------------------------------------------------------------------

/**
 * Handle one step of the active /report scenario. Routed here by the router
 * whenever `session.scenario` is a `report_*` state (R15.3). Non-report
 * scenarios are ignored — the composed handler in task 9.1 dispatches those to
 * the appropriate module.
 */
export async function handleScenarioStep(text: string, ctx: HandlerCtx): Promise<void> {
  switch (ctx.session.scenario) {
    case "report_value":
      await stepValue(text, ctx);
      break;
    case "report_desc":
      await stepDescription(text, ctx);
      break;
    case "report_scamType":
      await stepScamType(text, ctx);
      break;
    case "report_city":
      await stepCity(text, ctx);
      break;
    case "report_amount":
      await stepAmount(text, ctx);
      break;
    default:
      // Not a /report scenario — handled elsewhere (await_check etc.).
      break;
  }
}

/**
 * Handle the «Skip» inline button on an optional step. Equivalent to sending a
 * textual skip ("-") for the current step. Routed here from `handleCallback`
 * (task 8.5 / 9.1) when `callback_data === REPORT_SKIP_CALLBACK`.
 */
export async function handleReportSkip(ctx: HandlerCtx): Promise<void> {
  switch (ctx.session.scenario) {
    case "report_scamType":
      await stepScamType("-", ctx);
      break;
    case "report_city":
      await stepCity("-", ctx);
      break;
    case "report_amount":
      await stepAmount("-", ctx);
      break;
    default:
      // Skip pressed outside an optional step — ignore.
      break;
  }
}

export async function handleReportNoValue(ctx: HandlerCtx): Promise<void> {
  if (ctx.session.scenario !== "report_value") return;
  await advanceWithoutIdentifier(ctx);
}

export async function handleReportRetry(ctx: HandlerCtx): Promise<void> {
  if (!ctx.session.scenario.startsWith("report_")) return;
  await finalizeReport(ctx, { ...ctx.session.scenarioData });
}
