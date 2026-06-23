// Check handlers for the Telegram bot (Ishonch Guard).
//
// Implements the three "проверка" entry points of the `Handlers` contract from
// `router.ts` (task 8.3). All of them funnel user content into the shared,
// transport-independent risk core (`check-core.ts`) using a Telegram-specific
// rate-limit key and channel, then render the reply via the formatter.
//
// Contract (design.md → Check_Pipeline / OCR sequence / Контакт-карта R21):
//   handleCheck            text + forwarded text → runCheck
//   handleImage            screenshot → download (in memory) → OCR → runCheck
//   handlePhoneFromContact contact card number → runCheck(type="phone")
//
// Fixed cross-cutting rules baked in here:
//  - rateLimitKey is ALWAYS "tg:"+userId — never IP-based (R10.1, R10.3).
//  - channel is ALWAYS "telegram" (analytics only; never affects scoring).
//  - language comes from the loaded Session (R2.x); replies use formatCheckResult.
//  - long waits show a "typing" indicator only after 3s (R18.2).
//  - RateLimitedError → a friendly, localized wait message (R10.2).
//  - images are processed ONLY in memory and never persisted (R5.3); oversize
//    (>6 MB) is rejected (R5.5) and a null OCR result is reported (R5.6).
//
// Server-only: pulls in `*.server.ts` modules (Bot API + service-role core).
// This module is wired into the router later (task 9.1) via `setHandlers`; it
// deliberately does NOT import sibling handler modules or touch the aggregator.
import {
  analyzeImageCore,
  runCheck,
  transcribeVoiceCore,
  type RateLimitedError,
} from "@/lib/risk/check-core";
import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";
import {
  sendMessage,
  sendChatAction,
  getFile,
  downloadFileAsDataUrl,
  escapeMarkdownV2,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import { CB, formatCheckResult } from "@/lib/telegram/format";
import { bt } from "@/lib/telegram/bot-i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { saveSession } from "@/lib/telegram/session.server";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
  buildPanicScenarioText,
  withPanicContextData,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";
import {
  buildLastCheckFollowUpText,
  buildOrphanCheckFollowUpText,
  buildImageUnreadableSnapshot,
  buildLastCheckSnapshot,
  classifyOrphanCheckFollowUp,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import {
  buildGuardianAngelIntro,
  buildGuardianAngelKeyboard,
  buildGuardianAngelSnapshot,
  buildGuardianAngelText,
  classifyGuardianAngelFollowUp,
} from "@/lib/telegram/guardian-angel";
import {
  buildDecodedQrOnlyImageEvidence,
  buildImageCheckInput,
  fallbackImageIntelligence,
  buildImageUserExplanation,
  hasUsableImageEvidence,
  isBenignImageContext,
  mergeDecodedQrEvidence,
} from "@/lib/risk/image-intelligence";
import { decodeQrFromDataUrl } from "@/lib/risk/qr-decoder";
import { enrichTelegramPublicMetadata } from "@/lib/telegram/public-metadata.server";
import {
  buildTelegramPublicPostCheckEvidence,
  enrichTelegramPublicPostResult,
} from "@/lib/telegram/public-post.server";
import { enrichTelegramReputation } from "@/lib/telegram/reputation.server";
import {
  enrichForwardSourceContext,
  type TelegramForwardSourceContext,
} from "@/lib/telegram/forward-context";
import { buildImageTriageKeyboard } from "@/lib/telegram/image-fallback";

/** Канал бота — только для аналитики/логов, не влияет на scoring (design.md). */
const CHANNEL = "telegram" as const;

/** Максимальная длина текстового ввода Check_Pipeline (R4.10). */
const MAX_TEXT_LENGTH = 2000;

/** Верхний предел размера скачиваемого изображения: 6 МБ (R5.5). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const MAX_VOICE_DURATION_SEC = 60;
const VOICE_STT_DAILY_LIMIT = 5;
const VOICE_STT_WINDOW_MS = 24 * 60 * 60 * 1000;
const VOICE_TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VOICE_TRANSCRIPT_PREVIEW_CHARS = 180;
const VOICE_LOW_SIGNAL_MIN_LETTERS = 6;
const VOICE_LOW_SIGNAL_MIN_MEANINGFUL_WORDS = 2;

/** Через сколько мс ожидания показывать индикатор «печатает…» (R18.2). */
const TYPING_DELAY_MS = 3000;
const TELEGRAM_AI_EXPLANATION_TIMEOUT_MS = readBoundedIntEnv(
  "TELEGRAM_AI_EXPLANATION_TIMEOUT_MS",
  2500,
  500,
  10_000,
);
const TELEGRAM_AI_EXPLANATION_MAX_ATTEMPTS = readBoundedIntEnv(
  "TELEGRAM_AI_EXPLANATION_MAX_ATTEMPTS",
  1,
  1,
  3,
);
const TELEGRAM_AI_EXPLANATION_OPTIONS = {
  aiTimeoutMs: TELEGRAM_AI_EXPLANATION_TIMEOUT_MS,
  aiMaxAttempts: TELEGRAM_AI_EXPLANATION_MAX_ATTEMPTS,
} as const;
const TELEGRAM_IMAGE_ANALYSIS_TIMEOUT_MS = readBoundedIntEnv(
  "TELEGRAM_IMAGE_ANALYSIS_TIMEOUT_MS",
  6500,
  1000,
  15_000,
);
const TELEGRAM_IMAGE_ANALYSIS_MAX_ATTEMPTS = readBoundedIntEnv(
  "TELEGRAM_IMAGE_ANALYSIS_MAX_ATTEMPTS",
  1,
  1,
  2,
);
const TELEGRAM_IMAGE_ANALYSIS_OPTIONS = {
  timeoutMs: TELEGRAM_IMAGE_ANALYSIS_TIMEOUT_MS,
  maxAttempts: TELEGRAM_IMAGE_ANALYSIS_MAX_ATTEMPTS,
} as const;
const TELEGRAM_VOICE_TRANSCRIBE_TIMEOUT_MS = readBoundedIntEnv(
  "TELEGRAM_VOICE_TRANSCRIBE_TIMEOUT_MS",
  8000,
  1000,
  15_000,
);
const TELEGRAM_VOICE_TRANSCRIBE_OPTIONS = {
  timeoutMs: TELEGRAM_VOICE_TRANSCRIBE_TIMEOUT_MS,
} as const;

const MEDIA_GROUP_FALLBACK_TTL_MS = 30_000;
const IMAGE_OCR_REPEAT_TTL_MS = 45_000;
const mediaGroupOcrFallbacks = new Map<string, number>();
const recentImageOcrFallbacks = new Map<number, number>();
const voiceTranscriptCache = new Map<string, { text: string; cachedAt: number }>();

function readBoundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

/** Ключ rate-limit бота ВСЕГДА основан на telegram_user_id (R10.1, R10.3). */
function rateLimitKeyFor(userId: number): string {
  return `tg:${userId}`;
}

function voiceSttBudgetKey(userId: number): string {
  return `voice-stt:${rateLimitKeyFor(userId)}`;
}

function voiceCacheKey(userId: number, fileUniqueId?: string): string | null {
  const id = fileUniqueId?.trim();
  return id ? `${userId}:${id}` : null;
}

function pruneVoiceTranscriptCache(now = Date.now()): void {
  for (const [key, value] of voiceTranscriptCache) {
    if (now - value.cachedAt > VOICE_TRANSCRIPT_CACHE_TTL_MS) {
      voiceTranscriptCache.delete(key);
    }
  }
}

function getCachedVoiceTranscript(userId: number, fileUniqueId?: string): string | null {
  const key = voiceCacheKey(userId, fileUniqueId);
  if (!key) return null;
  const now = Date.now();
  pruneVoiceTranscriptCache(now);
  const cached = voiceTranscriptCache.get(key);
  if (!cached) return null;
  if (now - cached.cachedAt > VOICE_TRANSCRIPT_CACHE_TTL_MS) {
    voiceTranscriptCache.delete(key);
    return null;
  }
  return cached.text;
}

function rememberVoiceTranscript(
  userId: number,
  fileUniqueId: string | undefined,
  text: string,
): void {
  const key = voiceCacheKey(userId, fileUniqueId);
  if (!key) return;
  pruneVoiceTranscriptCache();
  voiceTranscriptCache.set(key, { text, cachedAt: Date.now() });
}

async function checkVoiceSttBudget(userId: number): Promise<void> {
  const result = await checkSharedRateLimit(
    "check",
    voiceSttBudgetKey(userId),
    VOICE_STT_DAILY_LIMIT,
    VOICE_STT_WINDOW_MS,
  );
  if (!result.ok) {
    throw rateLimitedVoiceSttError(result.retryAfterSec);
  }
}

function pruneOcrFallbackMemory(now = Date.now()): void {
  for (const [key, timestamp] of mediaGroupOcrFallbacks) {
    if (now - timestamp > MEDIA_GROUP_FALLBACK_TTL_MS) mediaGroupOcrFallbacks.delete(key);
  }
  for (const [userId, timestamp] of recentImageOcrFallbacks) {
    if (now - timestamp > IMAGE_OCR_REPEAT_TTL_MS) recentImageOcrFallbacks.delete(userId);
  }
}

type OcrFallbackReply = "long" | "short" | "suppress";

type TimingField = string | number | boolean | null | undefined;

function telegramTimingLogThresholdMs(): number {
  return readBoundedIntEnv("TELEGRAM_TIMING_LOG_THRESHOLD_MS", 1000, 0, 60_000);
}

function logTelegramTiming(
  event: string,
  startedAt: number,
  fields: Record<string, TimingField> = {},
): void {
  const durationMs = Date.now() - startedAt;
  if (process.env.TELEGRAM_TIMING_LOGS !== "1" && durationMs < telegramTimingLogThresholdMs()) {
    return;
  }

  const payload: Record<string, string | number | boolean | null> = {
    event,
    durationMs,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) payload[key] = value;
  }
  console.info("telegram_timing", JSON.stringify(payload));
}

function nextOcrFallbackReply(userId: number, mediaGroupId?: string): OcrFallbackReply {
  const now = Date.now();
  pruneOcrFallbackMemory(now);

  if (mediaGroupId) {
    const key = `${userId}:${mediaGroupId}`;
    const previous = mediaGroupOcrFallbacks.get(key);
    mediaGroupOcrFallbacks.set(key, now);
    recentImageOcrFallbacks.set(userId, now);
    return previous !== undefined && now - previous <= MEDIA_GROUP_FALLBACK_TTL_MS
      ? "suppress"
      : "long";
  }

  const previous = recentImageOcrFallbacks.get(userId);
  recentImageOcrFallbacks.set(userId, now);
  return previous !== undefined && now - previous <= IMAGE_OCR_REPEAT_TTL_MS ? "short" : "long";
}

/** Узкий type-guard на `RateLimitedError` из ядра (status 429 + retryAfter). */
function isRateLimitedError(e: unknown): e is RateLimitedError {
  return e instanceof Error && (e as Partial<RateLimitedError>).status === 429;
}

function rateLimitedVoiceSttError(retryAfter: number): RateLimitedError {
  const error = new Error("voice_stt_rate_limited") as RateLimitedError;
  error.status = 429;
  error.retryAfter = retryAfter;
  return error;
}

/**
 * Отправить простой (не отформатированный) текст пользователю. Строки bot-i18n
 * — plain text, поэтому экранируем их под MarkdownV2 (parse_mode по умолчанию).
 */
async function replyText(chatId: number, plain: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(plain), keyboard });
}

