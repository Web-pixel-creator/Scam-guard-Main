// Telegram command handlers (Ishonch Guard bot) — task 8.2.
//
// Implements the command side of the `Handlers` contract from `router.ts`:
// a single `handleCommand(cmd, ctx)` that dispatches each bot command to the
// right localized response. All user-facing text is rendered on the CURRENT
// session language (`ctx.session.lang`, default "ru" — R1.4).
//
// Owned commands (fully implemented here):
//   /start     → main menu with quick-action buttons      (R1.1, R1.3*, R1.5, R20… n/a)
//   /menu      → same main menu as /start
//   /lang      → show language selection buttons           (R2.1, R2.5)
//   /help      → command list                              (R3.1)
//   /call      → live-call copilot direct entry
//   /appeal    → public correction form for reputation labels
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
import { formatWeeklyScamDigest } from "@/lib/telegram/digest";
import {
  buildLiveCallActiveKeyboard,
  buildPanicMenuText,
  buildPanicKeyboardPage1,
  withPanicContextData,
} from "@/lib/telegram/emergency";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { loadSession, saveSession } from "@/lib/telegram/session.server";
import type { HandlerCtx, ParsedCommand } from "@/lib/telegram/router";
import type { Lang } from "@/lib/i18n";
import { reportValueKeyboard } from "@/lib/telegram/report-flow";
import { getPublicAppUrl } from "@/lib/config.server";
import {
  acceptFamilyInvite,
  buildFamilyAlreadyLinkedKeyboard,
  buildFamilyInviteKeyboard,
  buildFamilySetupKeyboard,
  createFamilyInvite,
  parseFamilyStartArg,
} from "@/lib/telegram/family-shield.server";

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
    keyboard: reportValueKeyboard(ctx.session.lang),
  });
}

/**
 * Show the panic/emergency scenario selection menu (paginated inline buttons).
 * Page 1 shows scenarios 1–6 + "More" button. User picks their situation →
 * bot replies with specific steps + verified numbers.
 */
async function showPanicMenu(ctx: HandlerCtx): Promise<void> {
  const { lang } = ctx.session;
  const keyboard = buildPanicKeyboardPage1(lang);
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildPanicMenuText(lang)),
    keyboard,
  });
}

async function startLiveCallCopilot(ctx: HandlerCtx): Promise<void> {
  const { lang } = ctx.session;
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: withPanicContextData(undefined, 6),
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("live_call_header", lang) + "\n\n" + bt("live_call_hangup", lang)),
    keyboard: buildLiveCallActiveKeyboard(lang),
  });
}

async function sendChatId(ctx: HandlerCtx): Promise<void> {
  const chatType = ctx.chatType ?? "unknown";
  const isGroup = chatType === "group" || chatType === "supergroup";
  const text = isGroup
    ? [
        "🛠 Chat ID для настройки",
        "",
        `Chat ID: ${ctx.chatId}`,
        `Тип чата: ${chatType}`,
        "",
        "Скопируйте это значение в Railway:",
        `TELEGRAM_MODERATION_CHAT_ID=${ctx.chatId}`,
        "",
        "После redeploy проверьте:",
        "railway run npm run moderation:smoke",
        "",
        "Не отправляйте сюда реальные жалобы, пока smoke-тест не прошёл.",
      ].join("\n")
    : [
        "🛠 Chat ID",
        "",
        "Это личный чат. Для moderation-уведомлений нужен ID приватной группы.",
        "",
        "Создайте приватную группу, добавьте туда @scamguard_bot и напишите там:",
        "/chatid",
      ].join("\n");

  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(text),
  });
}

function isPrivateChat(ctx: HandlerCtx): boolean {
  return ctx.chatType == null || ctx.chatType === "private";
}

async function requirePrivateFamilyChat(ctx: HandlerCtx): Promise<boolean> {
  if (isPrivateChat(ctx)) return true;
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("family_private_chat_only", ctx.session.lang)),
  });
  return false;
}

async function showFamilyMenu(ctx: HandlerCtx): Promise<void> {
  if (!(await requirePrivateFamilyChat(ctx))) return;
  const { lang } = ctx.session;
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("family_menu_text", lang)),
    keyboard: buildFamilySetupKeyboard(lang),
  });
}

async function showAppealHelp(ctx: HandlerCtx): Promise<void> {
  const { lang } = ctx.session;
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("appeal_help", lang)),
    keyboard: [
      [{ text: bt("btn_open_appeal", lang), url: `${getPublicAppUrl()}/appeal` }],
      [{ text: bt("btn_report", lang), callback_data: CB.report }],
    ],
  });
}

async function sendFamilyInvite(ctx: HandlerCtx): Promise<void> {
  if (!(await requirePrivateFamilyChat(ctx))) return;
  const { lang } = ctx.session;
  const invite = await createFamilyInvite(ctx.userId);
  if (!invite.ok) {
    if (invite.reason === "already_linked") {
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(bt("family_already_linked", lang)),
        keyboard: buildFamilyAlreadyLinkedKeyboard(lang),
      });
      return;
    }
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("family_storage_error", lang)),
    });
    return;
  }
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("family_invite_text", lang)),
    keyboard: buildFamilyInviteKeyboard(invite.inviteUrl, lang),
  });
}

async function acceptFamilyStartLink(cmd: ParsedCommand, ctx: HandlerCtx): Promise<boolean> {
  const token = parseFamilyStartArg(cmd.arg);
  if (!token) return false;

  if (!(await requirePrivateFamilyChat(ctx))) return true;

  const { lang } = ctx.session;
  const accepted = await acceptFamilyInvite({
    token,
    trustedTelegramUserId: ctx.userId,
    trustedChatId: ctx.chatId,
  });

  if (accepted.ok) {
    await sendMessage({ chatId: ctx.chatId, text: escapeMarkdownV2(bt("family_accept_ok", lang)) });
    const guardianSession = await loadSession(accepted.guardianTelegramUserId);
    await sendMessage({
      chatId: accepted.guardianTelegramUserId,
      text: escapeMarkdownV2(bt("family_guardian_linked", guardianSession.lang)),
    });
    return true;
  }

  if (accepted.reason === "self_link") {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("family_accept_self", lang)),
    });
    return true;
  }

  const key =
    accepted.reason === "invalid"
      ? "family_accept_invalid"
      : accepted.reason === "expired"
        ? "family_accept_expired"
        : "family_storage_error";
  await sendMessage({ chatId: ctx.chatId, text: escapeMarkdownV2(bt(key, lang)) });
  return true;
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
      if (await acceptFamilyStartLink(cmd, ctx)) return;
      // Greeting + quick-action menu (R1.1, R1.5). Text is already escaped.
      const { text, keyboard } = formatWelcome(lang);
      await sendMessage({ chatId: ctx.chatId, text, keyboard });
      return;
    }

    case "/menu": {
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

    case "/chatid":
      await sendChatId(ctx);
      return;

    case "/call":
      await startLiveCallCopilot(ctx);
      return;

    case "/digest": {
      const { text, keyboard } = formatWeeklyScamDigest(lang);
      await sendMessage({ chatId: ctx.chatId, text, keyboard });
      return;
    }

    case "/appeal":
      await showAppealHelp(ctx);
      return;

    case "/safety":
      await sendMessage({ chatId: ctx.chatId, text: formatSafety(lang) });
      return;

    case "/family":
      await showFamilyMenu(ctx);
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
