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
  editMessageText,
  answerCallbackQuery,
  escapeMarkdownV2,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB, formatEmergencyChecklist, formatSafety } from "@/lib/telegram/format";
import { formatWeeklyScamDigest } from "@/lib/telegram/digest";
import {
  parsePanicCallback,
  buildPanicScenarioText,
  buildPanicKeyboardPage1,
  buildPanicKeyboardPage2,
  buildPanicKeyboardPage3,
  buildPanicMenuText,
  asPanicScenarioId,
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  buildLiveCallActiveKeyboard,
  buildLiveCallPhraseKeyboard,
  parsePanicContextCallbackData,
  parseLiveCallCallback,
  withPanicContextData,
  type EmergencyFollowUpAction,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";
import { setLanguage, saveSession } from "@/lib/telegram/session.server";
import type { HandlerCtx, OutOfScopeKind } from "@/lib/telegram/router";
import type { Lang } from "@/lib/i18n";
import { getMetaIntentResponse, type MetaIntent } from "@/lib/meta-intent";
import { reportValueKeyboard } from "@/lib/telegram/report-flow";
import {
  buildImageTriageFollowUpKeyboard,
  buildImageTriageKeyboard,
  buildImageTriageText,
  parseImageTriageCallback,
} from "@/lib/telegram/image-fallback";
import {
  buildAskedContextFollowUpKeyboard,
  buildAskedContextText,
  parseAskedContextCallback,
} from "@/lib/telegram/check-context-buttons";
import {
  buildLastCheckFollowUpText,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import {
  buildGuardianAngelKeyboard,
  buildGuardianAngelNoContextText,
  buildGuardianAngelText,
  parseGuardianAngelCallback,
} from "@/lib/telegram/guardian-angel";
import {
  buildGuardianVoiceOutText,
  buildPanicVoiceOutText,
  parseVoiceOutCallback,
  parseVoiceOutPanicCallback,
  sendVoiceOutResponse,
  VOICE_OUT_CB,
} from "@/lib/telegram/voice-out.server";
import {
  buildFamilyAlreadyLinkedKeyboard,
  buildFamilyInviteKeyboard,
  buildFamilySetupKeyboard,
  createFamilyInvite,
  FAMILY_CB,
  notifyTrustedContact,
  parseFamilyCallback,
  revokeFamilyShield,
  revokeFamilyShieldForTrusted,
} from "@/lib/telegram/family-shield.server";

const LANG_PREFIX = "lang:";
const SUPPORTED_LANGS: readonly Lang[] = ["ru", "uz", "en"];
type LiveCallResponseKey = "live_call_hangup" | "live_call_what_to_say" | "live_call_tell_family";

/** Parse a "lang:<code>" callback into a supported `Lang`, or `null`. */
function parseLangCallback(data: string): Lang | null {
  if (!data.startsWith(LANG_PREFIX)) return null;
  const code = data.slice(LANG_PREFIX.length);
  return (SUPPORTED_LANGS as readonly string[]).includes(code) ? (code as Lang) : null;
}

/** Send a plain bot-i18n string, MarkdownV2-escaped. */
async function sendI18n(
  chatId: number,
  key: Parameters<typeof bt>[0],
  lang: Lang,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(bt(key, lang)), keyboard });
}

export function buildUnsupportedMediaKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ],
    [
      { text: bt("btn_report", lang), callback_data: CB.report },
      { text: bt("btn_media_tips", lang), callback_data: CB.mediaTips },
    ],
  ];
}

async function rememberPanicContext(ctx: HandlerCtx, panicId: PanicScenarioId): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: withPanicContextData(undefined, panicId),
  });
}

async function sendEmergencyFollowUp(
  ctx: HandlerCtx,
  action: EmergencyFollowUpAction,
  panicId: PanicScenarioId,
): Promise<void> {
  const lang = ctx.session.lang;
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildEmergencyFollowUpText(action, panicId, lang)),
    keyboard: buildEmergencyFollowUpKeyboard(lang, panicId, {
      includeVoice: true,
      voiceAction: action,
    }),
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

async function sendFamilyInvite(ctx: HandlerCtx): Promise<void> {
  if (!(await requirePrivateFamilyChat(ctx))) return;
  const lang = ctx.session.lang;
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
    await sendI18n(ctx.chatId, "family_storage_error", lang);
    return;
  }
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("family_invite_text", lang)),
    keyboard: buildFamilyInviteKeyboard(invite.inviteUrl, lang),
  });
}

