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

/** Через сколько мс ожидания показывать индикатор «печатает…» (R18.2). */
const TYPING_DELAY_MS = 3000;

const MEDIA_GROUP_FALLBACK_TTL_MS = 30_000;
const IMAGE_OCR_REPEAT_TTL_MS = 45_000;
const mediaGroupOcrFallbacks = new Map<string, number>();
const recentImageOcrFallbacks = new Map<number, number>();
const voiceTranscriptCache = new Map<string, { text: string; cachedAt: number }>();

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
  const error = new Error("rate_limited") as RateLimitedError;
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

async function sendVoiceTranscriptNote(
  ctx: HandlerCtx,
  transcript: string,
): Promise<void> {
  const note = buildVoiceTranscriptNote(transcript, ctx.session.lang);
  if (!note) return;
  await sendMessage({ chatId: ctx.chatId, text: escapeMarkdownV2(note) });
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
      keyboard: buildGuardianAngelKeyboard(ctx.session.lang),
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
async function withTypingIndicator<T>(chatId: number, work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    void sendChatAction(chatId, "typing");
  }, TYPING_DELAY_MS);
  try {
    return await work();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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
      await replyText(ctx.chatId, bt("rate_limited", ctx.session.lang, { seconds: e.retryAfter }));
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
        includeVoice: emergencyFollowUp.action !== "script",
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
      keyboard: buildGuardianAngelKeyboard(lang),
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
    const publicPostEvidence = await buildTelegramPublicPostCheckEvidence(trimmed, rateLimitKey);
    const result = await withTypingIndicator(ctx.chatId, () =>
      runCheck({
        input: publicPostEvidence?.checkInput ?? trimmed,
        type: publicPostEvidence ? "text" : undefined,
        lang,
        rateLimitKey,
        channel: CHANNEL,
      }),
    );
    const postResult = enrichTelegramPublicPostResult(result, publicPostEvidence, lang);
    const enrichedMetadata = publicPostEvidence
      ? postResult
      : await enrichTelegramPublicMetadata(trimmed, postResult, lang);
    const enriched = publicPostEvidence
      ? enrichedMetadata
      : await enrichTelegramReputation(trimmed, enrichedMetadata, lang);
    await sendCheckResult(ctx, enrichForwardSourceContext(enriched, source, lang));
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
  const lang = ctx.session.lang;

  await guarded(ctx, "handleImage", async () => {
    // 1) Метаданные файла — позволяют отклонить превышение лимита ДО скачивания.
    const meta = await getFile(fileId);
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
      const dataUrl = await downloadFileAsDataUrl(meta.filePath);
      if (!dataUrl) return { kind: "ocr_failed" as const };

      // 3) Decode real QR pixels before AI evidence. This stays in memory and
      // never guesses QR contents when pixel decoding fails.
      const decodedQr = decodeQrFromDataUrl(dataUrl);

      // 4) Structured image evidence (OCR + visual category + QR purpose).
      const aiEvidence = await analyzeImageCore(dataUrl, lang, rateLimitKeyFor(ctx.userId));
      const evidence =
        decodedQr.values.length > 0
          ? mergeDecodedQrEvidence(aiEvidence ?? fallbackImageIntelligence(null), decodedQr)
          : aiEvidence;
      if (!evidence || !hasUsableImageEvidence(evidence)) return { kind: "ocr_failed" as const };

      const checkInput = buildImageCheckInput(evidence);
      if (checkInput.trim().length === 0) return { kind: "ocr_failed" as const };

      // 5) Тот же rules-first конвейер, что и для текста, но без второго AI:
      // explanation уже строится из структурированного image evidence.
      const result = await runCheck({
        input: checkInput,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
        skipAi: true,
        safeIfNoReasons: isBenignImageContext(evidence),
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
    await sendCheckResult(ctx, enrichForwardSourceContext(outcome.result, source, lang));
  });
}

export async function handleVoice(
  fileId: string,
  ctx: HandlerCtx,
  meta?: { fileSize?: number; duration?: number; mimeType?: string; fileUniqueId?: string },
): Promise<void> {
  const lang = ctx.session.lang;

  await guarded(ctx, "handleVoice", async () => {
    const declaredSize = meta?.fileSize ?? 0;
    if (
      declaredSize > MAX_VOICE_BYTES ||
      (meta?.duration !== undefined && meta.duration > MAX_VOICE_DURATION_SEC)
    ) {
      await replyText(ctx.chatId, bt("voice_too_large", lang), buildVoiceFallbackKeyboard(lang));
      return;
    }

    const cachedTranscript = getCachedVoiceTranscript(ctx.userId, meta?.fileUniqueId);
    if (cachedTranscript) {
      await sendVoiceTranscriptNote(ctx, cachedTranscript);
      const result = await runCheck({
        input: cachedTranscript,
        type: "text",
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      });
      await sendCheckResult(ctx, result);
      return;
    }

    const fileMeta = await getFile(fileId);
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
      return;
    }

    await checkVoiceSttBudget(ctx.userId);

    const outcome = await withTypingIndicator(ctx.chatId, async () => {
      const dataUrl = await downloadFileAsDataUrl(fileMeta.filePath);
      if (!dataUrl) return { kind: "failed" as const };
      if (estimateBase64DataUrlBytes(dataUrl) > MAX_VOICE_BYTES) {
        return { kind: "too_large" as const };
      }

      const transcript = await transcribeVoiceCore(dataUrl, lang, rateLimitKeyFor(ctx.userId));
      if (!transcript.text) return { kind: "failed" as const };
      rememberVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcript.text);
      await sendVoiceTranscriptNote(ctx, transcript.text);

      const result = await runCheck({
        input: transcript.text,
        type: "text",
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      });
      return { kind: "ok" as const, result };
    });

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
      return;
    }

    await sendCheckResult(ctx, outcome.result);
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
      }),
    );
    await sendCheckResult(ctx, result);
  });
}
