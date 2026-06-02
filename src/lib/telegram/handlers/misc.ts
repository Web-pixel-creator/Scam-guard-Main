// Telegram callback & fallback handlers (Ishonch Guard bot) — task 8.5.
//
// Owns two of the seven router `Handlers`:
//
//   • handleCallback   — inline-button presses: language selection,
//                        Report / Check another / Emergency (R2.2, R2.3, R20.3).
//   • handleOutOfScope — empty / unsupported / out-of-scope input and unknown
//                        commands (R16.1, R16.2, R22.1–R22.3).
//
// ── callback_data contract (kept in sync with format.ts → `CB`) ─────────────
//   "lang:ru" | "lang:uz" | "lang:en"  → switch Language (welcome buttons, 8.2)
//   "report"                            → start the /report scenario
//   "check_another"                     → prompt for new content to check
//   "emergency"                         → send the emergency checklist
// These exact strings are re-used from `CB` (format.ts) so the formatter's
// buttons, the /start language buttons (task 8.2) and this handler agree.
//
// ── Decoupling (parallel tasks 8.2/8.3/8.4 + wiring in 9.1) ─────────────────
// This module owns ONLY these handlers. It does NOT import the sibling handler
// modules (commands.ts / check.ts / report.ts) and does NOT call `setHandlers`
// — composition happens later in task 9.1. To start the /report scenario from
// the «Report» button it talks to the session store directly (sets
// `scenario="report_value"`, the same initial state report.ts drives), rather
// than calling report.ts. The actual step-by-step handling lives in report.ts
// and is wired in 9.1.
//
// answerCallbackQuery note: the router's `Handlers.handleCallback(data, ctx)`
// does not thread the `callback_query.id` through (`decideRoute` keeps only
// `data`). We therefore expose an OPTIONAL third `callbackQueryId` parameter —
// structurally still assignable to the `Handlers` interface — so task 9.1 can
// pass the id (available on the raw update) and the «часики» spinner is always
// cleared. When the id is supplied we answer FIRST, before any action.
//
// Server-only: pulls in `session.server.ts` (service-role Supabase). Never
// import into the client bundle.
import {
  sendMessage,
  answerCallbackQuery,
  escapeMarkdownV2,
} from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB, formatEmergencyChecklist } from "@/lib/telegram/format";
import { parsePanicCallback, buildPanicScenarioText } from "@/lib/telegram/emergency";
import { setLanguage, saveSession } from "@/lib/telegram/session.server";
import type { HandlerCtx, OutOfScopeKind } from "@/lib/telegram/router";
import type { Lang } from "@/lib/i18n";

const LANG_PREFIX = "lang:";
const SUPPORTED_LANGS: readonly Lang[] = ["ru", "uz", "en"];

/** Parse a "lang:<code>" callback into a supported `Lang`, or `null`. */
function parseLangCallback(data: string): Lang | null {
  if (!data.startsWith(LANG_PREFIX)) return null;
  const code = data.slice(LANG_PREFIX.length);
  return (SUPPORTED_LANGS as readonly string[]).includes(code) ? (code as Lang) : null;
}

/** Send a plain bot-i18n string, MarkdownV2-escaped. */
async function sendI18n(chatId: number, key: Parameters<typeof bt>[0], lang: Lang): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(bt(key, lang)) });
}

// ---------------------------------------------------------------------------
// Callback handler
// ---------------------------------------------------------------------------

/**
 * Handle an inline-button callback.
 *
 * Always clears the Telegram loading spinner via `answerCallbackQuery` FIRST
 * (when the `callbackQueryId` is provided by task 9.1), even for unknown data,
 * then performs the action:
 *
 *   • "lang:xx"       → `setLanguage`; on success confirm + send the input
 *                       instruction in the NEW language (R1.2, R1.3, R2.2); on
 *                       failure keep the old language and log (R2.3).
 *   • "report"        → start the /report scenario in the session store
 *                       (scenario="report_value") and ask for the value (R6.1).
 *   • "check_another" → prompt the user for new content to check (R4.1).
 *   • "emergency"     → send the emergency checklist (R20.1, R20.3).
 *   • anything else   → just acknowledge (spinner cleared), no message.
 *
 * Never throws: the session/API helpers degrade to `{ ok:false }` / no-ops.
 */
