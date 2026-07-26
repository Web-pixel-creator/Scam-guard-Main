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
import {
  sendMessage,
  escapeMarkdownV2,
  getFile,
  downloadFileAsDataUrl,
  type InlineKeyboard,
  type SendMessageResult,
} from "@/lib/telegram/api.server";
import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import {
  saveSession,
  resetScenario,
  withSessionChatScope,
  type ReportDraft,
} from "@/lib/telegram/session.server";
import type { HandlerCtx } from "@/lib/telegram/router";
import {
  prepareIncidentOnlyReportTarget,
  prepareReportIdentifier,
  reportRateLimitKeyForTelegram,
  submitPreparedReportCore,
  type PreparedReportTarget,
} from "@/lib/report.functions";
import type { Lang } from "@/lib/i18n";
import { redactText } from "@/lib/risk/detect";
import { analyzeImageCore, type RateLimitedError } from "@/lib/risk/check-core";
import { logServerError } from "@/lib/safe-server-log.server";
import {
  hasUsableImageEvidence,
  type ImageIntelligenceResult,
  type ImageRiskHint,
  type ImageVisualCategory,
} from "@/lib/risk/image-intelligence";
import {
  REPORT_NO_VALUE_CALLBACK,
  REPORT_RETRY_CALLBACK,
  REPORT_SKIP_CALLBACK,
  matchesReportCallbackBinding,
  reportRetryKeyboard,
  reportSkipKeyboard,
  reportValueKeyboard,
  withReportCallbackBinding,
  withoutReportCallbackBinding,
  type ReportCallbackAction,
  type ReportCallbackScenario,
} from "@/lib/telegram/report-flow";
import { claimTelegramImageDownloadBudget } from "@/lib/telegram/media-admission.server";

// ── Limits (mirror reportSchema in report.functions.ts) ─────────────────────
const VALUE_MAX = 500; // R6.6
const DESC_MIN = 5; // R6.5
const DESC_MAX = 5000; // R6.5
const OPTIONAL_FIELD_MAX = 80; // scamType / city column bound (reportSchema)
const AMOUNT_MAX = 10_000_000_000; // amountLostUzs bound (reportSchema)
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const REPORT_IMAGE_SUMMARY_MAX = 420;

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
): Promise<SendMessageResult> {
  return sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt(key, lang)),
    keyboard,
  });
}

async function rememberReportPrompt(
  ctx: HandlerCtx,
  delivery: SendMessageResult,
  action: ReportCallbackAction,
  scenario: ReportCallbackScenario,
  scenarioStep: number,
  scenarioData: ReportDraft,
): Promise<void> {
  if (delivery.messageId === undefined) return;
  await saveSession(ctx.userId, {
    scenario,
    scenarioStep,
    scenarioData: withReportCallbackBinding(
      withoutReportCallbackBinding(scenarioData),
      delivery.messageId,
      action,
      scenario,
    ),
  });
}

async function sendBoundReportPrompt(
  ctx: HandlerCtx,
  key: BotStringKey,
  lang: Lang,
  keyboard: InlineKeyboard,
  action: ReportCallbackAction,
  scenario: ReportCallbackScenario,
  scenarioStep: number,
  scenarioData: ReportDraft,
): Promise<void> {
  const delivery = await sendText(ctx, key, lang, keyboard);
  await rememberReportPrompt(ctx, delivery, action, scenario, scenarioStep, scenarioData);
}

async function requireCurrentReportCallback(
  ctx: HandlerCtx,
  action: ReportCallbackAction,
  scenario: ReportCallbackScenario,
): Promise<boolean> {
  if (matchesReportCallbackBinding(ctx.session.scenarioData, ctx.messageId, action, scenario)) {
    return true;
  }
  await sendText(ctx, "report_callback_expired", ctx.session.lang);
  return false;
}

/** A textual skip: "-", "—" or an empty/whitespace-only message. */
function redactOptionalReportText(value: string): string {
  return redactText(value.trim()).slice(0, OPTIONAL_FIELD_MAX);
}

async function sanitizeDraftForStorage(draft: ReportDraft): Promise<ReportDraft> {
  const clean: ReportDraft = withoutReportCallbackBinding(draft);

  if (!clean.target && clean.value && !clean.noValue) {
    clean.target = await prepareReportIdentifier(clean.value);
  }
  delete clean.value;

  if (clean.description) clean.description = redactText(clean.description);
  if (clean.scamType) clean.scamType = redactOptionalReportText(clean.scamType);
  if (clean.city) clean.city = redactOptionalReportText(clean.city);

  return clean;
}

