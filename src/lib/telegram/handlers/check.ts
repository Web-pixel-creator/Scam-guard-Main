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
import { createHash } from "node:crypto";

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
import type { HandlerCtx, ImageRouteMediaKind } from "@/lib/telegram/router";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { saveSession, withSessionChatScope } from "@/lib/telegram/session.server";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
  asLiveCallContext,
  buildPanicScenarioText,
  hasRecentEmergencyContext,
  withPanicContextData,
  type LiveCallContext,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";
import {
  buildAcknowledgementFollowUpText,
  buildLastCheckFollowUpText,
  buildOrphanCheckFollowUpText,
  buildImageUnreadableSnapshot,
  buildLastCheckSnapshot,
  classifyAcknowledgementFollowUp,
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
  isEvidenceBackedBenignImageContext,
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
import {
  buildVictimIntentKeyboard,
  buildVictimIntentText,
  classifyVictimIntent,
  type VictimIntentMatch,
} from "@/lib/telegram/victim-intent";

/** Канал бота — только для аналитики/логов, не влияет на scoring (design.md). */
const CHANNEL = "telegram" as const;

/** Максимальная длина текстового ввода Check_Pipeline (R4.10). */
const MAX_TEXT_LENGTH = 2000;

/** Верхний предел размера скачиваемого изображения: 6 МБ (R5.5). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_DOWNLOAD_RATE_LIMIT = 10;
const IMAGE_DOWNLOAD_RATE_WINDOW_MS = 60_000;
const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const MAX_VOICE_DURATION_SEC = 60;
const VOICE_STT_DAILY_LIMIT = 5;
const VOICE_STT_WINDOW_MS = 24 * 60 * 60 * 1000;

function shouldVictimIntentOverrideFollowUps(match: VictimIntentMatch): boolean {
  return match.askedContext !== undefined;
}

function shouldVictimIntentOverridePanic(match: VictimIntentMatch): boolean {
  return match.kind === "friend_money";
}
const VOICE_TRANSCRIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VOICE_TRANSCRIPT_PREVIEW_CHARS = 180;
const VOICE_HOOK_PREVIEW_CHARS = 120;
const VOICE_LOW_SIGNAL_MIN_LETTERS = 6;
const VOICE_LOW_SIGNAL_MIN_MEANINGFUL_WORDS = 2;

/** Через сколько мс ожидания показывать индикатор «печатает…» (R18.2). */
const TYPING_DELAY_MS = 3000;
const CHECK_PROCESSING_DELAY_MS = readBoundedIntEnv(
  "TELEGRAM_CHECK_PROCESSING_DELAY_MS",
  900,
  100,
  5_000,
);
const CHECK_RESULT_CACHE_TTL_MS = readBoundedIntEnv(
  "TELEGRAM_CHECK_CACHE_TTL_MS",
  60_000,
  5_000,
  10 * 60_000,
);
const CHECK_RESULT_CACHE_MAX_ENTRIES = readBoundedIntEnv(
  "TELEGRAM_CHECK_CACHE_MAX_ENTRIES",
  500,
  50,
  10_000,
);
const VOICE_TRANSCRIPT_CACHE_MAX_ENTRIES = readBoundedIntEnv(
  "TELEGRAM_VOICE_TRANSCRIPT_CACHE_MAX_ENTRIES",
  500,
  50,
  10_000,
);
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
const MEDIA_GROUP_FALLBACK_MAX_ENTRIES = 500;
const IMAGE_OCR_REPEAT_MAX_ENTRIES = 500;
type VoiceMeta = {
  fileSize?: number;
  duration?: number;
  mimeType?: string;
  fileUniqueId?: string;
  fileName?: string;
  caption?: string;
};
type VoiceTranscriptWorkResult =
  | { kind: "ok"; text: string }
  | { kind: "failed" }
  | { kind: "too_large" };
type CheckResultCacheEntry = {
  result: RunCheckResult;
  cachedAt: number;
};
type CheckResultInFlightEntry = {
  work: Promise<RunCheckResult>;
  startedAt: number;
};
const mediaGroupOcrFallbacks = new Map<string, number>();
const recentImageOcrFallbacks = new Map<number, number>();
const voiceTranscriptCache = new Map<string, { text: string; cachedAt: number }>();
const voiceTranscriptInFlight = new Map<string, Promise<VoiceTranscriptWorkResult>>();
const checkResultCache = new Map<string, CheckResultCacheEntry>();
const checkResultInFlight = new Map<string, CheckResultInFlightEntry>();

export function __resetTelegramCheckCachesForTests(): void {
  mediaGroupOcrFallbacks.clear();
  recentImageOcrFallbacks.clear();
  voiceTranscriptCache.clear();
  voiceTranscriptInFlight.clear();
  checkResultCache.clear();
  checkResultInFlight.clear();
}

export function __telegramCheckCacheStatsForTests(): {
  checkResultMaxEntries: number;
  checkResultSize: number;
  voiceTranscriptMaxEntries: number;
  voiceTranscriptSize: number;
} {
  return {
    checkResultMaxEntries: CHECK_RESULT_CACHE_MAX_ENTRIES,
    checkResultSize: checkResultCache.size,
    voiceTranscriptMaxEntries: VOICE_TRANSCRIPT_CACHE_MAX_ENTRIES,
    voiceTranscriptSize: voiceTranscriptCache.size,
  };
}

function readBoundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function pruneOldestEntries<K, V>(map: Map<K, V>, maxEntries: number): void {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey === undefined) return;
    map.delete(oldestKey);
  }
}

/** Ключ rate-limit бота ВСЕГДА основан на telegram_user_id (R10.1, R10.3). */
function rateLimitKeyFor(userId: number): string {
  return `tg:${userId}`;
}

function imageDownloadBudgetKey(userId: number): string {
  return `telegram-image:${rateLimitKeyFor(userId)}`;
}