function buildVoiceFallbackKeyboard(lang: HandlerCtx["session"]["lang"]): InlineKeyboard {
  return [
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ],
    [{ text: bt("btn_media_tips", lang), callback_data: CB.mediaTips }],
  ];
}

function buildVoiceUncertainKeyboard(lang: HandlerCtx["session"]["lang"]): InlineKeyboard {
  return [
    [{ text: bt("voice_correct_button", lang), callback_data: CB.voiceCorrect }],
    ...buildVoiceFallbackKeyboard(lang),
  ];
}

function estimateBase64DataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1).replace(/\s+/g, "");
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function sanitizeVoiceTranscriptPreview(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "ссылка скрыта")
    .replace(/@[A-Za-z0-9_]{3,}/g, "аккаунт скрыт")
    .replace(/\b(?:\d[\s-]?){4,}\b/g, "номер скрыт")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VOICE_TRANSCRIPT_PREVIEW_CHARS);
}

function buildVoiceTranscriptNote(
  transcript: string,
  lang: HandlerCtx["session"]["lang"],
): string | null {
  const preview = sanitizeVoiceTranscriptPreview(transcript);
  if (!preview) return null;

  if (lang === "uz") return `🎧 Ovozdan o'qidim:\n«${preview}»`;
  if (lang === "en") return `🎧 I heard this in the voice note:\n"${preview}"`;
  return `🎧 Я распознал голос:\n«${preview}»`;
}