async function sanitizeDraftOrReset(
  ctx: HandlerCtx,
  draft: ReportDraft,
  lang: Lang,
): Promise<ReportDraft | null> {
  try {
    return await sanitizeDraftForStorage(draft);
  } catch (e) {
    logServerError("telegram_report.draft_preparation_failed", e);
    await sendText(ctx, "report_error", lang);
    await resetScenario(ctx.userId);
    return null;
  }
}

async function prepareFinalDraft(
  ctx: HandlerCtx,
  draft: ReportDraft,
  lang: Lang,
): Promise<{ draft: ReportDraft; target: PreparedReportTarget } | null> {
  const clean = await sanitizeDraftOrReset(ctx, draft, lang);
  if (!clean) return null;

  if (!clean.description || (!clean.target && !clean.noValue)) {
    await sendText(ctx, "report_error", lang);
    await resetScenario(ctx.userId);
    return null;
  }

  try {
    const target = clean.noValue
      ? await prepareIncidentOnlyReportTarget(clean.description)
      : clean.target;
    if (!target) {
      await sendText(ctx, "report_error", lang);
      await resetScenario(ctx.userId);
      return null;
    }
    return { draft: { ...clean, target }, target };
  } catch (e) {
    logServerError("telegram_report.target_preparation_failed", e);
    await sendText(ctx, "report_error", lang);
    await resetScenario(ctx.userId);
    return null;
  }
}

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

function isRateLimitedError(e: unknown): e is RateLimitedError {
  return e instanceof Error && (e as Partial<RateLimitedError>).status === 429;
}

function reportImageRateLimitKey(userId: number): string {
  return `tg:${userId}`;
}

const RAW_URL_RE =
  /\bhttps?:\/\/[^\s<>()]+|\b(?:t\.me|telegram\.me)\/[^\s<>()]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/gi;
const RAW_TELEGRAM_USERNAME_RE = /@[a-z0-9_]{3,32}/gi;