function normalizeCheckCacheInput(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildCheckResultCacheKey(params: {
  userId: number;
  lang: string;
  input: string;
  type?: string;
  publicPost: boolean;
}): string {
  return createHash("sha256")
    .update(String(params.userId))
    .update("\0")
    .update(params.lang)
    .update("\0")
    .update(params.type ?? "auto")
    .update("\0")
    .update(params.publicPost ? "public-post" : "direct")
    .update("\0")
    .update(normalizeCheckCacheInput(params.input))
    .digest("hex");
}

function pruneCheckResultCache(now = Date.now()): void {
  for (const [key, value] of checkResultCache) {
    if (now - value.cachedAt > CHECK_RESULT_CACHE_TTL_MS) {
      checkResultCache.delete(key);
    }
  }
}

function pruneCheckResultInFlight(now = Date.now()): void {
  for (const [key, value] of checkResultInFlight) {
    if (now - value.startedAt > CHECK_RESULT_CACHE_TTL_MS) {
      checkResultInFlight.delete(key);
    }
  }
}

function getCachedCheckResult(key: string, now = Date.now()): RunCheckResult | null {
  pruneCheckResultCache(now);
  const cached = checkResultCache.get(key);
  if (!cached) return null;
  if (now - cached.cachedAt > CHECK_RESULT_CACHE_TTL_MS) {
    checkResultCache.delete(key);
    return null;
  }
  return cached.result;
}

function rememberCheckResult(key: string, result: RunCheckResult, now = Date.now()): void {
  pruneCheckResultCache(now);
  checkResultCache.set(key, { result, cachedAt: now });
  pruneOldestEntries(checkResultCache, CHECK_RESULT_CACHE_MAX_ENTRIES);
}

function getInFlightCheckResult(key: string, now = Date.now()): Promise<RunCheckResult> | null {
  pruneCheckResultInFlight(now);
  return checkResultInFlight.get(key)?.work ?? null;
}

function rememberInFlightCheckResult(key: string, work: Promise<RunCheckResult>): void {
  checkResultInFlight.set(key, { work, startedAt: Date.now() });
  pruneOldestEntries(checkResultInFlight, CHECK_RESULT_CACHE_MAX_ENTRIES);
  void work
    .finally(() => {
      if (checkResultInFlight.get(key)?.work === work) {
        checkResultInFlight.delete(key);
      }
    })
    .catch(() => undefined);
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
  pruneOldestEntries(voiceTranscriptCache, VOICE_TRANSCRIPT_CACHE_MAX_ENTRIES);
}

function getInFlightVoiceTranscript(
  userId: number,
  fileUniqueId?: string,
): Promise<VoiceTranscriptWorkResult> | null {
  const key = voiceCacheKey(userId, fileUniqueId);
  return key ? (voiceTranscriptInFlight.get(key) ?? null) : null;
}

function rememberInFlightVoiceTranscript(
  userId: number,
  fileUniqueId: string | undefined,
  work: Promise<VoiceTranscriptWorkResult>,
): void {
  const key = voiceCacheKey(userId, fileUniqueId);
  if (!key) return;

  voiceTranscriptInFlight.set(key, work);
  pruneOldestEntries(voiceTranscriptInFlight, VOICE_TRANSCRIPT_CACHE_MAX_ENTRIES);
  void work
    .finally(() => {
      if (voiceTranscriptInFlight.get(key) === work) {
        voiceTranscriptInFlight.delete(key);
      }
    })
    .catch(() => undefined);
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

async function checkImageDownloadBudget(userId: number): Promise<void> {
  const result = await checkSharedRateLimit(
    "check",
    imageDownloadBudgetKey(userId),
    IMAGE_DOWNLOAD_RATE_LIMIT,
    IMAGE_DOWNLOAD_RATE_WINDOW_MS,
  );
  if (!result.ok) {
    throw rateLimitedCheckError(result.retryAfterSec);
  }
}

function pruneOcrFallbackMemory(now = Date.now()): void {
  for (const [key, timestamp] of mediaGroupOcrFallbacks) {
    if (now - timestamp > MEDIA_GROUP_FALLBACK_TTL_MS) mediaGroupOcrFallbacks.delete(key);
  }
  for (const [userId, timestamp] of recentImageOcrFallbacks) {
    if (now - timestamp > IMAGE_OCR_REPEAT_TTL_MS) recentImageOcrFallbacks.delete(userId);
  }
  pruneOldestEntries(mediaGroupOcrFallbacks, MEDIA_GROUP_FALLBACK_MAX_ENTRIES);
  pruneOldestEntries(recentImageOcrFallbacks, IMAGE_OCR_REPEAT_MAX_ENTRIES);
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
    pruneOldestEntries(mediaGroupOcrFallbacks, MEDIA_GROUP_FALLBACK_MAX_ENTRIES);
    recentImageOcrFallbacks.set(userId, now);
    pruneOldestEntries(recentImageOcrFallbacks, IMAGE_OCR_REPEAT_MAX_ENTRIES);
    return previous !== undefined && now - previous <= MEDIA_GROUP_FALLBACK_TTL_MS
      ? "suppress"
      : "long";
  }

  const previous = recentImageOcrFallbacks.get(userId);
  recentImageOcrFallbacks.set(userId, now);
  pruneOldestEntries(recentImageOcrFallbacks, IMAGE_OCR_REPEAT_MAX_ENTRIES);
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

function rateLimitedCheckError(retryAfter: number): RateLimitedError {
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

function buildVoiceUncertainKeyboard(lang: HandlerCtx["session"]["lang"]): InlineKeyboard {
  return [
    [{ text: bt("voice_correct_button", lang), callback_data: CB.voiceCorrect }],
    ...buildVoiceFallbackKeyboard(lang),
  ];
}

function buildVoiceNegatedDoneKeyboard(lang: HandlerCtx["session"]["lang"]): InlineKeyboard {
  return [
    [{ text: bt("voice_correct_button", lang), callback_data: CB.voiceCorrect }],
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ],
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
  const sanitized = text
    .normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "ссылка скрыта")
    .replace(/@[A-Za-z0-9_]{3,}/g, "аккаунт скрыт")
    .replace(/\b(?:\d[\s-]?){4,}\b/g, "номер скрыт")
    .replace(/\s+/g, " ")
    .trim();

  return trimTextPreviewAtWordBoundary(sanitized, VOICE_TRANSCRIPT_PREVIEW_CHARS);
}

function cleanAudioMetadataText(value: string | undefined): string | null {
  const text = value
    ?.normalize("NFKC")
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.(?:mp3|m4a|ogg|oga|opus|wav|webm|aac|flac)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length < 8) return null;

  const letters = text.match(/[a-zа-я]/gi)?.length ?? 0;
  if (letters < 6) return null;
  return text;
}

function trimTextPreviewAtWordBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const clipped = text.slice(0, maxChars - 1).trimEnd();
  const wordBoundary = clipped.replace(/\s+\S*$/u, "").trimEnd();
  const base = wordBoundary.length >= Math.floor(maxChars * 0.6) ? wordBoundary : clipped;
  return `${base}…`;
}

const VOICE_HOOK_KEYWORD_RE =
  /(sms|otp|код|code|verification|cvv|cvc|pin|apk|карта|картой|card|перевод|перевести|transfer|оплат|payment|pay|доставк|посылк|delivery|courier|qr|telegram|банк|bank|кошел|wallet|karta|to['’]?lov|o['’]?tkaz|pul|kod|havola|ilova)/i;

function extractVoiceMetadataFallbackText(meta?: VoiceMeta): string | null {
  const candidates = [meta?.caption, meta?.fileName]
    .map(cleanAudioMetadataText)
    .filter((value): value is string => Boolean(value));
  return candidates.find((value) => VOICE_HOOK_KEYWORD_RE.test(value)) ?? null;
}

function trimVoiceHookPhrase(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= VOICE_HOOK_PREVIEW_CHARS) return trimmed;
  return `${trimmed.slice(0, VOICE_HOOK_PREVIEW_CHARS - 3).trimEnd()}...`;
}

function extractVoiceHookPhrase(transcript: string): string | null {
  const preview = sanitizeVoiceTranscriptPreview(transcript);
  if (!preview) return null;

  const candidates = preview
    .split(/(?:[.!?]\s+|[,;]\s+|\s+[–—-]\s+)/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8);
  const hook = candidates.find((part) => VOICE_HOOK_KEYWORD_RE.test(part)) ?? preview;
  return trimVoiceHookPhrase(hook);
}