async function sendVoiceTranscriptNote(ctx: HandlerCtx, transcript: string): Promise<void> {
  const note = buildVoiceTranscriptNote(transcript, ctx.session.lang);
  if (!note) return;
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(note),
    keyboard: [
      [{ text: bt("voice_correct_button", ctx.session.lang), callback_data: CB.voiceCorrect }],
    ],
  });
}

function normalizeVoiceIntentText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowSignalVoiceTranscript(transcript: string): boolean {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return true;

  const letters = text.match(/[a-zа-я]/gi)?.length ?? 0;
  if (letters < VOICE_LOW_SIGNAL_MIN_LETTERS) return true;

  if (
    /(неразборчив|не понял|не слышно|плохо слышно|невозможно разобрать|inaudible|unintelligible|cannot understand|can't understand)/.test(
      text,
    )
  ) {
    return true;
  }

  const words = text.match(/[a-zа-я']{2,}/gi) ?? [];
  const fillerWords = new Set([
    "ну",
    "ээ",
    "эм",
    "ага",
    "да",
    "нет",
    "вот",
    "ha",
    "yoq",
    "yo'q",
    "ana",
    "mana",
  ]);
  const meaningfulWords = words.filter((word) => !fillerWords.has(word));
  return meaningfulWords.length < VOICE_LOW_SIGNAL_MIN_MEANINGFUL_WORDS;
}

function classifyVoicePanicIntent(transcript: string): PanicScenarioId | null {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return null;

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?).{0,60}(смс|sms|otp|код|code)/.test(
      text,
    ) ||
    /(?:смс|sms|otp|код|code).{0,60}(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(yubor|jo'nat|jonat|ayt|ber|kirit).{0,60}(sms|kod|code|otp)/.test(
      text,
    ) ||
    /(?:sms|kod|code|otp).{0,60}(yubor|jo'nat|jonat|ayt|ber|kirit)/.test(text)
  ) {
    return 1;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(установил[аи]?|скачал[аи]?|запустил[аи]?|открыл[аи]?).{0,80}(apk|апк|приложени[ея])/.test(
      text,
    ) ||
    /(?:apk|апк|приложени[ея]).{0,80}(доступ к sms|доступ к смс|уведомлени|спец\.? возможност|accessibility)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(o'rnat|ornat|yukla|skachat|och|ishga tushir).{0,80}(apk|ilova|programma|app)/.test(
      text,
    ) ||
    /(?:apk|ilova|programma|app).{0,80}(o'rnat|ornat|yukla|skachat|och|smsga ruxsat|xabarnoma)/.test(
      text,
    )
  ) {
    return 2;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(перевел[аи]?|перевёл[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?).{0,80}(деньг|перевод|сум|сумов|uzs|кар[тд]|баланс)/.test(
      text,
    ) ||
    /(?:деньг|перевод|сум|сумов|uzs|кар[тд]|баланс).{0,80}(перевел[аи]?|перевёл[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?)/.test(
      text,
    ) ||
    /(?:pul|sum|som|uzs|karta|balans).{0,80}(yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad)/.test(
      text,
    ) ||
    /(?:yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad).{0,80}(pul|sum|som|uzs|karta|balans)/.test(
      text,
    )
  ) {
    return 3;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(ввел[аи]?|ввёл[аи]?|вбил[аи]?|указал[аи]?|назвал[аи]?|отправил[аи]?).{0,80}(карт[уы]|номер карты|cvv|cvc|срок карты|данные карты)/.test(
      text,
    ) ||
    /(?:karta|card|cvv|cvc|pin).{0,80}(kirit|ber|ayt|yubor|jo'nat|jonat)/.test(text) ||
    /(?:kirit|ber|ayt|yubor|jo'nat|jonat).{0,80}(karta|card|cvv|cvc|pin)/.test(text)
  ) {
    return 4;
  }

  if (
    /(?:потерял[аи]?|украли|взломали|угнали|забрали).{0,80}(telegram|телеграм|аккаунт)/.test(
      text,
    ) ||
    /(?:не могу|не получается).{0,40}(зайти|войти).{0,60}(telegram|телеграм)/.test(text) ||
    /(?:telegram|akkaunt|account).{0,80}(kira olmay|yo'qot|yoqot|o'g'ir|ogir|vzlom|hack)/.test(text)
  ) {
    return 5;
  }

  if (
    /(?:^|\s)(мне|нам)\s+(сейчас\s+)?звон(ят|ит)/.test(text) ||
    /(?:^|\s)(я|мы)\s+(сейчас\s+)?на звонке/.test(text) ||
    /не кладите трубку/.test(text) ||
    /(?:hozir|xozir).{0,50}(qo'ng'iroq|qongiroq|zvon|call)/.test(text) ||
    /(?:menga|bizga).{0,50}(qo'ng'iroq|qongiroq|zvon|call).{0,50}(qilyap|qilish|kel)/.test(text)
  ) {
    return 6;
  }

  return null;
}

async function sendVoicePanicRoute(ctx: HandlerCtx, panicId: PanicScenarioId): Promise<void> {
  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: withPanicContextData(previousScenarioData, panicId),
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildPanicScenarioText(panicId, ctx.session.lang)),
    keyboard: buildEmergencyFollowUpKeyboard(ctx.session.lang, panicId),
  });
}

function isQrFocusedResult(result: RunCheckResult): boolean {
  if (!result.reasons.includes("asks_to_scan_qr")) return false;

  const strongerImmediateReasons = new Set([
    "asks_for_otp",
    "asks_for_sms_code",
    "asks_for_card_cvv",
    "asks_for_pin",
    "asks_to_install_apk",
    "apk_download_link",
    "asks_to_transfer_to_safe_account",
    "payment_before_service",
    "fake_delivery_payment",
    "requests_card_digits",
    "brand_impersonation",
    "weird_domain",
    "hosted_app_platform",
  ]);
  if (result.reasons.some((reason) => strongerImmediateReasons.has(reason))) return false;

  const context = `${result.type}\n${result.display}\n${result.explanation ?? ""}`;
  if (!/QR (?:прочитан|decoded)|Decoded QR|Telegram login QR|token hidden/i.test(context)) {
    return false;
  }
  return /Telegram login QR|token hidden|2FA|authenticator|QR[^.\n]{0,80}(вход|подключ|login|device)|(?:вход|подключ)[^.\n]{0,80}QR/i.test(
    context,
  );
}

function shouldAutoSendGuardianIntro(result: RunCheckResult): boolean {
  return !isQrFocusedResult(result);
}

/** Отправить отформатированный результат проверки (текст + inline-кнопки). */
async function sendCheckResult(ctx: HandlerCtx, result: RunCheckResult): Promise<void> {
  const formatted = formatCheckResult(result, ctx.session.lang);
  const lastCheck = buildLastCheckSnapshot(result);
  const guardian = buildGuardianAngelSnapshot(result);
  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;

  await sendMessage({ chatId: ctx.chatId, text: formatted.text, keyboard: formatted.keyboard });
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {
      ...previousScenarioData,
      lastCheck,
      ...(guardian ? { guardian } : {}),
    },
  });

  if (guardian && shouldAutoSendGuardianIntro(result)) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildGuardianAngelIntro(guardian, ctx.session.lang)),
      keyboard: buildGuardianAngelKeyboard(ctx.session.lang, guardian),
    });
  }
}