function redactEvidenceText(value: string): string {
  return redactText(value)
    .replace(RAW_URL_RE, "[ссылка скрыта]")
    .replace(RAW_TELEGRAM_USERNAME_RE, "@•••")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(category: ImageVisualCategory, lang: Lang): string {
  const labels: Record<ImageVisualCategory, Record<Lang, string>> = {
    delivery_sms: {
      ru: "уведомление о доставке",
      uz: "yetkazib berish xabari",
      en: "delivery notification",
    },
    restaurant_menu_qr: {
      ru: "меню или ресторанный QR",
      uz: "menyu yoki restoran QR",
      en: "menu or restaurant QR",
    },
    qr_menu_or_info: {
      ru: "информационный QR",
      uz: "ma'lumot QR",
      en: "information QR",
    },
    qr_login_or_payment: {
      ru: "QR для входа или оплаты",
      uz: "kirish yoki to'lov QR",
      en: "login or payment QR",
    },
    chat_screenshot: {
      ru: "скрин переписки",
      uz: "yozishma skrinshoti",
      en: "chat screenshot",
    },
    telegram_profile_card: {
      ru: "скрин профиля Telegram",
      uz: "Telegram profil skrinshoti",
      en: "Telegram profile screenshot",
    },
    payment_request: {
      ru: "просьба об оплате",
      uz: "to'lov so'rovi",
      en: "payment request",
    },
    apk_prompt: {
      ru: "просьба установить приложение/APK",
      uz: "ilova/APK o'rnatish so'rovi",
      en: "app/APK install request",
    },
    document: {
      ru: "документ или объявление",
      uz: "hujjat yoki e'lon",
      en: "document or notice",
    },
    telegram_promo_post: {
      ru: "Telegram-промо",
      uz: "Telegram promo",
      en: "Telegram promo",
    },
    casino_or_betting_promo: {
      ru: "казино, ставки или фриспины",
      uz: "kazino, stavka yoki free spin",
      en: "casino, betting, or free spins",
    },
    crypto_giveaway_or_nft: {
      ru: "NFT/Stars/подарок или розыгрыш",
      uz: "NFT/Stars/sovg'a yoki yutuq",
      en: "NFT/Stars/gift or giveaway",
    },
    wallet_or_defi_action: {
      ru: "кошелёк, TON или DeFi-действие",
      uz: "wallet, TON yoki DeFi harakati",
      en: "wallet, TON, or DeFi action",
    },
    news_or_channel_post: {
      ru: "новость или пост канала",
      uz: "yangilik yoki kanal posti",
      en: "news or channel post",
    },
    unknown: {
      ru: "скриншот с неясным контекстом",
      uz: "konteksti noaniq skrinshot",
      en: "screenshot with unclear context",
    },
  };
  return labels[category][lang];
}

function hintLabel(hint: ImageRiskHint, lang: Lang): string {
  const labels: Record<ImageRiskHint, Record<Lang, string>> = {
    otp_or_secret: { ru: "код/пароль", uz: "kod/parol", en: "code/password" },
    apk_install: { ru: "APK/приложение", uz: "APK/ilova", en: "APK/app" },
    qr_login: { ru: "QR-вход", uz: "QR kirish", en: "QR login" },
    qr_payment: { ru: "QR-оплата", uz: "QR to'lov", en: "QR payment" },
    payment_request: { ru: "оплата/перевод", uz: "to'lov/o'tkazma", en: "payment/transfer" },
    card_data: { ru: "данные карты", uz: "karta ma'lumoti", en: "card data" },
    urgent_pressure: { ru: "срочность/давление", uz: "shoshirish/bosim", en: "urgency/pressure" },
    brand_impersonation: { ru: "имитация бренда", uz: "brendga o'xshash", en: "brand imitation" },
    casino_bonus_or_free_spins: {
      ru: "казино/бонус",
      uz: "kazino/bonus",
      en: "casino/bonus",
    },
    fake_captcha_or_voting: {
      ru: "капча/голосование",
      uz: "captcha/ovoz berish",
      en: "captcha/voting",
    },
    giveaway_or_prize_actions: { ru: "подарок/приз", uz: "sovg'a/yutuq", en: "gift/prize" },
    task_reward_or_engagement: {
      ru: "задания за награду",
      uz: "mukofotli vazifa",
      en: "reward tasks",
    },
    wallet_or_defi_urgency: {
      ru: "wallet/DeFi срочность",
      uz: "wallet/DeFi shoshilinch",
      en: "wallet/DeFi urgency",
    },
    ton_referral_or_earning: {
      ru: "TON/реферал",
      uz: "TON/referal",
      en: "TON/referral",
    },
    telegram_invite_or_private_link: {
      ru: "закрытый Telegram-инвайт",
      uz: "yopiq Telegram taklifi",
      en: "private Telegram invite",
    },
    telegram_account_takeover: {
      ru: "угон Telegram-аккаунта",
      uz: "Telegram akkauntini olib qo'yish",
      en: "Telegram account takeover",
    },
    fake_device_security_popup: {
      ru: "фейковое окно безопасности",
      uz: "soxta xavfsizlik oynasi",
      en: "fake security pop-up",
    },
  };
  return labels[hint][lang];
}

function buildReportImageDescription(evidence: ImageIntelligenceResult, lang: Lang): string {
  const parts: string[] = [];
  const category = categoryLabel(evidence.visualCategory, lang);
  const hints = evidence.riskHints.slice(0, 4).map((hint) => hintLabel(hint, lang));
  const summary = evidence.summary ? redactEvidenceText(evidence.summary) : "";

  if (lang === "uz") {
    parts.push(`Skrinshot: ${category}.`);
    if (hints.length > 0) parts.push(`Ko'rinadigan belgilar: ${hints.join(", ")}.`);
    if (summary) parts.push(`Qisqa mazmun: ${summary}.`);
  } else if (lang === "en") {
    parts.push(`Screenshot: ${category}.`);
    if (hints.length > 0) parts.push(`Visible signals: ${hints.join(", ")}.`);
    if (summary) parts.push(`Short summary: ${summary}.`);
  } else {
    parts.push(`Скриншот: ${category}.`);
    if (hints.length > 0) parts.push(`Видимые признаки: ${hints.join(", ")}.`);
    if (summary) parts.push(`Кратко: ${summary}.`);
  }

  return redactEvidenceText(parts.join(" ")).slice(0, REPORT_IMAGE_SUMMARY_MAX).trim();
}

// ---------------------------------------------------------------------------
// Step prompts
// ---------------------------------------------------------------------------

async function askValue(ctx: HandlerCtx, lang: Lang, draft: ReportDraft): Promise<void> {
  await sendBoundReportPrompt(
    ctx,
    "report_ask_value",
    lang,
    reportValueKeyboard(lang),
    REPORT_NO_VALUE_CALLBACK,
    "report_value",
    0,
    draft,
  );
}

async function askDescription(ctx: HandlerCtx, lang: Lang): Promise<void> {
  await sendText(ctx, "report_ask_description", lang);
}

async function askScamType(ctx: HandlerCtx, lang: Lang, draft: ReportDraft): Promise<void> {
  await sendBoundReportPrompt(
    ctx,
    "report_ask_scam_type",
    lang,
    reportSkipKeyboard(lang),
    REPORT_SKIP_CALLBACK,
    "report_scamType",
    2,
    draft,
  );
}

async function askCity(ctx: HandlerCtx, lang: Lang, draft: ReportDraft): Promise<void> {
  await sendBoundReportPrompt(
    ctx,
    "report_ask_city",
    lang,
    reportSkipKeyboard(lang),
    REPORT_SKIP_CALLBACK,
    "report_city",
    3,
    draft,
  );
}

async function askAmount(ctx: HandlerCtx, lang: Lang, draft: ReportDraft): Promise<void> {
  await sendBoundReportPrompt(
    ctx,
    "report_ask_amount",
    lang,
    reportSkipKeyboard(lang),
    REPORT_SKIP_CALLBACK,
    "report_amount",
    4,
    draft,
  );
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
  const draft = withSessionChatScope({}, ctx.chatId, ctx.chatType);
  await saveSession(ctx.userId, {
    scenario: "report_value",
    scenarioStep: 0,
    scenarioData: draft,
  });
  await askValue(ctx, lang, draft);
}

// ---------------------------------------------------------------------------
// Individual steps
// ---------------------------------------------------------------------------

async function stepValue(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const value = text.trim();

  if (value.length === 0) {
    // Empty value — re-ask (no state change).
    await askValue(ctx, lang, ctx.session.scenarioData);
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
    await sendBoundReportPrompt(
      ctx,
      "report_value_invalid",
      lang,
      reportValueKeyboard(lang),
      REPORT_NO_VALUE_CALLBACK,
      "report_value",
      0,
      ctx.session.scenarioData,
    );
    return;
  }

  const draft = await sanitizeDraftOrReset(ctx, { ...ctx.session.scenarioData, value }, lang);
  if (!draft) return;
  await saveSession(ctx.userId, {
    scenario: "report_desc",
    scenarioStep: 1,
    scenarioData: draft,
  });
  await askDescription(ctx, lang);
}

async function advanceWithoutIdentifier(ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft: ReportDraft = {
    ...withoutReportCallbackBinding(ctx.session.scenarioData),
    noValue: true,
  };
  delete draft.value;
  delete draft.target;
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

  const draft = await sanitizeDraftOrReset(ctx, { ...ctx.session.scenarioData, description }, lang);
  if (!draft) return;
  await saveSession(ctx.userId, {
    scenario: "report_scamType",
    scenarioStep: 2,
    scenarioData: draft,
  });
  await askScamType(ctx, lang, draft);
}

export async function handleScenarioImage(
  fileId: string,
  ctx: HandlerCtx,
  _mediaGroupId?: string,
): Promise<void> {
  const lang = ctx.session.lang;
  if (ctx.session.scenario !== "report_desc") return;

  async function askForTypedDescription(): Promise<void> {
    await sendText(ctx, "report_image_unreadable", lang);
  }

  try {
    await claimTelegramImageDownloadBudget(ctx.userId);
    const meta = await getFile(fileId);
    if (!meta) {
      await askForTypedDescription();
      return;
    }
    if (meta.fileSize > MAX_IMAGE_BYTES) {
      await sendText(ctx, "image_too_large", lang);
      return;
    }

    const dataUrl = await downloadFileAsDataUrl(meta.filePath);
    if (!dataUrl) {
      await askForTypedDescription();
      return;
    }

    const evidence = await analyzeImageCore(dataUrl, lang, reportImageRateLimitKey(ctx.userId));
    if (!evidence || !hasUsableImageEvidence(evidence)) {
      await askForTypedDescription();
      return;
    }

    const description = buildReportImageDescription(evidence, lang);
    if (description.length < DESC_MIN) {
      await askForTypedDescription();
      return;
    }

    const draft = await sanitizeDraftOrReset(
      ctx,
      { ...ctx.session.scenarioData, description },
      lang,
    );
    if (!draft) return;
    await saveSession(ctx.userId, {
      scenario: "report_scamType",
      scenarioStep: 2,
      scenarioData: draft,
    });

    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("report_image_added", lang, { summary: description })),
    });
    await askScamType({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang, draft);
  } catch (e) {
    if (isRateLimitedError(e)) {
      await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(bt("rate_limited", lang, { seconds: e.retryAfter })),
      });
      return;
    }
    console.error("telegram report image failed", "handler_exception");
    await askForTypedDescription();
  }
}