async function sendTrustedNotificationOrSetup(ctx: HandlerCtx): Promise<void> {
  if (!(await requirePrivateFamilyChat(ctx))) return;
  const lang = ctx.session.lang;
  const result = await notifyTrustedContact({
    guardianTelegramUserId: ctx.userId,
    lang,
    guardianDisplayName: ctx.displayName,
  });

  if (result.ok) {
    await sendI18n(ctx.chatId, "family_notify_ok", lang);
    return;
  }

  if (result.reason === "not_linked") {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("family_not_linked", lang)),
      keyboard: buildFamilySetupKeyboard(lang),
    });
    return;
  }

  if (result.reason === "cooldown") {
    await sendI18n(ctx.chatId, "family_notify_cooldown", lang);
    return;
  }

  const key =
    result.reason === "storage_unavailable" ? "family_storage_error" : "family_notify_failed";
  await sendI18n(ctx.chatId, key, lang);
}

async function handleFamilyCallback(data: string, ctx: HandlerCtx): Promise<boolean> {
  const action = parseFamilyCallback(data);
  if (action === null) return false;

  if (!(await requirePrivateFamilyChat(ctx))) return true;

  const lang = ctx.session.lang;
  if (action === FAMILY_CB.menu) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("family_menu_text", lang)),
      keyboard: buildFamilySetupKeyboard(lang),
    });
    return true;
  }

  if (action === FAMILY_CB.invite) {
    await sendFamilyInvite(ctx);
    return true;
  }

  if (action === FAMILY_CB.notify) {
    await sendTrustedNotificationOrSetup(ctx);
    return true;
  }

  if (action === FAMILY_CB.revoke) {
    const revoked = await revokeFamilyShield(ctx.userId);
    if (revoked.ok) {
      await sendI18n(ctx.chatId, "family_revoke_ok", lang);
    } else if (revoked.reason === "not_linked") {
      await sendI18n(ctx.chatId, "family_revoke_empty", lang);
    } else {
      await sendI18n(ctx.chatId, "family_storage_error", lang);
    }
    return true;
  }

  if (action === FAMILY_CB.trustedOptOut) {
    const revoked = await revokeFamilyShieldForTrusted(ctx.userId);
    if (revoked.ok) {
      await sendI18n(ctx.chatId, "family_trusted_opt_out_ok", lang);
    } else if (revoked.reason === "not_linked") {
      await sendI18n(ctx.chatId, "family_trusted_opt_out_empty", lang);
    } else {
      await sendI18n(ctx.chatId, "family_storage_error", lang);
    }
    return true;
  }

  return false;
}