async function replyImageOcrFailed(ctx: HandlerCtx, mediaGroupId?: string): Promise<void> {
  const reply = nextOcrFallbackReply(ctx.userId, mediaGroupId);
  if (reply === "suppress") return;

  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;
  await replyText(
    ctx.chatId,
    bt(reply === "short" ? "ocr_failed_repeat" : "ocr_failed", ctx.session.lang),
    buildImageTriageKeyboard(ctx.session.lang),
  );
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {
      ...previousScenarioData,
      lastCheck: buildImageUnreadableSnapshot(),
    },
  });
}

/**
 * Показать индикатор «печатает…» ТОЛЬКО если работа длится дольше 3 секунд
 * (R18.2): таймер ставится до старта, при завершении до порога — снимается, и
 * лишний `sendChatAction` не отправляется. `sendChatAction` — best-effort.
 */
async function withTypingIndicator<T>(
  chatId: number,
  work: () => Promise<T>,
  options: { delayMs?: number; repeatMs?: number } = {},
): Promise<T> {
  const delayMs = options.delayMs ?? TYPING_DELAY_MS;
  let interval: ReturnType<typeof setInterval> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    void sendChatAction(chatId, "typing");
    if (options.repeatMs !== undefined && options.repeatMs > 0) {
      interval = setInterval(() => {
        void sendChatAction(chatId, "typing");
      }, options.repeatMs);
    }
  }, delayMs);
  try {
    return await work();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (interval !== undefined) clearInterval(interval);
  }
}