export async function handleCallback(
  data: string,
  ctx: HandlerCtx,
  callbackQueryId?: string,
): Promise<void> {
  // Clear the «часики» spinner as early as possible (best-effort, R-UX).
  if (callbackQueryId !== undefined) {
    await answerCallbackQuery(callbackQueryId);
  }

  const lang = ctx.session.lang;

  // 1) Language selection — "lang:ru" | "lang:uz" | "lang:en".
  const selected = parseLangCallback(data);
  if (selected !== null) {
    const { ok } = await setLanguage(ctx.userId, selected);
    if (ok) {
      // R2.2 — confirm the switch, then R1.3 — what can be sent, in the NEW lang.
      await sendI18n(ctx.chatId, "language_changed", selected);
      await sendI18n(ctx.chatId, "input_instruction", selected);
    } else {
      // R2.3 — persistence failed: reply in the previously used language + log.
      console.error("telegram setLanguage failed; keeping previous language");
      await sendI18n(ctx.chatId, "generic_error", lang);
    }
    return;
  }

  // 2) «Сообщить» (Report) — begin the /report scenario via the session store.
  if (data === CB.report) {
    // Mirror report.ts `startReport`: initial state + fresh draft (R15.2). The
    // step-by-step flow in report.ts is wired in task 9.1.
    await saveSession(ctx.userId, {
      scenario: "report_value",
      scenarioStep: 0,
      scenarioData: {},
    });
    await sendI18n(ctx.chatId, "report_ask_value", lang);
    return;
  }

  // 3) «Проверить ещё» (Check another) — prompt for new content (R4.1).
  if (data === CB.checkAnother) {
    await sendI18n(ctx.chatId, "check_prompt", lang);
    return;
  }

  // 4) «Я уже отправил код/деньги» (Emergency) — send the checklist (R20.1/R20.3).
  if (data === CB.emergency) {
    // formatEmergencyChecklist already returns MarkdownV2-escaped text.
    await sendMessage({ chatId: ctx.chatId, text: formatEmergencyChecklist(lang) });
    return;
  }

  // 5) Panic scenario button — "panic:1" through "panic:6" (PR #16).
  const panicId = parsePanicCallback(data);
  if (panicId !== null) {
    const scenarioText = buildPanicScenarioText(panicId, lang);
    await sendMessage({ chatId: ctx.chatId, text: escapeMarkdownV2(scenarioText) });
    return;
  }

  // 6) Unknown callback data — spinner already cleared above; nothing else to do.
  // (e.g. the /report «Skip» button is routed to report.ts by task 9.1.)
}

// ---------------------------------------------------------------------------
// Out-of-scope / fallback handler
// ---------------------------------------------------------------------------

/**
 * Handle empty / unsupported / out-of-scope input and unknown commands.
 *
 *   • voice / audio / video → polite "out of scope" refusal (R22.1, R22.3).
 *   • sticker / empty       → hint about supported input types (R16.1).
 *   • unknown_command       → point the user to /help (R16.2).
 *
 * All replies are on the current Language (`ctx.session.lang`). Never throws.
 */
export async function handleOutOfScope(kind: OutOfScopeKind, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;

  switch (kind) {
    case "voice":
    case "audio":
    case "video":
      // R22.3 — voice/audio/video are out of MVP scope: decline politely and
      // suggest sending text or a screenshot instead.
      await sendI18n(ctx.chatId, "out_of_scope", lang);
      break;
    case "sticker":
    case "empty":
      // R16.1 — empty / unsupported content (sticker, geo, etc.): hint about the
      // supported input types.
      await sendI18n(ctx.chatId, "unsupported_input", lang);
      break;
    case "unknown_command":
      // R16.2 — unrecognised command: point to /help.
      await sendI18n(ctx.chatId, "unknown_command", lang);
      break;
  }
}