export async function handleMetaIntent(intent: MetaIntent, ctx: HandlerCtx): Promise<void> {
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(getMetaIntentResponse(intent, ctx.session.lang)),
  });
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
  const voiceOutAction = parseVoiceOutCallback(data);
  // Clear the «часики» spinner as early as possible (best-effort, R-UX).
  // Voice-out answers the callback itself so it can show "preparing" or
  // duplicate-click feedback without starting another TTS request.
  if (callbackQueryId !== undefined && voiceOutAction === null) {
    await answerCallbackQuery(callbackQueryId);
  }

  const lang = ctx.session.lang;
  if (await handleFamilyCallback(data, ctx)) return;

  if (voiceOutAction !== null) {
    if (voiceOutAction === VOICE_OUT_CB.guardian) {
      const guardian = ctx.session.scenarioData.guardian;
      await sendVoiceOutResponse({
        chatId: ctx.chatId,
        userId: ctx.userId,
        lang,
        text: buildGuardianVoiceOutText(guardian, lang),
        keyboard: guardian ? buildGuardianAngelKeyboard(lang, guardian) : undefined,
        callbackQueryId,
      });
      return;
    }

    const voiceOutPanic = parseVoiceOutPanicCallback(data);
    const panicId =
      voiceOutPanic?.panicId ?? asPanicScenarioId(ctx.session.scenarioData.lastPanicId);
    if (panicId !== null) {
      await rememberPanicContext(ctx, panicId);
    }
    const text =
      panicId && voiceOutPanic?.action
        ? buildEmergencyFollowUpText(voiceOutPanic.action, panicId, lang)
        : panicId
          ? buildPanicVoiceOutText(panicId, lang)
          : null;
    await sendVoiceOutResponse({
      chatId: ctx.chatId,
      userId: ctx.userId,
      lang,
      text,
      keyboard: panicId
        ? buildEmergencyFollowUpKeyboard(lang, panicId, { includeVoice: false })
        : undefined,
      callbackQueryId,
    });
    return;
  }

  const guardianAction = parseGuardianAngelCallback(data);
  if (guardianAction !== null) {
    const guardian = ctx.session.scenarioData.guardian;
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        guardian
          ? buildGuardianAngelText(guardianAction, guardian, lang)
          : buildGuardianAngelNoContextText(lang),
      ),
      keyboard: guardian ? buildGuardianAngelKeyboard(lang, guardian) : undefined,
    });
    return;
  }

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
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("report_ask_value", lang)),
      keyboard: reportValueKeyboard(lang),
    });
    return;
  }

  // 3) «Новая проверка» — prompt for new content (R4.1).
  if (data === CB.checkAnother) {
    await saveSession(ctx.userId, {
      scenario: "await_check",
      scenarioStep: 0,
      scenarioData: ctx.session.scenarioData,
    });
    await sendI18n(ctx.chatId, "check_prompt", lang);
    return;
  }

  if (data === CB.voiceCorrect) {
    await saveSession(ctx.userId, {
      scenario: "await_check",
      scenarioStep: 0,
      scenarioData: ctx.session.scenarioData,
    });
    await sendI18n(ctx.chatId, "voice_correction_prompt", lang);
    return;
  }

  if (data === CB.showLang) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("choose_language", lang)),
      keyboard: [
        [
          { text: bt("btn_lang_ru", lang), callback_data: CB.lang("ru") },
          { text: bt("btn_lang_uz", lang), callback_data: CB.lang("uz") },
          { text: bt("btn_lang_en", lang), callback_data: CB.lang("en") },
        ],
      ],
    });
    return;
  }

  if (data === CB.safety) {
    await sendMessage({ chatId: ctx.chatId, text: formatSafety(lang) });
    return;
  }

  if (data === CB.howItWorks) {
    await sendI18n(ctx.chatId, "meta_how_do_you_check", lang);
    return;
  }

  if (data === CB.digest) {
    const { text, keyboard } = formatWeeklyScamDigest(lang);
    await sendMessage({ chatId: ctx.chatId, text, keyboard });
    return;
  }

  // Media fallback helper: show what evidence to extract from a video/audio message.
  if (data === CB.mediaTips) {
    await sendI18n(ctx.chatId, "media_capture_help", lang, buildUnsupportedMediaKeyboard(lang));
    return;
  }

  const imageTriageKind = parseImageTriageCallback(data);
  if (imageTriageKind !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildImageTriageText(imageTriageKind, lang)),
      keyboard: buildImageTriageFollowUpKeyboard(lang),
    });
    return;
  }

  const askedContextKind = parseAskedContextCallback(data);
  if (askedContextKind !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildAskedContextText(askedContextKind, lang)),
      keyboard: buildAskedContextFollowUpKeyboard(lang),
    });
    return;
  }

  // 3c) "Share with family" — generate a short shareable text (Sprint 3.6).
  if (data === "share_advice") {
    const shareText = bt("share_advice_text", lang);
    await sendMessage({ chatId: ctx.chatId, text: escapeMarkdownV2(shareText) });
    return;
  }

  if (data === CB.why) {
    const action = classifyLastCheckFollowUp("Почему так?", ctx.session.scenarioData);
    const snapshot = ctx.session.scenarioData.lastCheck;
    if (action === "explain" && snapshot) {
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(buildLastCheckFollowUpText(action, snapshot, lang)),
      });
      return;
    }

    await sendI18n(ctx.chatId, "why_explanation", lang);
    return;
  }

  // 4b) «Я уже отправил код/деньги» (Emergency) — show the panic menu with scenario selection.
  // Previously sent the full emergency text but it exceeds Telegram's 4096 char limit.
  // Now opens the paginated panic menu (same as /panic command).
  if (data === CB.emergency) {
    const menuText = escapeMarkdownV2(buildPanicMenuText(lang));
    const keyboard = buildPanicKeyboardPage1(lang);
    await sendMessage({ chatId: ctx.chatId, text: menuText, keyboard });
    return;
  }

  // 5) Panic menu pagination — "panic:more" / "panic:back".
  if (data === "panic:more") {
    const pageText = escapeMarkdownV2(buildPanicMenuText(lang));
    const keyboard = buildPanicKeyboardPage2(lang);
    if (ctx.messageId) {
      const editResult = await editMessageText({
        chatId: ctx.chatId,
        messageId: ctx.messageId,
        text: pageText,
        keyboard,
      });
      if (!editResult.ok) {
        // Graceful degradation: send as new message if edit fails.
        await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
      }
    } else {
      await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
    }
    return;
  }

  if (data === "panic:more2") {
    const pageText = escapeMarkdownV2(buildPanicMenuText(lang));
    const keyboard = buildPanicKeyboardPage3(lang);
    if (ctx.messageId) {
      const editResult = await editMessageText({
        chatId: ctx.chatId,
        messageId: ctx.messageId,
        text: pageText,
        keyboard,
      });
      if (!editResult.ok) {
        // Graceful degradation: send as new message if edit fails.
        await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
      }
    } else {
      await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
    }
    return;
  }

  if (data === "panic:back") {
    const pageText = escapeMarkdownV2(buildPanicMenuText(lang));
    const keyboard = buildPanicKeyboardPage1(lang);
    if (ctx.messageId) {
      const editResult = await editMessageText({
        chatId: ctx.chatId,
        messageId: ctx.messageId,
        text: pageText,
        keyboard,
      });
      if (!editResult.ok) {
        // Graceful degradation: send as new message if edit fails.
        await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
      }
    } else {
      await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
    }
    return;
  }

  if (data === "panic:back2") {
    const pageText = escapeMarkdownV2(buildPanicMenuText(lang));
    const keyboard = buildPanicKeyboardPage2(lang);
    if (ctx.messageId) {
      const editResult = await editMessageText({
        chatId: ctx.chatId,
        messageId: ctx.messageId,
        text: pageText,
        keyboard,
      });
      if (!editResult.ok) {
        // Graceful degradation: send as new message if edit fails.
        await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
      }
    } else {
      await sendMessage({ chatId: ctx.chatId, text: pageText, keyboard });
    }
    return;
  }

  // 5a) Emergency Copilot v2 follow-up buttons — "panicctx:contacts" etc.
  const panicContextCallback = parsePanicContextCallbackData(data);
  if (panicContextCallback !== null) {
    const panicId =
      panicContextCallback.panicId ?? asPanicScenarioId(ctx.session.scenarioData.lastPanicId) ?? 6;
    await rememberPanicContext(ctx, panicId);
    await sendEmergencyFollowUp(ctx, panicContextCallback.action, panicId);
    return;
  }

  // 5b) Panic scenario button — "panic:1" through "panic:10".
  const panicId = parsePanicCallback(data);
  if (panicId !== null) {
    await rememberPanicContext(ctx, panicId);
    // Scenario 6 ("on a call") → show interactive live-call copilot with buttons
    if (panicId === 6) {
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(
          bt("live_call_header", lang) + "\n\n" + bt("live_call_hangup", lang),
        ),
        keyboard: buildLiveCallActiveKeyboard(lang),
      });
      return;
    }
    // Send scenario text as a NEW message (not edit) to preserve the menu for further interaction.
    const scenarioText = buildPanicScenarioText(panicId, lang);
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(scenarioText),
      keyboard: buildEmergencyFollowUpKeyboard(lang, panicId),
    });
    return;
  }

  // 5b) Live-call copilot buttons — "livecall:hangup" etc.
  const liveAction = parseLiveCallCallback(data);
  if (liveAction !== null) {
    await rememberPanicContext(ctx, liveAction === "sent_code" ? 1 : 6);
    let responseKey: LiveCallResponseKey;
    switch (liveAction) {
      case "hangup":
        await sendEmergencyFollowUp(ctx, "more", 6);
        return;
      case "what_to_say":
        responseKey = "live_call_what_to_say";
        break;
      case "call_bank": {
        await sendEmergencyFollowUp(ctx, "contacts", 6);
        return;
      }
      case "sent_code": {
        // Redirect to panic scenario 1 (sent OTP)
        const scenarioText = buildPanicScenarioText(1, lang);
        await sendMessage({
          chatId: ctx.chatId,
          text: escapeMarkdownV2(scenarioText),
          keyboard: buildEmergencyFollowUpKeyboard(lang, 1),
        });
        return;
      }
      case "tell_family":
        await sendTrustedNotificationOrSetup(ctx);
        return;
      default:
        return;
    }
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt(responseKey, lang)),
      keyboard: buildLiveCallPhraseKeyboard(lang),
    });
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
      // suggest sending text or a screenshot instead, with immediate next-step
      // buttons so the user is not left in a dead end.
      await sendI18n(ctx.chatId, "out_of_scope", lang, buildUnsupportedMediaKeyboard(lang));
      break;
    case "document":
      // APK/PDF/other documents: never downloaded. Give specific safety advice.
      await sendI18n(ctx.chatId, "document_safety", lang);
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