async function stepScamType(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft = await sanitizeDraftOrReset(ctx, { ...ctx.session.scenarioData }, lang);
  if (!draft) return;
  if (!isSkip(text)) {
    draft.scamType = redactOptionalReportText(text);
  }
  await saveSession(ctx.userId, {
    scenario: "report_city",
    scenarioStep: 3,
    scenarioData: draft,
  });
  await askCity({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang, draft);
}

async function stepCity(text: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const draft = await sanitizeDraftOrReset(ctx, { ...ctx.session.scenarioData }, lang);
  if (!draft) return;
  if (!isSkip(text)) {
    draft.city = redactOptionalReportText(text);
  }
  await saveSession(ctx.userId, {
    scenario: "report_amount",
    scenarioStep: 4,
    scenarioData: draft,
  });
  await askAmount({ ...ctx, session: { ...ctx.session, scenarioData: draft } }, lang, draft);
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
  const prepared = await prepareFinalDraft(ctx, draft, lang);
  if (!prepared) return;
  const { draft: safeDraft, target } = prepared;

  async function keepDraftForRetry(): Promise<void> {
    await saveSession(ctx.userId, {
      scenario: "report_amount",
      scenarioStep: 4,
      scenarioData: safeDraft,
    });
  }

  async function rememberRetryPrompt(delivery: SendMessageResult): Promise<void> {
    await rememberReportPrompt(ctx, delivery, REPORT_RETRY_CALLBACK, "report_amount", 4, safeDraft);
  }

  try {
    const result = await submitPreparedReportCore(
      {
        target,
        description: safeDraft.description as string,
        scamType: safeDraft.scamType,
        city: safeDraft.city,
        amountLostUzs: safeDraft.amountLostUzs,
        lang,
      },
      reportRateLimitKeyForTelegram(ctx.userId),
    );

    if (!result.ok && result.error === "rate_limited") {
      await keepDraftForRetry();
      const delivery = await sendMessage({
        chatId: ctx.chatId,
        text: escapeMarkdownV2(bt("rate_limited", lang, { seconds: result.retryAfterSec ?? 60 })),
        keyboard: reportRetryKeyboard(lang),
      });
      await rememberRetryPrompt(delivery);
      return;
    }

    if (result.ok) {
      // R6.7 — confirm receipt + "public only after moderation".
      await sendText(ctx, "report_confirm", lang);
      await resetScenario(ctx.userId);
    } else {
      // R6.8 — pipeline reported failure: friendly retry message.
      await keepDraftForRetry();
      const delivery = await sendText(ctx, "report_error", lang, reportRetryKeyboard(lang));
      await rememberRetryPrompt(delivery);
    }
  } catch {
    // R6.8 — never crash; log without Sensitive_Data (R19.2).
    console.error("telegram submitReport failed", "handler_exception");
    await keepDraftForRetry();
    const delivery = await sendText(ctx, "report_error", lang, reportRetryKeyboard(lang));
    await rememberRetryPrompt(delivery);
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
  const scenario = ctx.session.scenario;
  if (
    scenario !== "report_scamType" &&
    scenario !== "report_city" &&
    scenario !== "report_amount"
  ) {
    await sendText(ctx, "report_callback_expired", ctx.session.lang);
    return;
  }
  if (!(await requireCurrentReportCallback(ctx, REPORT_SKIP_CALLBACK, scenario))) return;

  switch (scenario) {
    case "report_scamType":
      await stepScamType("-", ctx);
      break;
    case "report_city":
      await stepCity("-", ctx);
      break;
    case "report_amount":
      await stepAmount("-", ctx);
      break;
  }
}

export async function handleReportNoValue(ctx: HandlerCtx): Promise<void> {
  if (
    ctx.session.scenario !== "report_value" ||
    !(await requireCurrentReportCallback(ctx, REPORT_NO_VALUE_CALLBACK, "report_value"))
  ) {
    if (ctx.session.scenario !== "report_value") {
      await sendText(ctx, "report_callback_expired", ctx.session.lang);
    }
    return;
  }
  await advanceWithoutIdentifier(ctx);
}

export async function handleReportRetry(ctx: HandlerCtx): Promise<void> {
  if (
    ctx.session.scenario !== "report_amount" ||
    !(await requireCurrentReportCallback(ctx, REPORT_RETRY_CALLBACK, "report_amount"))
  ) {
    if (ctx.session.scenario !== "report_amount") {
      await sendText(ctx, "report_callback_expired", ctx.session.lang);
    }
    return;
  }
  await finalizeReport(ctx, { ...ctx.session.scenarioData });
}
