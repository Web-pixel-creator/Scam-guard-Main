// Telegram command handlers (Ishonch Guard bot) — task 8.2.
//
// Implements the command side of the `Handlers` contract from `router.ts`:
// a single `handleCommand(cmd, ctx)` that dispatches each bot command to the
// right localized response. All user-facing text is rendered on the CURRENT
// session language (`ctx.session.lang`, default "ru" — R1.4).
//
// Owned commands (fully implemented here):
//   /start     → welcome + inline language buttons        (R1.1, R1.3*, R1.5, R20… n/a)
//   /lang      → show language selection buttons           (R2.1, R2.5)
//   /help      → command list                              (R3.1)
//   /safety    → basic safety rules + scope reminder       (R3.2, R3.3)
//   /emergency → numbered emergency checklist              (R20.1, R20.2, R20.5)
//
// Command-initiated scenarios (started here via SESSION STATE only — the actual
// content/step processing lives in sibling tasks 8.3 `check` / 8.4 `report`,
// which this module deliberately does NOT import to keep parallel work safe):
//   /check     → set scenario "await_check", prompt for content   (R4.1, R4.8, R15.2)
//   /report    → set scenario "report_value", prompt for value    (R6.1, R15.2)
//
// callback_data for the language buttons (consumed by the callback handler,
// task 8.5) comes from the shared `CB.lang(...)` contract in `format.ts`:
//   "lang:ru" | "lang:uz" | "lang:en"
// so the welcome buttons here and the result buttons in `format.ts` stay in
// sync and 8.5 has a single source of truth to switch on.
//
// Server-only: pulls in `session.server.ts` (service-role Supabase) and
// `api.server.ts` (bot token) at runtime. Never import into the client bundle.

import {
  CB,
  formatEmergencyChecklist,
  formatHelp,
  formatSafety,
  formatWelcome,
} from "@/lib/telegram/format";
import {
  buildPanicMenuText,
  PANIC_MENU_TITLES,
  PANIC_CB_PREFIX,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { saveSession } from "@/lib/telegram/session.server";
import type { HandlerCtx, ParsedCommand } from "@/lib/telegram/router";
import type { Lang } from "@/lib/i18n";

/**
 * Language selection keyboard (R2.1). Mirrors the welcome keyboard built by
 * `formatWelcome`, reusing the same `CB.lang(...)` callback_data so task 8.5
 * handles a single set of values. Button labels keep each language's own name
 * in every locale (see `btn_lang_*` in bot-i18n).
 */
function languageKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_lang_ru", lang), callback_data: CB.lang("ru") },
      { text: bt("btn_lang_uz", lang), callback_data: CB.lang("uz") },
      { text: bt("btn_lang_en", lang), callback_data: CB.lang("en") },
    ],
  ];
}

/**
 * `/check` entry point. We do NOT run the Check_Pipeline here (that is task
 * 8.3); instead we mark the session as awaiting content and prompt the user.
 * The scenario is persisted IMMEDIATELY, before the user's next message, as
 * required by R15.2. The follow-up message is routed to the check flow by the
 * router (active scenario → step handling, tasks 8.3/8.4).
 */
async function startCheckScenario(ctx: HandlerCtx): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: "await_check",
    scenarioStep: 0,
    scenarioData: {},
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("check_prompt", ctx.session.lang)),
  });
}

/**
 * `/report` entry point (R6.1). Starts the multi-step report scenario by
 * asking for the value first; the subsequent steps (description, optional
 * fields, submit) are handled by task 8.4's `handleScenarioStep`. The scenario
 * state is saved immediately (R15.2) so the next message is interpreted as the
 * answer to the value step (R15.3).
 */
async function startReportScenario(ctx: HandlerCtx): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: "report_value",
    scenarioStep: 0,
    scenarioData: {},
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("report_ask_value", ctx.session.lang)),
  });
}

/**
 * Show the panic/emergency scenario selection menu (inline buttons).
 * User picks their situation → bot replies with specific steps + verified numbers.
 */
async function showPanicMenu(ctx: HandlerCtx): Promise<void> {
  const { lang } = ctx.session;
  const ids: PanicScenarioId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  // Two buttons per row for readability.
  const keyboard: InlineKeyboard = [];
  for (let i = 0; i < ids.length; i += 2) {
    const row: { text: string; callback_data: string }[] = [];
    row.push({
      text: PANIC_MENU_TITLES[ids[i]][lang],
      callback_data: `${PANIC_CB_PREFIX}${ids[i]}`,
    });
    if (ids[i + 1]) {
      row.push({
        text: PANIC_MENU_TITLES[ids[i + 1]][lang],
        callback_data: `${PANIC_CB_PREFIX}${ids[i + 1]}`,
      });
    }
    keyboard.push(row);
  }
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildPanicMenuText(lang)),
    keyboard,
  });
}

/**
 * Dispatch a parsed bot command to its handler, replying on the current
 * session language. Matches the `Handlers["handleCommand"]` signature so task
 * 9.1 can register it directly. The switch is exhaustive over `BotCommand`.
 */
export async function handleCommand(cmd: ParsedCommand, ctx: HandlerCtx): Promise<void> {
  const { lang } = ctx.session;

  switch (cmd.command) {
    case "/start": {
      // Greeting + language buttons (R1.1, R1.5). Text is already escaped.
      const { text, keyboard } = formatWelcome(lang);
      await sendMessage({ chatId: ctx.chatId, text, keyboard });
      return;
    }

    case "/lang": {
      // Show language selection buttons (R2.1).
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(bt("choose_language", lang)),
        keyboard: languageKeyboard(lang),
      });
      return;
    }

    case "/help":
      await sendMessage({ chatId: ctx.chatId, text: formatHelp(lang) });
      return;

    case "/safety":
      await sendMessage({ chatId: ctx.chatId, text: formatSafety(lang) });
      return;

    case "/emergency":
    case "/panic":
      await showPanicMenu(ctx);
      return;

    case "/check":
      await startCheckScenario(ctx);
      return;

    case "/report":
      await startReportScenario(ctx);
      return;
  }
}