function buildVoiceHookExplanation(
  transcript: string,
  lang: HandlerCtx["session"]["lang"],
): string | null {
  const hook = extractVoiceHookPhrase(transcript);
  if (!hook) return null;

  if (lang === "uz") {
    return `Ovozdan asosiy ibora: "${hook}". Men shu matnni odatiy xavf qoidalari bilan tekshirdim.`;
  }
  if (lang === "en") {
    return `Key phrase from the voice note: "${hook}". I checked that text through the normal risk rules.`;
  }
  return `Ключевая фраза из голосового: «${hook}». Я проверил этот текст обычными правилами риска.`;
}

function withVoiceHookExplanation(
  result: RunCheckResult,
  transcript: string,
  lang: HandlerCtx["session"]["lang"],
): RunCheckResult {
  if (result.reasons.length === 0) return result;

  const hook = buildVoiceHookExplanation(transcript, lang);
  if (!hook) return result;
  return {
    ...result,
    explanation: result.explanation ? `${hook}\n${result.explanation}` : hook,
  };
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

async function sendVoiceMetadataFallbackNote(ctx: HandlerCtx, text: string): Promise<void> {
  const preview = sanitizeVoiceTranscriptPreview(text);
  if (!preview) return;
  await replyText(
    ctx.chatId,
    bt("voice_metadata_fallback_note", ctx.session.lang, { text: preview }),
    buildVoiceUncertainKeyboard(ctx.session.lang),
  );
}

function normalizeVoiceIntentText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ўӯ]/g, "у")
    .replace(/қ/g, "к")
    .replace(/ғ/g, "г")
    .replace(/ҳ/g, "х")
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

const NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:не|net|yo'q|yoq)\s+(?:уже\s+)?(?:отправил[аи]?|отправлял[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|установил[аи]?|поставил[аи]?|скачал[аи]?|запустил[аи]?|открыл[аи]?|перевел[аи]?|перевёл[аи]?|оплатил[аи]?|пополнил[аи]?|ввел[аи]?|ввёл[аи]?|указал[аи]?|продиктовал[аи]?|отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|yubormadim|jo'natmadim|jonatmadim|aytmadim|bermadim|kiritmadim|o'rnatmadim|ornatmadim|yuklamadim|skaner\s+qilmadim|scan\s+qilmadim)/;
const UZ_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:yubormadim|yubarmadim|yub[oa]r\s+madim|jo'natmadim|jo'nat\s+madim|jonatmadim|jonat\s+madim|aytmadim|ayt\s+madim|bermadim|ber\s+madim|kiritmadim|kirit\s+madim|o'rnatmadim|o'rnat\s+madim|ornatmadim|ornat\s+madim|yuklamadim|yukla\s+madim|ochmadim|och\s+madim|o'tkazmadim|o'tkaz\s+madim|otkazmadim|otkaz\s+madim|to'lamadim|to'la\s+madim|tolamadim|tola\s+madim|tasdiqlamadim|tasdiqla\s+madim|ruxsat\s+bermadim|ruxsat\s+ber\s+madim|skaner\s+qilmadim|scan\s+qilmadim|yubormayman|yubarmayman|jo'natmayman|jonatmayman|aytmayman|bermayman|kiritmayman|o'rnatmayman|ornatmayman|yuklamayman|ochmayman|o'tkazmayman|otkazmayman|to'lamayman|tolamayman|tasdiqlamayman|ruxsat\s+bermayman|skaner\s+qilmayman|scan\s+qilmayman)(?=\s|[.!?,;:]|$)/;
const UZ_CYRILLIC_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:юбормадим|жунатмадим|айтмадим|бермадим|киритмадим|урнатмадим|юкламадим|очмадим|утказмадим|толамадим|сканер\s+килмадим|scan\s+килмадим|тасдикламадим)(?=\s|[.!?,;:]|$)/;
const EN_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:i|we)\s+(?:(?:have|did|do)\s+not|haven't|didn't|don't)\s+(?:already\s+)?(?:send|sent|share|shared|give|gave|given|tell|told|say|said|read|dictate|dictated|install|installed|download|downloaded|open|opened|allow|allowed|enable|enabled|transfer|transferred|pay|paid|top\s+up|topped\s+up|enter|entered|type|typed|scan|scanned|confirm|confirmed|approve|approved|link|linked)\b/;

function isNegatedVoiceDoneIntent(transcript: string): boolean {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return false;
  return (
    NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    UZ_NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    UZ_CYRILLIC_NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    EN_NEGATED_VOICE_DONE_INTENT_RE.test(text)
  );
}

function classifyVoicePanicIntent(transcript: string): PanicScenarioId | null {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return null;
  if (isNegatedVoiceDoneIntent(text)) return null;

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(?:назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|показал[аи]?|отправил[аи]?|дал[аи]?).{0,80}(cvv|cvc|pin|пин|код безопасности|три цифры|3 цифры|оборот[ае] карт|парол[ья]\s+от\s+(?:онлайн\s+)?банк)/.test(
      text,
    ) ||
    /(?:cvv|cvc|pin|пин|код безопасности|три цифры|3 цифры|оборот[ае] карт|парол[ья]\s+от\s+(?:онлайн\s+)?банк).{0,80}(назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|показал[аи]?|отправил[аи]?|дал[аи]?)/.test(
      text,
    ) ||
    /(?:kartaning|karta|card|cvv|cvc|pin|maxfiy\s+kod|uch\s+raqam|3\s+raqam).{0,80}(ayt|ber|yubor|jo'nat|jonat|ko'rsat|korsat)/.test(
      text,
    ) ||
    /(?:ayt|ber|yubor|jo'nat|jonat|ko'rsat|korsat).{0,80}(kartaning|karta|card|cvv|cvc|pin|maxfiy\s+kod|uch\s+raqam|3\s+raqam)/.test(
      text,
    ) ||
    /(?:карта|card|cvv|cvc|pin|пин|махфий\s+код|уч\s+ракам|3\s+ракам).{0,80}(айт|бер|юбор|жунат|курсат|кирит)/.test(
      text,
    ) ||
    /(?:айт|бер|юбор|жунат|курсат|кирит).{0,80}(карта|card|cvv|cvc|pin|пин|махфий\s+код|уч\s+ракам|3\s+ракам)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:gave|given|shared|sent|said|told|read|dictated|entered|typed|showed).{0,80}(?:cvv|cvc|pin|security\s+code|three\s+digits|3\s+digits|back\s+of\s+(?:the\s+|my\s+)?card|card\s+number|card\s+details|expiry|expiration|online\s+bank\s+password|bank\s+password)/.test(
      text,
    ) ||
    /(?:cvv|cvc|pin|security\s+code|three\s+digits|3\s+digits|back\s+of\s+(?:the\s+|my\s+)?card|card\s+number|card\s+details|expiry|expiration|online\s+bank\s+password|bank\s+password).{0,80}(?:gave|given|shared|sent|said|told|read|dictated|entered|typed|showed)/.test(
      text,
    )
  ) {
    return 4;
  }

  if (
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed).{0,80}(?:telegram|tg).{0,80}(?:qr|login|log\s+in|device|code)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed).{0,80}(?:qr|login|log\s+in|device|code).{0,80}(?:telegram|tg)/.test(
      text,
    ) ||
    /(?:telegram|tg).{0,80}(?:qr|login|log\s+in|device|code).{0,80}(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed)/.test(
      text,
    ) ||
    /(?:telegram|tg|телеграм).{0,80}(?:qr|куар|код|логин|кириш|устройств).{0,80}(?:сканер|scan|тасдик|улаш|богла|кирит|рухсат)/.test(
      text,
    ) ||
    /(?:сканер|scan|тасдик|улаш|богла|кирит|рухсат).{0,80}(?:telegram|tg|телеграм).{0,80}(?:qr|куар|код|логин|кириш|устройств)/.test(
      text,
    )
  ) {
    return 5;
  }

  if (
    /(?:ilova|programma|app|apk|anydesk|teamviewer|rustdesk).{0,100}(?:smsga|sms|xabarnoma|bildirishnoma|ekran|ruxsat)/.test(
      text,
    ) ||
    /(?:smsga|sms|xabarnoma|bildirishnoma|ekran).{0,80}ruxsat\s+ber/.test(text) ||
    /ruxsat\s+ber.{0,80}(?:smsga|sms|xabarnoma|bildirishnoma|ekran)/.test(text)
  ) {
    return 2;
  }

  if (
    /(?:^|\s)(я|мы)\s+(?:уже\s+|только\s+что\s+|недавно\s+)?(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?).{0,60}(смс|sms|otp|код|code|цифр[аы]?)/.test(
      text,
    ) ||
    /(?:смс|sms|otp|код|code|цифр[аы]?).{0,60}(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(yub[oa]r(?!\s*ma)|jo'nat(?!\s*ma)|jonat(?!\s*ma)|ayt(?!\s*ma)|ber(?!\s*ma)|kirit(?!\s*ma)).{0,60}(sms|kod|code|otp)/.test(
      text,
    ) ||
    /(?:sms|kod|code|otp).{0,60}(yub[oa]r(?!\s*ma)|jo'nat(?!\s*ma)|jonat(?!\s*ma)|ayt(?!\s*ma)|ber(?!\s*ma)|kirit(?!\s*ma))/.test(
      text,
    ) ||
    /(?:^|\s)(мен|биз).{0,40}(юбор|жунат|айт|бер|кирит).{0,60}(sms|смс|kod|код|code|otp)/.test(
      text,
    ) ||
    /(?:sms|смс|kod|код|code|otp).{0,60}(юбор|жунат|айт|бер|кирит)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:sent|shared|gave|given|told|read|entered|typed|confirmed).{0,60}(?:sms|otp|verification|login)?\s*(?:code|number|digits)/.test(
      text,
    ) ||
    /(?:sms|otp|verification|login).{0,30}(?:code|number|digits).{0,60}(?:sent|shared|gave|given|told|read|entered|typed|confirmed)/.test(
      text,
    )
  ) {
    return 1;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(установил[аи]?|поставил[аи]?|скачал[аи]?|запустил[аи]?|открыл[аи]?|разрешил[аи]?|включил[аи]?|дал[аи]?).{0,80}(apk|апк|приложени[ея]|anydesk|teamviewer|rustdesk|удаленн(?:ый|ого)\s+доступ|доступ\s+к\s+(?:экрану|телефон[у]?|устройств[у]?|sms|смс|уведомлени)|спец\.?\s*возможност|специальн(?:ые|ых)\s+возможност)/.test(
      text,
    ) ||
    /(?:apk|апк|приложени[ея]|anydesk|teamviewer|rustdesk).{0,80}(доступ к sms|доступ к смс|доступ к экрану|уведомлени|спец\.?\s*возможност|специальн(?:ые|ых)\s+возможност|accessibility|удаленн(?:ый|ого)\s+доступ)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(o'rnat|ornat|yukla|skachat|och|ishga tushir|ruxsat ber).{0,80}(apk|ilova|programma|app|anydesk|teamviewer|rustdesk|masofaviy|ekran)/.test(
      text,
    ) ||
    /(?:apk|ilova|programma|app|anydesk|teamviewer|rustdesk|masofaviy|ekran).{0,80}(o'rnat|ornat|yukla|skachat|och|smsga ruxsat|xabarnoma|ruxsat ber)/.test(
      text,
    ) ||
    /(?:^|\s)(мен|биз).{0,40}(урнат|юкла|скач|оч|ишга\s+тушир|рухсат\s+бер).{0,80}(apk|апк|илова|программа|app|anydesk|teamviewer|rustdesk|масофавий|экран)/.test(
      text,
    ) ||
    /(?:apk|апк|илова|программа|app|anydesk|teamviewer|rustdesk|масофавий|экран).{0,80}(урнат|юкла|скач|оч|smsга\s+рухсат|хабарнома|рухсат\s+бер)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:installed|downloaded|opened|started|allowed|enabled|gave).{0,80}(?:apk|anydesk|teamviewer|rustdesk|remote\s+access|screen\s+access|access\s+to\s+(?:my\s+)?screen|accessibility|special\s+permissions|unknown\s+app|app\s+from\s+(?:a\s+)?link)/.test(
      text,
    ) ||
    /(?:apk|anydesk|teamviewer|rustdesk|remote\s+access|screen\s+access|access\s+to\s+(?:my\s+)?screen|accessibility|special\s+permissions|unknown\s+app|app\s+from\s+(?:a\s+)?link).{0,80}(?:installed|downloaded|opened|started|allowed|enabled|gave)/.test(
      text,
    )
  ) {
    return 2;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(перевел[аи]?|перевёл[аи]?|сделал[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?).{0,80}(деньг|перевод|сум|сумов|uzs|кар[тд]|баланс|комисс)/.test(
      text,
    ) ||
    /(?:деньг|перевод|сум|сумов|uzs|кар[тд]|баланс|комисс).{0,80}(перевел[аи]?|перевёл[аи]?|сделал[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?)/.test(
      text,
    ) ||
    /(?:pul|sum|som|uzs|karta|balans).{0,80}(yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad)/.test(
      text,
    ) ||
    /(?:yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad).{0,80}(pul|sum|som|uzs|karta|balans)/.test(
      text,
    ) ||
    /(?:пул|сум|som|uzs|карта|баланс).{0,80}(юбор|жунат|утказ|тола|тула|оплат|попол)/.test(text) ||
    /(?:юбор|жунат|утказ|тола|тула|оплат|попол).{0,80}(пул|сум|som|uzs|карта|баланс)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:transferred|sent|paid|topped\s+up).{0,80}(?:money|transfer|sum|uzs|card|account|balance|wallet|phone\s+number|their\s+number)/.test(
      text,
    ) ||
    /(?:money|transfer|sum|uzs|card|account|balance|wallet|phone\s+number|their\s+number).{0,80}(?:transferred|sent|paid|topped\s+up)/.test(
      text,
    )
  ) {
    return 3;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(ввел[аи]?|ввёл[аи]?|вбил[аи]?|указал[аи]?|назвал[аи]?|отправил[аи]?|дал[аи]?).{0,80}(карт[уы]|номер карты|cvv|cvc|срок карты|данные карты)/.test(
      text,
    ) ||
    /(?:karta|card|cvv|cvc|pin).{0,80}(kirit|ber|ayt|yubor|jo'nat|jonat)/.test(text) ||
    /(?:kirit|ber|ayt|yubor|jo'nat|jonat).{0,80}(karta|card|cvv|cvc|pin)/.test(text) ||
    /(?:карта|card|cvv|cvc|pin|пин).{0,80}(кирит|бер|айт|юбор|жунат)/.test(text) ||
    /(?:кирит|бер|айт|юбор|жунат).{0,80}(карта|card|cvv|cvc|pin|пин)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:entered|typed|gave|given|shared|sent).{0,80}(?:card|card\s+number|card\s+details|cvv|cvc|pin|expiry|expiration)/.test(
      text,
    ) ||
    /(?:card|card\s+number|card\s+details|cvv|cvc|pin|expiry|expiration).{0,80}(?:entered|typed|gave|given|shared|sent)/.test(
      text,
    )
  ) {
    return 4;
  }

  if (
    /(?:потерял[аи]?|украли|взломали|угнали|забрали).{0,80}(telegram|телеграм|аккаунт)/.test(
      text,
    ) ||
    /(?:не могу|не получается).{0,40}(зайти|войти).{0,60}(telegram|телеграм)/.test(text) ||
    /(?:^|\s)(я|мы)\s+(уже\s+)?(отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|разрешил[аи]?).{0,80}(qr|куар|код).{0,80}(telegram|телеграм|вход|устройств)/.test(
      text,
    ) ||
    /(?:telegram|телеграм).{0,80}(qr|куар|код).{0,80}(отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|разрешил[аи]?)/.test(
      text,
    ) ||
    /(?:telegram|akkaunt|account).{0,80}(kira olmay|yo'qot|yoqot|o'g'ir|ogir|vzlom|hack)/.test(
      text,
    ) ||
    /(?:telegram).{0,80}(qr|kod).{0,80}(skaner|scan|tasdiq|ulash|bog'la|bogla)/.test(text) ||
    /(?:skaner|scan|tasdiq|ulash|bog'la|bogla).{0,80}(telegram).{0,80}(qr|kod)/.test(text) ||
    /(?:telegram|телеграм).{0,80}(qr|куар|код).{0,80}(сканер|scan|тасдик|улаш|богла)/.test(text) ||
    /(?:сканер|scan|тасдик|улаш|богла).{0,80}(telegram|телеграм).{0,80}(qr|куар|код)/.test(text) ||
    /(?:lost|stolen|hacked|taken\s+over|can't\s+log\s+in|cannot\s+log\s+in|can\s+not\s+log\s+in).{0,80}(?:telegram|tg|account)/.test(
      text,
    ) ||
    /(?:telegram|tg|account).{0,80}(?:lost|stolen|hacked|taken\s+over|can't\s+log\s+in|cannot\s+log\s+in|can\s+not\s+log\s+in)/.test(
      text,
    )
  ) {
    return 5;
  }

  if (
    /(?:^|\s)(мне|нам)\s+(сейчас\s+)?звон(?:ят|ит(?!ь))/.test(text) ||
    /(?:^|\s)(я|мы)\s+(сейчас\s+)?на звонке/.test(text) ||
    /(?:^|\s)звон(?:ит(?!ь)|ят|ил[аи]?).{0,80}(?:из\s+)?(?:банк|банка|налогов|полици|милици|мвд|прокуратур|суд|кадастр|госорган|оператор|связи)/.test(
      text,
    ) ||
    /(?:банк|банка|налогов|полици|милици|мвд|прокуратур|суд|кадастр|госорган|оператор|связи).{0,80}звон(?:ит(?!ь)|ят|ил[аи]?)/.test(
      text,
    ) ||
    /(?:^|\s)звон(?:ит(?!ь)|ят|ил[аи]?).{0,50}(?:мошен|скам|обман|развод|фишинг)/.test(text) ||
    /(?:^|\s)(?:мошен|скам|обман|развод|фишинг).{0,50}звон(?:ит(?!ь)|ят|ил[аи]?)/.test(text) ||
    /не кладите трубку/.test(text) ||
    /(?:hozir|xozir).{0,50}(qo'ng'iroq|qongiroq|zvon|call)/.test(text) ||
    /(?:menga|bizga).{0,50}(qo'ng'iroq|qongiroq|zvon|call).{0,50}(qilyap|qilish|kel)/.test(text) ||
    /(?:хозир|xozir).{0,50}(кунгирок|звон|call)/.test(text) ||
    /(?:менга|бизга).{0,50}(кунгирок|звон|call).{0,50}(киляп|килиш|кел)/.test(text) ||
    /(?:^|\s)(?:i|we)(?:'m| am|'re| are)?\s+(?:still\s+)?(?:on|in)\s+(?:a\s+)?(?:phone\s+)?(?:call|line)|(?:^|\s)(?:i|we)(?:'m| am|'re| are)?\s+(?:still\s+)?on\s+the\s+phone/.test(
      text,
    ) ||
    /(?:they|someone|the\s+caller|bank\s+caller).{0,40}(?:is|are|keeps?\s+)?(?:calling|on\s+the\s+phone|on\s+the\s+line)/.test(
      text,
    ) ||
    /(?:do\s+not|don't).{0,30}(?:hang\s+up|end\s+the\s+call)/.test(text)
  ) {
    return 6;
  }

  return null;
}

const QUOTED_OR_THIRD_PARTY_DONE_INTENT_PREFIX_RE =
  /(?:переслал|переслали|перешл|forward|forwarded|цитат|quote|скрин|screenshot|сообщени[ея]|message|xabar|он|она|они|мошенник|человек|клиент|пользователь|пострадавш|родственник|мама|папа|друг|they|he|she|someone|scammer|caller|user|client|victim|u\s+kishi).{0,80}(?:напис|пишет|сказ|говорит|сообщ|прислал|said|told|sent|wrote|yozdi|aytdi)/;

function isQuotedOrThirdPartyDoneIntent(text: string): boolean {
  const normalized = normalizeVoiceIntentText(text);
  const firstPersonIndex = normalized.search(/(?:^|\s)(?:я|мы|men|biz|i|we)\s+/);
  if (firstPersonIndex <= 0) return false;
  const prefix = normalized.slice(0, firstPersonIndex);
  return QUOTED_OR_THIRD_PARTY_DONE_INTENT_PREFIX_RE.test(prefix);
}

const TEXT_PANIC_DONE_INTENT_RE =
  /(?:^|\s)(?:(?:\u044f|\u043c\u044b)\s+(?:\u0443\u0436\u0435\s+)?.{0,50}(?:\u043e\u0442\u043f\u0440\u0430\u0432|\u0441\u043e\u043e\u0431\u0449|\u043d\u0430\u0437\u0432\u0430|\u0441\u043a\u0430\u0437\u0430|\u043f\u0435\u0440\u0435\u0434\u0430|\u043f\u0440\u043e\u0434\u0438\u043a\u0442|\u0443\u0441\u0442\u0430\u043d\u043e\u0432|\u0441\u043a\u0430\u0447|\u0437\u0430\u043f\u0443\u0441\u0442|\u043e\u0442\u043a\u0440|\u0440\u0430\u0437\u0440\u0435\u0448|\u0432\u043a\u043b\u044e\u0447|\u0434\u0430\u043b|\u0441\u0434\u0435\u043b\u0430|\u043f\u0435\u0440\u0435\u0432|\u043e\u043f\u043b\u0430\u0442|\u043f\u043e\u043f\u043e\u043b\u043d|\u0432\u0432\u0435|\u0432\u0432\u0451|\u0432\u0431\u0438|\u0443\u043a\u0430\u0437|\u0441\u043a\u0430\u043d|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434)|(?:men|biz).{0,50}(?:yub[oa]rdim|jo['\u2019]?natdim|jonatdim|aytdim|berdim|kiritdim|o['\u2019]?rnatdim|ornatdim|yukladim|ochdim|ruxsat berdim|o['\u2019]?tkazdim|otkazdim|to['\u2019]?ladim|toladim|skaner qildim|scan qildim|tasdiqladim)|(?:мен|биз).{0,50}(?:юбордим|жунатдим|айтдим|бердим|киритдим|урнатдим|юкладим|очдим|рухсат бердим|утказдим|толадим|сканер килдим|scan килдим|тасдикладим)|(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:sent|shared|gave|given|told|read|dictated|entered|typed|confirmed|approved|installed|downloaded|opened|started|allowed|enabled|transferred|paid|topped\s+up|scanned))/i;

function classifyLiveCallContext(text: string | undefined): LiveCallContext {
  const normalized = normalizeVoiceIntentText(text ?? "");
  if (!normalized) return "generic";

  if (
    /(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|брат|сестр|внук|внуч|друг|подруг|ona|ota|aka|uka|opa|singil|qarindosh|yaqin|mother|father|mom|dad|sister|brother|grandma|grandpa|relative|friend|loved\s+one).{0,160}(?:сроч|деньг|перевод|помощ|авар|машин|больниц|операци|лечение|код|карта|shoshil|pul|o['’]?tkaz|yordam|avariya|mashina|kasalxona|kod|karta|urgent|money|transfer|help|accident|car|hospital|code|card)|(?:сроч|деньг|перевод|помощ|авар|машин|больниц|операци|лечение|код|карта|shoshil|pul|o['’]?tkaz|yordam|avariya|mashina|kasalxona|kod|karta|urgent|money|transfer|help|accident|car|hospital|code|card).{0,160}(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|брат|сестр|внук|внуч|друг|подруг|ona|ota|aka|uka|opa|singil|qarindosh|yaqin|mother|father|mom|dad|sister|brother|grandma|grandpa|relative|friend|loved\s+one)/iu.test(
      normalized,
    )
  ) {
    return "relative";
  }

  if (
    /(?:налогов|налог|фнс|солик|солиқ|soliq|one\s?id|oneid|my\.gov|id\.gov|gov\.uz|госуслуг|госорган|давлат|pinfl|пинфл|jshshir|полици|милици|мвд|ииб|iib|прокуратур|prokuratura|суд|court|sud|кадастр|kadastr|нотариус|notary|юрист|lawyer|коллектор|tax|government|police|prosecutor)/iu.test(
      normalized,
    )
  ) {
    return "government";
  }

  if (
    /(?:оператор|связи|сим|sim|билайн|beeline|ucell|юселл|мобиуз|mobiuz|uzmobile|узмобайл|uztelecom|узтелеком|telecom|operator|aloqa|raqamni\s+ko['’]?chir|nomer)/iu.test(
      normalized,
    )
  ) {
    return "operator";
  }

  if (
    /(?:банк|bank|карта|karta|card|humo|uzcard|kapitalbank|uzum|anorbank|hamkor|ипотека\s*банк|нацбанк|нбу|central\s+bank|марказий\s+банк)/iu.test(
      normalized,
    )
  ) {
    return "bank";
  }

  return "generic";
}

function classifyTextPanicIntent(
  text: string,
  source?: TelegramForwardSourceContext,
): PanicScenarioId | null {
  if (source) return null;
  if (isQuotedOrThirdPartyDoneIntent(text)) return null;
  const normalized = normalizeVoiceIntentText(text);
  const panicId = classifyVoicePanicIntent(text);
  if (panicId === null) return null;
  if (panicId === 6) return panicId;
  if (
    panicId === 5 &&
    /(?:потерял[аи]?|украли|взломали|угнали|забрали|не\s+могу|не\s+получается).{0,80}(?:telegram|телеграм|аккаунт)/.test(
      normalized,
    )
  ) {
    return panicId;
  }
  return TEXT_PANIC_DONE_INTENT_RE.test(normalized) ? panicId : null;
}

async function sendPanicRoute(
  ctx: HandlerCtx,
  panicId: PanicScenarioId,
  triggerText?: string,
): Promise<void> {
  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;
  const liveCallContext = panicId === 6 ? classifyLiveCallContext(triggerText) : undefined;
  const nextScenarioData = withPanicContextData(previousScenarioData, panicId);
  if (liveCallContext !== undefined) {
    nextScenarioData.lastLiveCallContext = liveCallContext;
  }
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: withSessionChatScope(nextScenarioData, ctx.chatId, ctx.chatType),
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(
      liveCallContext === undefined
        ? buildPanicScenarioText(panicId, ctx.session.lang)
        : buildPanicScenarioText(panicId, ctx.session.lang, { liveCallContext }),
    ),
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
    scenarioData: withSessionChatScope(
      {
        ...previousScenarioData,
        lastCheck,
        ...(guardian ? { guardian } : {}),
      },
      ctx.chatId,
      ctx.chatType,
    ),
  });

  if (guardian && shouldAutoSendGuardianIntro(result)) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildGuardianAngelIntro(guardian, ctx.session.lang)),
      keyboard: buildGuardianAngelKeyboard(ctx.session.lang, guardian),
    });
  }
}