/**
 * Общая обёртка обработки ошибок: rate-limit → дружелюбное сообщение о лимите
 * (R10.2), любая другая ошибка → лог без Sensitive_Data + общая подсказка
 * (R11.3). Никогда не оставляет запрос без ответа.
 */
async function guarded(ctx: HandlerCtx, label: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (e) {
    if (isRateLimitedError(e)) {
      const key =
        e.message === "voice_stt_rate_limited" ? "voice_stt_limit_reached" : "rate_limited";
      await replyText(ctx.chatId, bt(key, ctx.session.lang, { seconds: e.retryAfter }));
      return;
    }
    console.error(`telegram ${label} failed`, e instanceof Error ? e.message : "unknown");
    await replyText(ctx.chatId, bt("generic_error", ctx.session.lang));
  }
}

/**
 * Свободный текст / пересланный текст → Check_Pipeline (R4.1, R4.2, R4.7, R11.5).
 *
 * Идентичность исходного отправителя пересланного сообщения уже исключена
 * роутером (в `content` попадает только текст), поэтому здесь спец-обработки
 * forward не требуется. Ввод длиннее 2000 символов отклоняется с понятным
 * сообщением на текущем языке (R4.10); пустой ввод — подсказка о поддерживаемых
 * типах (R16.1).
 */
export async function handleCheck(
  content: string,
  ctx: HandlerCtx,
  source?: TelegramForwardSourceContext,
): Promise<void> {
  const startedAt = Date.now();
  const lang = ctx.session.lang;
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    await replyText(ctx.chatId, bt("unsupported_input", lang));
    return;
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    // R4.10 — отклоняем слишком длинный ввод вместо передачи невалидного запроса.
    await replyText(ctx.chatId, bt("text_too_long", lang));
    return;
  }

  const emergencyFollowUp = classifyEmergencyFollowUp(trimmed, ctx.session.scenarioData);
  if (emergencyFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildEmergencyFollowUpText(emergencyFollowUp.action, emergencyFollowUp.panicId, lang),
      ),
      keyboard: buildEmergencyFollowUpKeyboard(lang, emergencyFollowUp.panicId, {
        includeVoice: true,
        voiceAction: emergencyFollowUp.action,
      }),
    });
    return;
  }

  const guardianFollowUp = classifyGuardianAngelFollowUp(trimmed, ctx.session.scenarioData);
  if (guardianFollowUp !== null && ctx.session.scenarioData.guardian) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildGuardianAngelText(guardianFollowUp, ctx.session.scenarioData.guardian, lang),
      ),
      keyboard: buildGuardianAngelKeyboard(lang, ctx.session.scenarioData.guardian),
    });
    return;
  }

  const lastCheckFollowUp = classifyLastCheckFollowUp(trimmed, ctx.session.scenarioData);
  if (lastCheckFollowUp !== null && ctx.session.scenarioData.lastCheck) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildLastCheckFollowUpText(lastCheckFollowUp, ctx.session.scenarioData.lastCheck, lang),
      ),
    });
    return;
  }

  const orphanFollowUp = classifyOrphanCheckFollowUp(trimmed);
  if (orphanFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildOrphanCheckFollowUpText(orphanFollowUp, lang)),
    });
    return;
  }

  await guarded(ctx, "handleCheck", async () => {
    const rateLimitKey = rateLimitKeyFor(ctx.userId);
    const publicPostStartedAt = Date.now();
    const publicPostEvidence = await buildTelegramPublicPostCheckEvidence(trimmed, rateLimitKey);
    logTelegramTiming("check.public_post_evidence", publicPostStartedAt, {
      hasEvidence: publicPostEvidence !== null,
    });

    const checkStartedAt = Date.now();
    const result = await withTypingIndicator(ctx.chatId, async () => {
      const checked = await runCheck({
        input: publicPostEvidence?.checkInput ?? trimmed,
        type: publicPostEvidence ? "text" : undefined,
        lang,
        rateLimitKey,
        channel: CHANNEL,
        ...TELEGRAM_AI_EXPLANATION_OPTIONS,
      });
      logTelegramTiming("check.run_check", checkStartedAt, {
        type: checked.type,
        level: checked.level,
        reasonCount: checked.reasons.length,
        hasPublicPostEvidence: publicPostEvidence !== null,
      });
      return checked;
    });
    const postResult = enrichTelegramPublicPostResult(result, publicPostEvidence, lang);
    const enrichmentStartedAt = Date.now();
    const enrichedMetadata = publicPostEvidence
      ? postResult
      : await enrichTelegramPublicMetadata(trimmed, postResult, lang);
    const enriched = publicPostEvidence
      ? enrichedMetadata
      : await enrichTelegramReputation(trimmed, enrichedMetadata, lang);
    logTelegramTiming("check.enrichment", enrichmentStartedAt, {
      publicPostEvidence: publicPostEvidence !== null,
      level: enriched.level,
      reasonCount: enriched.reasons.length,
    });
    await sendCheckResult(ctx, enrichForwardSourceContext(enriched, source, lang));
    logTelegramTiming("check.total", startedAt, {
      type: enriched.type,
      level: enriched.level,
      reasonCount: enriched.reasons.length,
      publicPostEvidence: publicPostEvidence !== null,
    });
  });
}