function addImageMediaContextToExplanation(
  explanation: string,
  mediaKind: ImageRouteMediaKind | undefined,
  lang: HandlerCtx["session"]["lang"],
): string {
  if (mediaKind !== "video_thumbnail") return explanation;

  const note =
    lang === "uz"
      ? "Men videoning faqat preview-kadrini tekshirdim, butun rolikni emas. Muhim ma'lumot nutq, tavsif yoki tugmada bo'lsa, uni alohida yuboring."
      : lang === "en"
        ? "I checked only the video preview frame, not the full clip. If the important part was in speech, description, or a button, send it separately."
        : "Я проверил только кадр-превью видео, не весь ролик. Если важная информация была в речи, описании или кнопке — пришлите её отдельно.";

  return `${note}\n\n${explanation}`;
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
    scenarioData: withSessionChatScope(
      {
        ...previousScenarioData,
        lastCheck: buildImageUnreadableSnapshot(),
      },
      ctx.chatId,
      ctx.chatType,
    ),
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
async function withDeferredCheckStatus<T>(
  ctx: HandlerCtx,
  work: () => Promise<T>,
  options: { shouldSend?: () => boolean } = {},
): Promise<T> {
  let finished = false;
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    if (!finished && (options.shouldSend?.() ?? true)) {
      void replyText(ctx.chatId, bt("check_processing", ctx.session.lang)).catch(() => undefined);
    }
  }, CHECK_PROCESSING_DELAY_MS);

  try {
    return await work();
  } finally {
    finished = true;
    clearTimeout(timer);
  }
}

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

  const victimIntent = source ? null : classifyVictimIntent(trimmed);
  if (victimIntent !== null && shouldVictimIntentOverridePanic(victimIntent)) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildVictimIntentText(victimIntent, lang)),
      keyboard: buildVictimIntentKeyboard(lang, victimIntent),
    });
    return;
  }

  const textPanicId = classifyTextPanicIntent(trimmed, source);
  if (textPanicId !== null) {
    await sendPanicRoute(ctx, textPanicId, trimmed);
    return;
  }

  if (
    victimIntent !== null &&
    hasRecentEmergencyContext(ctx.session.scenarioData ?? {}) &&
    shouldVictimIntentOverrideFollowUps(victimIntent)
  ) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildVictimIntentText(victimIntent, lang)),
      keyboard: buildVictimIntentKeyboard(lang, victimIntent),
    });
    return;
  }

  const emergencyFollowUp = classifyEmergencyFollowUp(trimmed, ctx.session.scenarioData);
  if (emergencyFollowUp !== null) {
    const liveCallContext =
      emergencyFollowUp.panicId === 6
        ? asLiveCallContext(ctx.session.scenarioData.lastLiveCallContext)
        : null;
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildEmergencyFollowUpText(
          emergencyFollowUp.action,
          emergencyFollowUp.panicId,
          lang,
          liveCallContext === null ? {} : { liveCallContext },
        ),
      ),
      keyboard: buildEmergencyFollowUpKeyboard(lang, emergencyFollowUp.panicId, {
        includeVoice: false,
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

  const emergencyAcknowledgement = classifyAcknowledgementFollowUp(trimmed);
  if (
    emergencyAcknowledgement !== null &&
    hasRecentEmergencyContext(ctx.session.scenarioData ?? {})
  ) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildAcknowledgementFollowUpText(lang)),
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

  if (victimIntent !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildVictimIntentText(victimIntent, lang)),
      keyboard: buildVictimIntentKeyboard(lang, victimIntent),
    });
    return;
  }

  await guarded(ctx, "handleCheck", async () => {
    let suppressDeferredCheckStatus = false;
    await withDeferredCheckStatus(
      ctx,
      async () => {
        const rateLimitKey = rateLimitKeyFor(ctx.userId);
        const publicPostStartedAt = Date.now();
        const publicPostEvidence = await buildTelegramPublicPostCheckEvidence(
          trimmed,
          rateLimitKey,
        );
        logTelegramTiming("check.public_post_evidence", publicPostStartedAt, {
          hasEvidence: publicPostEvidence !== null,
        });

        const checkInput = publicPostEvidence?.checkInput ?? trimmed;
        const checkType = publicPostEvidence ? "text" : undefined;
        const cacheKey = buildCheckResultCacheKey({
          userId: ctx.userId,
          lang,
          input: checkInput,
          type: checkType,
          publicPost: publicPostEvidence !== null,
        });
        const cached = getCachedCheckResult(cacheKey);
        if (cached) {
          suppressDeferredCheckStatus = true;
          await sendCheckResult(ctx, enrichForwardSourceContext(cached, source, lang));
          logTelegramTiming("check.total", startedAt, {
            type: cached.type,
            level: cached.level,
            reasonCount: cached.reasons.length,
            publicPostEvidence: publicPostEvidence !== null,
            cached: true,
          });
          return;
        }

        let checkWork = getInFlightCheckResult(cacheKey);
        const reusedInFlight = checkWork !== null;
        if (reusedInFlight) {
          suppressDeferredCheckStatus = true;
        }
        if (!checkWork) {
          checkWork = (async () => {
            const checkStartedAt = Date.now();
            const result = await runCheck({
              input: checkInput,
              type: checkType,
              lang,
              rateLimitKey,
              channel: CHANNEL,
              ...TELEGRAM_AI_EXPLANATION_OPTIONS,
            });
            logTelegramTiming("check.run_check", checkStartedAt, {
              type: result.type,
              level: result.level,
              reasonCount: result.reasons.length,
              hasPublicPostEvidence: publicPostEvidence !== null,
            });
            const postResult = enrichTelegramPublicPostResult(result, publicPostEvidence, lang);
            const enrichmentStartedAt = Date.now();
            const enrichedMetadata = publicPostEvidence
              ? postResult
              : await enrichTelegramPublicMetadata(trimmed, postResult, lang);
            const enriched = publicPostEvidence
              ? enrichedMetadata
              : await enrichTelegramReputation(trimmed, enrichedMetadata, lang);
            rememberCheckResult(cacheKey, enriched);
            logTelegramTiming("check.enrichment", enrichmentStartedAt, {
              publicPostEvidence: publicPostEvidence !== null,
              level: enriched.level,
              reasonCount: enriched.reasons.length,
            });
            return enriched;
          })();
          rememberInFlightCheckResult(cacheKey, checkWork);
        }

        const enriched = await withTypingIndicator(ctx.chatId, () => checkWork);
        await sendCheckResult(ctx, enrichForwardSourceContext(enriched, source, lang));
        logTelegramTiming("check.total", startedAt, {
          type: enriched.type,
          level: enriched.level,
          reasonCount: enriched.reasons.length,
          publicPostEvidence: publicPostEvidence !== null,
          inFlight: reusedInFlight,
        });
      },
      {
        shouldSend: () => !suppressDeferredCheckStatus,
      },
    );
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
  mediaKind?: ImageRouteMediaKind,
): Promise<void> {
  const startedAt = Date.now();
  const lang = ctx.session.lang;

  await guarded(ctx, "handleImage", async () => {
    const budgetStartedAt = Date.now();
    await checkImageDownloadBudget(ctx.userId);
    logTelegramTiming("image.download_budget", budgetStartedAt, {
      mediaGroup: mediaGroupId !== undefined,
    });

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
        safeIfNoReasons: isEvidenceBackedBenignImageContext(evidence),
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
          explanation: addImageMediaContextToExplanation(
            buildImageUserExplanation(evidence, result.level, lang),
            mediaKind,
            lang,
          ),
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

async function handleResolvedVoiceTranscript(
  ctx: HandlerCtx,
  transcriptText: string,
  startedAt: number,
  meta: VoiceMeta | undefined,
  source: "cached" | "in_flight" | "metadata_fallback",
): Promise<void> {
  const lang = ctx.session.lang;
  const metadataFallback = source === "metadata_fallback";

  if (metadataFallback) {
    await sendVoiceMetadataFallbackNote(ctx, transcriptText);
  } else {
    await sendVoiceTranscriptNote(ctx, transcriptText);
  }
  if (isLowSignalVoiceTranscript(transcriptText)) {
    await replyText(
      ctx.chatId,
      bt("voice_transcript_uncertain", lang),
      buildVoiceUncertainKeyboard(lang),
    );
    logTelegramTiming("voice.total", startedAt, {
      cached: source === "cached",
      inFlight: source === "in_flight",
      metadataFallback,
      lowSignal: true,
      transcriptChars: transcriptText.length,
      durationSec: meta?.duration ?? null,
    });
    return;
  }

  if (isNegatedVoiceDoneIntent(transcriptText)) {
    await replyText(
      ctx.chatId,
      bt("voice_negated_done_ack", lang),
      buildVoiceNegatedDoneKeyboard(lang),
    );
    logTelegramTiming("voice.total", startedAt, {
      cached: source === "cached",
      inFlight: source === "in_flight",
      metadataFallback,
      negatedDoneAck: true,
      transcriptChars: transcriptText.length,
      durationSec: meta?.duration ?? null,
    });
    return;
  }

  const panicId = classifyVoicePanicIntent(transcriptText);
  if (panicId !== null) {
    await sendPanicRoute(ctx, panicId, transcriptText);
    logTelegramTiming("voice.total", startedAt, {
      cached: source === "cached",
      inFlight: source === "in_flight",
      metadataFallback,
      routedToPanic: panicId,
      transcriptChars: transcriptText.length,
      durationSec: meta?.duration ?? null,
    });
    return;
  }

  const checkStartedAt = Date.now();
  const result = await runCheck({
    input: transcriptText,
    type: "text",
    lang,
    rateLimitKey: rateLimitKeyFor(ctx.userId),
    channel: CHANNEL,
    ...TELEGRAM_AI_EXPLANATION_OPTIONS,
  });
  logTelegramTiming("voice.run_check", checkStartedAt, {
    cached: source === "cached",
    inFlight: source === "in_flight",
    metadataFallback,
    type: result.type,
    level: result.level,
    reasonCount: result.reasons.length,
  });
  await sendCheckResult(ctx, withVoiceHookExplanation(result, transcriptText, lang));
  logTelegramTiming("voice.total", startedAt, {
    cached: source === "cached",
    inFlight: source === "in_flight",
    metadataFallback,
    type: result.type,
    level: result.level,
    reasonCount: result.reasons.length,
    transcriptChars: transcriptText.length,
    durationSec: meta?.duration ?? null,
  });
}

async function handleVoiceTranscriptionFailure(
  ctx: HandlerCtx,
  startedAt: number,
  meta: VoiceMeta | undefined,
): Promise<void> {
  const fallbackText = extractVoiceMetadataFallbackText(meta);
  if (fallbackText) {
    await handleResolvedVoiceTranscript(ctx, fallbackText, startedAt, meta, "metadata_fallback");
    return;
  }

  await replyText(
    ctx.chatId,
    bt("voice_transcription_failed", ctx.session.lang),
    buildVoiceFallbackKeyboard(ctx.session.lang),
  );
}

export async function handleVoice(
  fileId: string,
  ctx: HandlerCtx,
  meta?: VoiceMeta,
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
      await handleResolvedVoiceTranscript(ctx, cachedTranscript, startedAt, meta, "cached");
      return;
    }

    const inFlightTranscript = getInFlightVoiceTranscript(ctx.userId, meta?.fileUniqueId);
    if (inFlightTranscript) {
      await replyText(ctx.chatId, bt("voice_processing", lang));
      const shared = await withTypingIndicator(ctx.chatId, () => inFlightTranscript, {
        delayMs: 500,
        repeatMs: 4000,
      });
      if (shared.kind === "failed") {
        await handleVoiceTranscriptionFailure(ctx, startedAt, meta);
        return;
      }
      if (shared.kind === "too_large") {
        await replyText(ctx.chatId, bt("voice_too_large", lang), buildVoiceFallbackKeyboard(lang));
        logTelegramTiming("voice.reject", startedAt, {
          reason: "shared_downloaded_size_limit",
          durationSec: meta?.duration ?? null,
        });
        return;
      }
      await handleResolvedVoiceTranscript(ctx, shared.text, startedAt, meta, "in_flight");
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
      await handleVoiceTranscriptionFailure(ctx, startedAt, meta);
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

    const transcriptWork = (async (): Promise<VoiceTranscriptWorkResult> => {
      const downloadStartedAt = Date.now();
      const dataUrl = await downloadFileAsDataUrl(fileMeta.filePath);
      logTelegramTiming("voice.download", downloadStartedAt, {
        ok: dataUrl !== null,
        fileSizeBytes: fileSize,
        durationSec: meta?.duration ?? null,
      });
      if (!dataUrl) return { kind: "failed" };
      if (estimateBase64DataUrlBytes(dataUrl) > MAX_VOICE_BYTES) {
        return { kind: "too_large" };
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
      if (!transcript.text) return { kind: "failed" };
      rememberVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcript.text);
      return { kind: "ok", text: transcript.text };
    })();
    rememberInFlightVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcriptWork);

    const outcome = await withTypingIndicator(
      ctx.chatId,
      async () => {
        const transcriptOutcome = await transcriptWork;
        if (transcriptOutcome.kind !== "ok") return transcriptOutcome;

        const transcriptText = transcriptOutcome.text;
        await sendVoiceTranscriptNote(ctx, transcriptText);
        if (isLowSignalVoiceTranscript(transcriptText)) {
          return { kind: "uncertain" as const, transcriptChars: transcriptText.length };
        }
        if (isNegatedVoiceDoneIntent(transcriptText)) {
          return { kind: "negated_done_ack" as const, transcriptChars: transcriptText.length };
        }
        const panicId = classifyVoicePanicIntent(transcriptText);
        if (panicId !== null) {
          return {
            kind: "panic" as const,
            panicId,
            transcriptText,
            transcriptChars: transcriptText.length,
          };
        }

        const checkStartedAt = Date.now();
        const result = await runCheck({
          input: transcriptText,
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
        return {
          kind: "ok" as const,
          result: withVoiceHookExplanation(result, transcriptText, lang),
          transcriptChars: transcriptText.length,
        };
      },
      { delayMs: 500, repeatMs: 4000 },
    );

    if (outcome.kind === "failed") {
      await handleVoiceTranscriptionFailure(ctx, startedAt, meta);
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
      await sendPanicRoute(ctx, outcome.panicId, outcome.transcriptText);
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
    if (outcome.kind === "negated_done_ack") {
      await replyText(
        ctx.chatId,
        bt("voice_negated_done_ack", lang),
        buildVoiceNegatedDoneKeyboard(lang),
      );
      logTelegramTiming("voice.total", startedAt, {
        cached: false,
        negatedDoneAck: true,
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