/**
 * Фото / документ-изображение → OCR → Check_Pipeline (R5.1–R5.6).
 *
 * Поток: getFile (метаданные) → проверка лимита 6 МБ ДО скачивания (R5.5) →
 * downloadFileAsDataUrl (ТОЛЬКО в память, без записи на диск/в БД/storage, R5.3)
 * → analyzeImageCore → runCheck. При `null`/пустом результате анализа — подсказка
 * прислать текст (R5.6); каждый вызов обрабатывает ровно одно изображение, т.е.
 * несколько фото обрабатываются по одному за раз (R16.3).
 */
export async function handleImage(
  fileId: string,
  ctx: HandlerCtx,
  mediaGroupId?: string,
  source?: TelegramForwardSourceContext,
): Promise<void> {
  const startedAt = Date.now();
  const lang = ctx.session.lang;

  await guarded(ctx, "handleImage", async () => {
    // 1) Метаданные файла — позволяют отклонить превышение лимита ДО скачивания.
    const getFileStartedAt = Date.now();
    const meta = await getFile(fileId);
    logTelegramTiming("image.get_file", getFileStartedAt, {
      hasMeta: Boolean(meta),
      fileSizeBytes: meta?.fileSize ?? null,
      mediaGroup: mediaGroupId !== undefined,
    });
    if (!meta) {
      await replyImageOcrFailed(ctx, mediaGroupId);
      return;
    }
    if (meta.fileSize > MAX_IMAGE_BYTES) {
      await replyText(ctx.chatId, bt("image_too_large", lang)); // R5.5
      return;
    }

    // OCR + проверка могут быть медленными → общий индикатор «печатает…» (R18.2).
    const outcome = await withTypingIndicator(ctx.chatId, async () => {
      // 2) Скачивание строго в память (без сохранения изображения, R5.3).
      const downloadStartedAt = Date.now();
      const dataUrl = await downloadFileAsDataUrl(meta.filePath);
      logTelegramTiming("image.download", downloadStartedAt, {
        ok: dataUrl !== null,
        fileSizeBytes: meta.fileSize,
      });
      if (!dataUrl) return { kind: "ocr_failed" as const };

      // 3) Decode real QR pixels before AI evidence. This stays in memory and
      // never guesses QR contents when pixel decoding fails.
      const qrStartedAt = Date.now();
      const decodedQr = decodeQrFromDataUrl(dataUrl);
      logTelegramTiming("image.qr_decode", qrStartedAt, {
        qrCount: decodedQr.values.length,
      });

      // 4) If QR pixels already prove a login/payment/wallet flow, skip slower
      // visual AI. Plain URLs and menu QR codes still need image context.
      const decodedOnlyEvidence = buildDecodedQrOnlyImageEvidence(decodedQr);
      let evidence = decodedOnlyEvidence;
      if (decodedOnlyEvidence) {
        logTelegramTiming("image.analysis_skipped", Date.now(), {
          reason: "decoded_actionable_qr",
          visualCategory: decodedOnlyEvidence.visualCategory,
          qrPurpose: decodedOnlyEvidence.qr.purpose,
        });
      } else {
        // 5) Structured image evidence (OCR + visual category + QR purpose).
        const analysisStartedAt = Date.now();
        const aiEvidence = await analyzeImageCore(
          dataUrl,
          lang,
          rateLimitKeyFor(ctx.userId),
          TELEGRAM_IMAGE_ANALYSIS_OPTIONS,
        );
        logTelegramTiming("image.analysis", analysisStartedAt, {
          hasEvidence: Boolean(aiEvidence),
          visualCategory: aiEvidence?.visualCategory ?? null,
          qrPurpose: aiEvidence?.qr.purpose ?? null,
        });
        evidence =
          decodedQr.values.length > 0
            ? mergeDecodedQrEvidence(aiEvidence ?? fallbackImageIntelligence(null), decodedQr)
            : aiEvidence;
      }
      if (!evidence || !hasUsableImageEvidence(evidence)) return { kind: "ocr_failed" as const };

      const checkInput = buildImageCheckInput(evidence);
      if (checkInput.trim().length === 0) return { kind: "ocr_failed" as const };

      // 5) Тот же rules-first конвейер, что и для текста, но без второго AI:
      // explanation уже строится из структурированного image evidence.
      const checkStartedAt = Date.now();
      const result = await runCheck({
        input: checkInput,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
        skipAi: true,
        safeIfNoReasons: isBenignImageContext(evidence),
      });
      logTelegramTiming("image.run_check", checkStartedAt, {
        type: result.type,
        level: result.level,
        reasonCount: result.reasons.length,
      });
      return {
        kind: "ok" as const,
        result: {
          ...result,
          explanation: buildImageUserExplanation(evidence, result.level, lang),
        },
      };
    });

    if (outcome.kind === "ocr_failed") {
      await replyImageOcrFailed(ctx, mediaGroupId); // R5.6
      return;
    }
    const finalResult = enrichForwardSourceContext(outcome.result, source, lang);
    await sendCheckResult(ctx, finalResult);
    logTelegramTiming("image.total", startedAt, {
      type: finalResult.type,
      level: finalResult.level,
      reasonCount: finalResult.reasons.length,
      mediaGroup: mediaGroupId !== undefined,
    });
  });
}

export async function handleVoice(
  fileId: string,
  ctx: HandlerCtx,
  meta?: { fileSize?: number; duration?: number; mimeType?: string; fileUniqueId?: string },
): Promise<void> {
  const startedAt = Date.now();
  const lang = ctx.session.lang;

  await guarded(ctx, "handleVoice", async () => {
    const declaredSize = meta?.fileSize ?? 0;
    if (
      declaredSize > MAX_VOICE_BYTES ||
      (meta?.duration !== undefined && meta.duration > MAX_VOICE_DURATION_SEC)
    ) {
      await replyText(ctx.chatId, bt("voice_too_large", lang), buildVoiceFallbackKeyboard(lang));
      logTelegramTiming("voice.reject", startedAt, {
        reason: "metadata_limit",
        fileSizeBytes: declaredSize,
        durationSec: meta?.duration ?? null,
      });
      return;
    }

    const cachedTranscript = getCachedVoiceTranscript(ctx.userId, meta?.fileUniqueId);
    if (cachedTranscript) {
      await sendVoiceTranscriptNote(ctx, cachedTranscript);
      if (isLowSignalVoiceTranscript(cachedTranscript)) {
        await replyText(
          ctx.chatId,
          bt("voice_transcript_uncertain", lang),
          buildVoiceUncertainKeyboard(lang),
        );
        logTelegramTiming("voice.total", startedAt, {
          cached: true,
          lowSignal: true,
          transcriptChars: cachedTranscript.length,
          durationSec: meta?.duration ?? null,
        });
        return;
      }
      const panicId = classifyVoicePanicIntent(cachedTranscript);
      if (panicId !== null) {
        await sendVoicePanicRoute(ctx, panicId);
        logTelegramTiming("voice.total", startedAt, {
          cached: true,
          routedToPanic: panicId,
          transcriptChars: cachedTranscript.length,
          durationSec: meta?.duration ?? null,
        });
        return;
      }
      const checkStartedAt = Date.now();
      const result = await runCheck({
        input: cachedTranscript,
        type: "text",
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
        ...TELEGRAM_AI_EXPLANATION_OPTIONS,
      });
      logTelegramTiming("voice.run_check", checkStartedAt, {
        cached: true,
        type: result.type,
        level: result.level,
        reasonCount: result.reasons.length,
      });
      await sendCheckResult(ctx, result);
      logTelegramTiming("voice.total", startedAt, {
        cached: true,
        type: result.type,
        level: result.level,
        reasonCount: result.reasons.length,
        transcriptChars: cachedTranscript.length,
        durationSec: meta?.duration ?? null,
      });
      return;
    }

    const getFileStartedAt = Date.now();
    const fileMeta = await getFile(fileId);
    logTelegramTiming("voice.get_file", getFileStartedAt, {
      hasMeta: Boolean(fileMeta),
      fileSizeBytes: fileMeta?.fileSize ?? declaredSize,
      durationSec: meta?.duration ?? null,
      mimeType: meta?.mimeType ?? null,
    });
    if (!fileMeta) {
      await replyText(
        ctx.chatId,
        bt("voice_transcription_failed", lang),
        buildVoiceFallbackKeyboard(lang),
      );
      return;
    }

    const fileSize = fileMeta.fileSize || declaredSize;
    if (fileSize > MAX_VOICE_BYTES) {
      await replyText(ctx.chatId, bt("voice_too_large", lang), buildVoiceFallbackKeyboard(lang));
      logTelegramTiming("voice.reject", startedAt, {
        reason: "file_size_limit",
        fileSizeBytes: fileSize,
        durationSec: meta?.duration ?? null,
      });
      return;
    }

    const budgetStartedAt = Date.now();
    await checkVoiceSttBudget(ctx.userId);
    logTelegramTiming("voice.budget", budgetStartedAt, {
      durationSec: meta?.duration ?? null,
    });
    await replyText(ctx.chatId, bt("voice_processing", lang));

    const outcome = await withTypingIndicator(
      ctx.chatId,
      async () => {
        const downloadStartedAt = Date.now();
        const dataUrl = await downloadFileAsDataUrl(fileMeta.filePath);
        logTelegramTiming("voice.download", downloadStartedAt, {
          ok: dataUrl !== null,
          fileSizeBytes: fileSize,
          durationSec: meta?.duration ?? null,
        });
        if (!dataUrl) return { kind: "failed" as const };
        if (estimateBase64DataUrlBytes(dataUrl) > MAX_VOICE_BYTES) {
          return { kind: "too_large" as const };
        }

        const sttStartedAt = Date.now();
        const transcript = await transcribeVoiceCore(
          dataUrl,
          lang,
          rateLimitKeyFor(ctx.userId),
          TELEGRAM_VOICE_TRANSCRIBE_OPTIONS,
        );
        logTelegramTiming("voice.transcribe", sttStartedAt, {
          ok: Boolean(transcript.text),
          transcriptChars: transcript.text?.length ?? 0,
          durationSec: meta?.duration ?? null,
        });
        if (!transcript.text) return { kind: "failed" as const };
        rememberVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcript.text);
        await sendVoiceTranscriptNote(ctx, transcript.text);
        if (isLowSignalVoiceTranscript(transcript.text)) {
          return { kind: "uncertain" as const, transcriptChars: transcript.text.length };
        }
        const panicId = classifyVoicePanicIntent(transcript.text);
        if (panicId !== null) {
          return { kind: "panic" as const, panicId, transcriptChars: transcript.text.length };
        }

        const checkStartedAt = Date.now();
        const result = await runCheck({
          input: transcript.text,
          type: "text",
          lang,
          rateLimitKey: rateLimitKeyFor(ctx.userId),
          channel: CHANNEL,
          ...TELEGRAM_AI_EXPLANATION_OPTIONS,
        });
        logTelegramTiming("voice.run_check", checkStartedAt, {
          cached: false,
          type: result.type,
          level: result.level,
          reasonCount: result.reasons.length,
        });
        return { kind: "ok" as const, result, transcriptChars: transcript.text.length };
      },
      { delayMs: 500, repeatMs: 4000 },
    );

    if (outcome.kind === "failed") {
      await replyText(
        ctx.chatId,
        bt("voice_transcription_failed", lang),
        buildVoiceFallbackKeyboard(lang),
      );
      return;
    }
    if (outcome.kind === "too_large") {
      await replyText(ctx.chatId, bt("voice_too_large", lang), buildVoiceFallbackKeyboard(lang));
      logTelegramTiming("voice.reject", startedAt, {
        reason: "downloaded_size_limit",
        fileSizeBytes: fileSize,
        durationSec: meta?.duration ?? null,
      });
      return;
    }
    if (outcome.kind === "panic") {
      await sendVoicePanicRoute(ctx, outcome.panicId);
      logTelegramTiming("voice.total", startedAt, {
        cached: false,
        routedToPanic: outcome.panicId,
        transcriptChars: outcome.transcriptChars,
        durationSec: meta?.duration ?? null,
      });
      return;
    }
    if (outcome.kind === "uncertain") {
      await replyText(
        ctx.chatId,
        bt("voice_transcript_uncertain", lang),
        buildVoiceUncertainKeyboard(lang),
      );
      logTelegramTiming("voice.total", startedAt, {
        cached: false,
        lowSignal: true,
        transcriptChars: outcome.transcriptChars,
        durationSec: meta?.duration ?? null,
      });
      return;
    }

    await sendCheckResult(ctx, outcome.result);
    logTelegramTiming("voice.total", startedAt, {
      cached: false,
      type: outcome.result.type,
      level: outcome.result.level,
      reasonCount: outcome.result.reasons.length,
      transcriptChars: outcome.transcriptChars,
      durationSec: meta?.duration ?? null,
    });
  });
}

/**
 * Карточка контакта → проверка номера как `phone` (R21.1–R21.4).
 *
 * В ядро передаётся только номер; имя и прочие поля карточки сюда роутером не
 * передаются и здесь не сохраняются/не логируются (R21.3). normalize/mask/hash
 * применяются внутри ядра как к обычному номеру (R21.2). Пустой номер → подсказка
 * прислать номер текстом (R21.4).
 */
export async function handlePhoneFromContact(phone: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const trimmed = phone.trim();

  if (trimmed.length === 0) {
    await replyText(ctx.chatId, bt("contact_no_number", lang)); // R21.4
    return;
  }

  await guarded(ctx, "handlePhoneFromContact", async () => {
    const result = await withTypingIndicator(ctx.chatId, () =>
      runCheck({
        input: trimmed,
        type: "phone", // R21.1 — ввод типа phone
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
        ...TELEGRAM_AI_EXPLANATION_OPTIONS,
      }),
    );
    await sendCheckResult(ctx, result);
  });
}
