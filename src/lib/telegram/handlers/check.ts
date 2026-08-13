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
import {
  directDeliveryRetryMsFromSeconds,
  directDeliveryRetryAfterMs,
  TelegramDirectResultDeliveryError,
} from "@/lib/telegram/direct-result-delivery-error";
import type { HandlerCtx, ImageRouteMediaKind } from "@/lib/telegram/router";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { detectInputType, maskForDisplay, normalize } from "@/lib/risk/detect";
import { sanitizeSensitiveTextForSink, type SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import { saveSession, withSessionChatScope } from "@/lib/telegram/session.server";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
  asLiveCallContext,
  buildPanicScenarioText,
  hasRecentEmergencyContext,
  withPanicContextData,
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
  type GuardianAngelSnapshot,
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
  buildVictimFollowUpContext,
  buildVictimGuidanceFollowUpText,
  buildVictimIntentKeyboard,
  buildVictimIntentText,
  classifyVictimGuidanceFollowUp,
  classifyVictimIntent,
  classifyVictimContextualFollowUp,
  classifyVictimContextualPanicIntent,
  type VictimIntentMatch,
} from "@/lib/telegram/victim-intent";
import { notifyTrustedContact } from "@/lib/telegram/family-shield.server";
import {
  classifyLiveCallContext,
  classifyTextPanicIntent,
  classifyVoicePanicIntent,
  isNegatedVoiceDoneIntent,
  normalizeVoiceIntentText,
} from "@/lib/telegram/text-panic-intent";
import {
  canonicalFollowUpIntentId,
  canonicalVictimIntentId,
  enforceTelegramReplyContract,
  type CanonicalFollowUpIntentId,
  type CanonicalVictimIntentId,
} from "@/lib/telegram/intent-contract";
import { claimTelegramImageDownloadBudget } from "@/lib/telegram/media-admission.server";
import {
  buildSensitiveSecretGuidance,
  detectTelegramSensitiveSecret,
  hasPastedSensitiveSecretValue,
} from "@/lib/telegram/sensitive-secret-input";
import {
  buildReplyContextExpiredText,
  rememberReplyCheckContext,
} from "@/lib/telegram/reply-check-context";
import { resolveTelegramTextLanguage } from "@/lib/telegram/inline-query-language";

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
const PROACTIVE_TRUSTED_NOTIFY_COOLDOWN_MS = 30 * 60 * 1000;
const EMBEDDED_PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{6,18}\d/gu;
const EMBEDDED_VERIFIED_SHORT_CODE_RE = /(?<!\d)(?:1344|1340|1296|1290|1257)(?!\d)/gu;
const EMBEDDED_CHECK_URL_RE =
  /\bhttps?:\/\/[^\s<>()]+|\b(?:t\.me|telegram\.me)\/\+[a-zA-Z0-9_-]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/giu;
const PHONE_IDENTITY_QUESTION_RE =
  /(?:(?:это|этот|this|bu|shu).{0,35}(?:номер|телефон|number|phone|raqam|рақам).{0,45}(?:банк|bank|официальн|rasmiy)|(?:банк|bank).{0,45}(?:номер|телефон|number|phone|raqam|рақам)|(?:какому|какой|which|qaysi|қайси).{0,35}(?:банк|bank).{0,35}(?:принадлеж|номер|raqam|рақам|ники)|(?:ишонч|ishonch)\s+(?:телефон(?:и)?|raqam(?:i)?|рақам(?:и)?).{0,30}(?:ми|mi|\?))/iu;

function contractReplyText(
  intentId: CanonicalFollowUpIntentId | CanonicalVictimIntentId,
  text: string,
): string {
  return enforceTelegramReplyContract(intentId, "direct", escapeMarkdownV2(text));
}

function shouldVictimIntentOverrideFollowUps(match: VictimIntentMatch): boolean {
  // In an active emergency flow, a request for the bank number belongs to the
  // emergency contact action: it includes the explicit incoming-number warning
  // and the verified callback script. Other concrete victim topics still win.
  return match.askedContext !== undefined && match.kind !== "bank_contact_question";
}

function shouldVictimIntentOverrideGenericHelpers(match: VictimIntentMatch, text: string): boolean {
  if (match.kind === "pension_benefit") return true;
  if (match.kind !== "code_request") return false;

  return /(?:sms|смс|otp|push|пуш).{0,60}(?:код|code|kod|цифр|digits)|(?:код|code|kod|цифр|digits).{0,60}(?:sms|смс|otp|push|пуш)/iu.test(
    text,
  );
}

function shouldVictimIntentOverridePanic(match: VictimIntentMatch): boolean {
  // A narrow scenario requires several topic-specific signals. Preserve it
  // before generic live-call/panic and orphan follow-up helpers can turn a
  // complete request into a different topic.
  return (
    match.scenario !== undefined ||
    match.kind === "friend_money" ||
    match.kind === "relative_already_paid"
  );
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
  12_000,
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
  | {
      kind: "sensitive_secret";
      classes: readonly SensitiveSecretClass[];
      transcriptChars: number;
    }
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

/**
 * Отправить простой (не отформатированный) текст пользователю. Строки bot-i18n
 * — plain text, поэтому экранируем их под MarkdownV2 (parse_mode по умолчанию).
 */
async function replyText(chatId: number, plain: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(plain), keyboard });
}

function extractQuestionedPhoneNumber(text: string): string | null {
  if (!PHONE_IDENTITY_QUESTION_RE.test(text)) return null;
  EMBEDDED_VERIFIED_SHORT_CODE_RE.lastIndex = 0;
  const shortCode = EMBEDDED_VERIFIED_SHORT_CODE_RE.exec(text)?.[0];
  if (shortCode) return shortCode;
  EMBEDDED_PHONE_CANDIDATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMBEDDED_PHONE_CANDIDATE_RE.exec(text)) !== null) {
    const candidate = match[0].trim();
    if (detectInputType(candidate) === "phone") return candidate;
  }
  return null;
}

function presentSingleEmbeddedUrlResult(
  result: RunCheckResult,
  checkedInput: string,
): RunCheckResult {
  if (
    result.type !== "text" ||
    (result.level !== "unknown" && result.level !== "safe") ||
    result.verifiedContact
  ) {
    return result;
  }

  const urls = [...checkedInput.matchAll(EMBEDDED_CHECK_URL_RE)]
    .map(([value]) => value.replace(/[.,!?;:)\]}>'"`]+$/gu, ""))
    .filter(Boolean);
  if (new Set(urls).size !== 1) return result;

  const [url] = [...new Set(urls)];
  if (
    !url ||
    /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//iu.test(url) ||
    /\.apk(?:\?|$)/iu.test(url)
  ) {
    return result;
  }

  const type = "url" as const;
  const normalizedUrl = normalize(url, type);
  return {
    ...result,
    type,
    display: maskForDisplay(normalizedUrl, type),
  };
}

async function sendVictimIntentGuidance(
  ctx: HandlerCtx,
  match: VictimIntentMatch,
  lang: HandlerCtx["session"]["lang"],
  preserveEmergencyContext = false,
): Promise<void> {
  const delivery = await sendMessage({
    chatId: ctx.chatId,
    text: contractReplyText(
      canonicalVictimIntentId(match.kind),
      buildVictimIntentText(match, lang),
    ),
    keyboard: buildVictimIntentKeyboard(lang, match),
  });
  if (!delivery?.ok) return;

  const nextContext = buildVictimFollowUpContext(match);
  const {
    guardian: _previousGuardian,
    lastCheck: _previousCheck,
    lastLiveCallContext: _previousLiveCallContext,
    lastPanicAt: _previousPanicAt,
    lastPanicId: _previousPanicId,
    lastVictimIntent: _previousVictimIntent,
    ...previousScenarioData
  } = ctx.session.scenarioData;
  if (!nextContext && !_previousVictimIntent) return;
  const previousEmergencyContext = preserveEmergencyContext
    ? {
        ...(_previousLiveCallContext === undefined
          ? {}
          : { lastLiveCallContext: _previousLiveCallContext }),
        ...(_previousPanicAt === undefined ? {} : { lastPanicAt: _previousPanicAt }),
        ...(_previousPanicId === undefined ? {} : { lastPanicId: _previousPanicId }),
      }
    : {};
  await saveSession(ctx.userId, {
    scenarioData: withSessionChatScope(
      {
        ...previousScenarioData,
        ...previousEmergencyContext,
        ...(nextContext ? { lastVictimIntent: nextContext } : {}),
      },
      ctx.chatId,
      ctx.chatType,
    ),
  });
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
  const sanitized = sanitizeSensitiveTextForSink(text)
    .value.normalize("NFKC")
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

function buildVoiceSensitiveTranscriptNote(lang: HandlerCtx["session"]["lang"]): string {
  if (lang === "uz") {
    return "🎧 Ovozli xabarni tanidim. Maxfiy ma'lumotlar yashirildi.";
  }
  if (lang === "en") {
    return "🎧 I recognized the voice note. Sensitive data is hidden.";
  }
  return "🎧 Я распознал голосовое сообщение. Чувствительные данные скрыты.";
}

function buildVoiceTranscriptNote(
  transcript: string,
  lang: HandlerCtx["session"]["lang"],
): string | null {
  // A transcript can contain a real credential even when its visible shape is
  // not numeric (passwords, alphanumeric verification codes, recovery words,
  // private keys). In that case no user-derived substring belongs in the
  // Telegram preview: use a fully static acknowledgement and keep the normal
  // correction button so STT mistakes can still be fixed.
  if (detectTelegramSensitiveSecret(transcript)) {
    return buildVoiceSensitiveTranscriptNote(lang);
  }

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

async function sendVoiceSensitiveTranscriptNote(ctx: HandlerCtx): Promise<void> {
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildVoiceSensitiveTranscriptNote(ctx.session.lang)),
    keyboard: [
      [{ text: bt("voice_correct_button", ctx.session.lang), callback_data: CB.voiceCorrect }],
    ],
  });
}

async function sendVoiceSensitiveSecretGuidance(
  ctx: HandlerCtx,
  classes: readonly SensitiveSecretClass[],
): Promise<void> {
  const guidance = buildSensitiveSecretGuidance(classes, ctx.session.lang);
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(`${guidance.title}\n\n${guidance.description}`),
  });
}

async function sendVoiceMetadataFallbackNote(ctx: HandlerCtx, text: string): Promise<void> {
  if (detectTelegramSensitiveSecret(text)) {
    await replyText(
      ctx.chatId,
      buildVoiceSensitiveTranscriptNote(ctx.session.lang),
      buildVoiceUncertainKeyboard(ctx.session.lang),
    );
    return;
  }
  const preview = sanitizeVoiceTranscriptPreview(text);
  if (!preview) return;
  await replyText(
    ctx.chatId,
    bt("voice_metadata_fallback_note", ctx.session.lang, { text: preview }),
    buildVoiceUncertainKeyboard(ctx.session.lang),
  );
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

async function sendPanicRoute(
  ctx: HandlerCtx,
  panicId: PanicScenarioId,
  triggerText?: string,
  victimMatch?: VictimIntentMatch,
): Promise<void> {
  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;
  const liveCallContext = panicId === 6 ? classifyLiveCallContext(triggerText) : undefined;
  const victimContext = victimMatch ? buildVictimFollowUpContext(victimMatch) : null;
  const nextScenarioData = {
    ...withPanicContextData(previousScenarioData, panicId),
    ...(victimContext ? { lastVictimIntent: victimContext } : {}),
  };
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

async function maybeAutoNotifyTrustedContact(
  ctx: HandlerCtx,
  guardian: ReturnType<typeof buildGuardianAngelSnapshot>,
): Promise<void> {
  if (!guardian || ctx.chatType !== "private") return;

  const result = await notifyTrustedContact({
    guardianTelegramUserId: ctx.userId,
    lang: ctx.session.lang,
    guardianDisplayName: ctx.displayName,
    cooldownMs: PROACTIVE_TRUSTED_NOTIFY_COOLDOWN_MS,
    mode: "automatic",
  });

  if (
    result.ok ||
    result.reason === "not_linked" ||
    result.reason === "auto_alerts_disabled" ||
    result.reason === "cooldown"
  ) {
    return;
  }
  console.error("family shield proactive notify failed", result.reason);
}

/** Отправить отформатированный результат проверки (текст + inline-кнопки). */
async function restoreSessionAfterUndeliveredResult(ctx: HandlerCtx): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: ctx.session.scenario,
    scenarioStep: ctx.session.scenarioStep,
    scenarioData: ctx.session.scenarioData,
  });
}

async function claimSessionBeforePrimaryResult(ctx: HandlerCtx): Promise<boolean> {
  // This context-neutral write is the per-user sequence and current-lease gate.
  // It never mutates scenario/check context (the session layer may persist the
  // already-resolved language), so a stale update cannot send a result and a
  // later definitive delivery failure has no phantom lastCheck to roll back.
  // The same update id remains replayable because the SQL guard uses >=.
  const claimed = await saveSession(ctx.userId, {});
  return claimed?.ok !== false;
}

async function persistPrimaryResultContext(
  ctx: HandlerCtx,
  scenarioData: HandlerCtx["session"]["scenarioData"],
  lastCheck: ReturnType<typeof buildLastCheckSnapshot>,
  messageId: number | undefined,
  guardian?: GuardianAngelSnapshot,
): Promise<{ ok: true; scenarioData: HandlerCtx["session"]["scenarioData"] } | { ok: false }> {
  const persistedScenarioData =
    messageId === undefined
      ? scenarioData
      : withSessionChatScope(
          rememberReplyCheckContext(scenarioData, messageId, lastCheck, undefined, guardian),
          ctx.chatId,
          ctx.chatType,
        );
  const saved = await saveSession(
    ctx.userId,
    {
      scenario: "none",
      scenarioStep: 0,
      scenarioData: persistedScenarioData,
    },
    { failureVisibility: "operator_only" },
  );
  if (saved?.ok === false) {
    console.error("telegram primary result context storage failed");
    return { ok: false };
  }
  return { ok: true, scenarioData: persistedScenarioData };
}

async function rememberDeliveredCheckResult(
  ctx: HandlerCtx,
  scenarioData: HandlerCtx["session"]["scenarioData"],
  lastCheck: ReturnType<typeof buildLastCheckSnapshot>,
  messageId: number | undefined,
  guardian?: GuardianAngelSnapshot,
): Promise<HandlerCtx["session"]["scenarioData"]> {
  if (messageId === undefined) return scenarioData;
  const nextScenarioData = withSessionChatScope(
    rememberReplyCheckContext(scenarioData, messageId, lastCheck, undefined, guardian),
    ctx.chatId,
    ctx.chatType,
  );
  const saved = await saveSession(
    ctx.userId,
    {
      scenario: "none",
      scenarioStep: 0,
      scenarioData: nextScenarioData,
    },
    { failureVisibility: "operator_only" },
  );
  if (saved?.ok === false) {
    console.error("telegram reply context storage failed");
    return scenarioData;
  }
  return nextScenarioData;
}

async function sendCheckResult(ctx: HandlerCtx, result: RunCheckResult): Promise<void> {
  const formatted = formatCheckResult(result, ctx.session.lang);
  const lastCheck = buildLastCheckSnapshot(result);
  const guardian = buildGuardianAngelSnapshot(result);
  const { guardian: _previousGuardian, ...previousScenarioData } = ctx.session.scenarioData;

  const nextScenarioData = withSessionChatScope(
    {
      ...previousScenarioData,
      lastCheck,
      ...(guardian ? { guardian } : {}),
    },
    ctx.chatId,
    ctx.chatType,
  );
  if (!(await claimSessionBeforePrimaryResult(ctx))) return;

  const resultDelivery = await sendMessage({
    chatId: ctx.chatId,
    text: formatted.text,
    keyboard: formatted.keyboard,
  });
  // Optional access keeps older isolated handler fakes (which returned void)
  // backward-compatible; the real API always returns the discriminated result.
  if (resultDelivery?.ok === false) {
    if (resultDelivery.certainty === "ambiguous") {
      // Telegram may have accepted the primary card before the response was
      // lost. Persist lastCheck context only now, acknowledge this update and
      // suppress all secondary effects; replaying could duplicate the result.
      console.error("telegram check result delivery ambiguous");
      await persistPrimaryResultContext(
        ctx,
        nextScenarioData,
        lastCheck,
        undefined,
        guardian ?? undefined,
      );
      return;
    }

    if (resultDelivery.retryable) {
      console.error(
        "telegram check result delivery transient",
        resultDelivery.errorCode ?? "config_or_fence",
      );
      throw new TelegramDirectResultDeliveryError(
        directDeliveryRetryMsFromSeconds(resultDelivery.retryAfterSec),
      );
    }

    // A validated permanent Bot API rejection definitely produced no primary
    // message, but retrying forever would poison the webhook/polling frontier.
    console.error("telegram check result delivery terminal", resultDelivery.errorCode ?? "unknown");
    return;
  }

  const primaryContext = await persistPrimaryResultContext(
    ctx,
    nextScenarioData,
    lastCheck,
    resultDelivery?.messageId,
    guardian ?? undefined,
  );
  if (!primaryContext.ok) return;
  let deliveredScenarioData = primaryContext.scenarioData;

  if (guardian && shouldAutoSendGuardianIntro(result)) {
    const guardianDelivery = await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildGuardianAngelIntro(guardian, ctx.session.lang)),
      keyboard: buildGuardianAngelKeyboard(ctx.session.lang, guardian),
    });
    if (guardianDelivery?.ok === false) {
      console.error("telegram guardian intro delivery failed");
      return;
    }
    deliveredScenarioData = await rememberDeliveredCheckResult(
      ctx,
      deliveredScenarioData,
      lastCheck,
      guardianDelivery?.messageId,
      guardian,
    );
  }

  await maybeAutoNotifyTrustedContact(ctx, guardian);
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
  const lastCheck = buildImageUnreadableSnapshot();
  const nextScenarioData = withSessionChatScope(
    {
      ...previousScenarioData,
      lastCheck,
    },
    ctx.chatId,
    ctx.chatType,
  );
  const saved = await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: nextScenarioData,
  });
  if (saved?.ok === false) return;

  const delivery = await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(
      bt(reply === "short" ? "ocr_failed_repeat" : "ocr_failed", ctx.session.lang),
    ),
    keyboard: buildImageTriageKeyboard(ctx.session.lang),
  });
  if (delivery?.ok === false) {
    console.error("telegram image fallback delivery failed");
    await restoreSessionAfterUndeliveredResult(ctx);
    return;
  }
  await rememberDeliveredCheckResult(ctx, nextScenarioData, lastCheck, delivery?.messageId);
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
    if (directDeliveryRetryAfterMs(e) !== null) throw e;
    if (isRateLimitedError(e)) {
      const key =
        e.message === "voice_stt_rate_limited" ? "voice_stt_limit_reached" : "rate_limited";
      await replyText(ctx.chatId, bt(key, ctx.session.lang, { seconds: e.retryAfter }));
      return;
    }
    console.error(`telegram ${label} failed`, "handler_exception");
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
  const trimmed = content.trim();
  const lang = resolveTelegramTextLanguage(trimmed, ctx.session.lang);
  if (lang !== ctx.session.lang) {
    // Message language is an effective per-turn override. Clone the context so
    // every nested formatter/check sees it without mutating the caller's
    // loaded session or adding a write for reply-only intents.
    ctx = { ...ctx, session: { ...ctx.session, lang } };
  }

  if (trimmed.length === 0) {
    await replyText(ctx.chatId, bt("unsupported_input", lang));
    return;
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    // R4.10 — отклоняем слишком длинный ввод вместо передачи невалидного запроса.
    await replyText(ctx.chatId, bt("text_too_long", lang));
    return;
  }

  // Prove completed aftercare before the secret preflight. A natural report
  // such as "I read out the one-time password" names a secret class but does
  // not paste its value; it must reach the urgent rescue route. When an actual
  // credential value is present, sensitiveSecret remains authoritative and
  // the raw input never reaches the panic session, checker, AI, or storage.
  const sensitiveSecret = detectTelegramSensitiveSecret(trimmed);
  const completedPanicId = source ? null : classifyTextPanicIntent(trimmed);
  if (
    (completedPanicId === 1 || completedPanicId === 3) &&
    !hasPastedSensitiveSecretValue(trimmed)
  ) {
    await sendPanicRoute(ctx, completedPanicId);
    return;
  }
  if (sensitiveSecret) {
    const guidance = buildSensitiveSecretGuidance(sensitiveSecret.classes, lang);
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(`${guidance.title}\n\n${guidance.description}`),
    });
    return;
  }

  const questionedPhone = extractQuestionedPhoneNumber(trimmed);

  const victimGuidanceFollowUp = source
    ? null
    : questionedPhone
      ? null
      : classifyVictimGuidanceFollowUp(trimmed, ctx.session.scenarioData.lastVictimIntent);
  const deferVictimNextStepsToEmergency =
    victimGuidanceFollowUp?.action === "next_steps" &&
    hasRecentEmergencyContext(ctx.session.scenarioData);
  if (victimGuidanceFollowUp !== null && !deferVictimNextStepsToEmergency) {
    await sendMessage({
      chatId: ctx.chatId,
      text: contractReplyText(
        canonicalVictimIntentId(victimGuidanceFollowUp.context.kind),
        buildVictimGuidanceFollowUpText(victimGuidanceFollowUp, lang),
      ),
      keyboard: buildVictimIntentKeyboard(lang, victimGuidanceFollowUp.context),
    });
    return;
  }

  // A concrete number question must reach the verified-contact checker. The
  // generic bank-contact intent is useful when no number was supplied, but it
  // must not swallow short-code questions such as «Ишонч телефони 1344ми».
  const directVictimIntent = source || questionedPhone ? null : classifyVictimIntent(trimmed);
  const contextualVictimIntent =
    source || questionedPhone
      ? null
      : classifyVictimContextualFollowUp(trimmed, ctx.session.scenarioData.lastVictimIntent);
  // A narrow confirmation such as Uzbek «rostdan firibgarlarmi» belongs to
  // recent enum-only guidance. It may also look like a standalone generic scam
  // concern, so let only the proven contextual match override that broad route.
  const victimIntent =
    directVictimIntent?.kind === "general_scam_concern" && contextualVictimIntent
      ? contextualVictimIntent
      : (directVictimIntent ?? contextualVictimIntent);
  if (victimIntent !== null && shouldVictimIntentOverridePanic(victimIntent)) {
    await sendVictimIntentGuidance(ctx, victimIntent, lang);
    return;
  }

  // Completed-incident rescue still outranks a number lookup: if the same
  // message says money/code was already sent, route to urgent aftercare.
  const textPanicId =
    completedPanicId ??
    classifyTextPanicIntent(trimmed, source) ??
    (source
      ? null
      : classifyVictimContextualPanicIntent(trimmed, ctx.session.scenarioData.lastVictimIntent));
  if (textPanicId !== null) {
    await sendPanicRoute(
      ctx,
      textPanicId,
      trimmed,
      victimIntent?.kind === "code_request" ? victimIntent : undefined,
    );
    return;
  }

  if (
    victimIntent !== null &&
    hasRecentEmergencyContext(ctx.session.scenarioData ?? {}) &&
    shouldVictimIntentOverrideFollowUps(victimIntent)
  ) {
    await sendVictimIntentGuidance(
      ctx,
      victimIntent,
      lang,
      victimIntent === contextualVictimIntent,
    );
    return;
  }

  if (victimIntent !== null && shouldVictimIntentOverrideGenericHelpers(victimIntent, trimmed)) {
    await sendVictimIntentGuidance(ctx, victimIntent, lang);
    return;
  }

  // A passport/ID event (requested or already shared) is never an explanation
  // of an older result. Keep it ahead of every stale-context follow-up branch
  // even if a classifier later regresses.
  if (
    victimIntent?.kind === "personal_data_request" ||
    victimIntent?.kind === "personal_data_already_shared"
  ) {
    await sendVictimIntentGuidance(ctx, victimIntent, lang);
    return;
  }

  const orphanReplyFollowUp =
    !questionedPhone &&
    ctx.replyToOwnBotMessage &&
    !ctx.replyCheckSnapshot &&
    ctx.session.scenarioData.lastCheck
      ? classifyOrphanCheckFollowUp(trimmed)
      : null;
  if (orphanReplyFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: contractReplyText(
        canonicalFollowUpIntentId(orphanReplyFollowUp),
        buildReplyContextExpiredText(lang),
      ),
    });
    return;
  }

  const guardianScenarioData = ctx.replyGuardianSnapshot
    ? { guardian: ctx.replyGuardianSnapshot }
    : ctx.replyCheckSnapshot
      ? undefined
      : ctx.session.scenarioData;
  const guardianFollowUp = guardianScenarioData
    ? questionedPhone
      ? null
      : classifyGuardianAngelFollowUp(trimmed, guardianScenarioData)
    : null;
  const guardianSnapshot = guardianScenarioData?.guardian;
  if (guardianFollowUp !== null && guardianSnapshot) {
    const delivery = await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildGuardianAngelText(guardianFollowUp, guardianSnapshot, lang)),
      keyboard: buildGuardianAngelKeyboard(lang, guardianSnapshot),
    });
    const guardianLastCheck = ctx.replyCheckSnapshot ?? ctx.session.scenarioData.lastCheck;
    if (guardianLastCheck) {
      await rememberDeliveredCheckResult(
        ctx,
        ctx.session.scenarioData,
        guardianLastCheck,
        delivery?.messageId,
        guardianSnapshot,
      );
    }
    return;
  }

  // Both Emergency Copilot and a later check can recognize short phrases such
  // as "can I contact someone close?". The last-check classifier already
  // compares timestamps and returns null when panic context is newer, so run it
  // before the emergency classifier to prevent an old two-hour panic context
  // from stealing a newer check follow-up.
  const lastCheckScenarioData = ctx.replyCheckSnapshot
    ? { lastCheck: ctx.replyCheckSnapshot }
    : ctx.session.scenarioData;
  const lastCheckFollowUp = questionedPhone
    ? null
    : classifyLastCheckFollowUp(trimmed, lastCheckScenarioData);
  const lastCheckSnapshot = questionedPhone ? undefined : lastCheckScenarioData.lastCheck;
  if (lastCheckFollowUp !== null && lastCheckSnapshot) {
    await sendMessage({
      chatId: ctx.chatId,
      text: contractReplyText(
        canonicalFollowUpIntentId(lastCheckFollowUp),
        buildLastCheckFollowUpText(lastCheckFollowUp, lastCheckSnapshot, lang, trimmed),
      ),
    });
    return;
  }

  const emergencyFollowUp = questionedPhone
    ? null
    : classifyEmergencyFollowUp(trimmed, ctx.session.scenarioData);
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

  const emergencyAcknowledgement = classifyAcknowledgementFollowUp(trimmed);
  if (
    !questionedPhone &&
    emergencyAcknowledgement !== null &&
    hasRecentEmergencyContext(ctx.session.scenarioData ?? {})
  ) {
    await sendMessage({
      chatId: ctx.chatId,
      text: contractReplyText(
        canonicalFollowUpIntentId("acknowledgement"),
        buildAcknowledgementFollowUpText(lang),
      ),
    });
    return;
  }

  const orphanFollowUp = questionedPhone ? null : classifyOrphanCheckFollowUp(trimmed);
  if (orphanFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: contractReplyText(
        canonicalFollowUpIntentId(orphanFollowUp),
        buildOrphanCheckFollowUpText(orphanFollowUp, lang),
      ),
    });
    return;
  }

  if (victimIntent !== null) {
    await sendVictimIntentGuidance(ctx, victimIntent, lang);
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

        const pipelineQuestionedPhone = publicPostEvidence ? null : questionedPhone;
        const checkInput = publicPostEvidence?.checkInput ?? pipelineQuestionedPhone ?? trimmed;
        const checkType = publicPostEvidence
          ? "text"
          : pipelineQuestionedPhone && detectInputType(pipelineQuestionedPhone) === "phone"
            ? "phone"
            : undefined;
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
          await sendCheckResult(
            ctx,
            enrichForwardSourceContext(
              presentSingleEmbeddedUrlResult(cached, checkInput),
              source,
              lang,
            ),
          );
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
              : await enrichTelegramPublicMetadata(checkInput, postResult, lang);
            const enriched = publicPostEvidence
              ? enrichedMetadata
              : await enrichTelegramReputation(checkInput, enrichedMetadata, lang);
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
        await sendCheckResult(
          ctx,
          enrichForwardSourceContext(
            presentSingleEmbeddedUrlResult(enriched, checkInput),
            source,
            lang,
          ),
        );
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
    await claimTelegramImageDownloadBudget(ctx.userId);
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
      const decodedQr = await decodeQrFromDataUrl(dataUrl);
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
  const sensitiveSecret = detectTelegramSensitiveSecret(transcriptText);
  if (sensitiveSecret) {
    await sendVoiceSensitiveSecretGuidance(ctx, sensitiveSecret.classes);
    logTelegramTiming("voice.total", startedAt, {
      cached: source === "cached",
      inFlight: source === "in_flight",
      metadataFallback,
      sensitiveSecret: true,
      transcriptChars: transcriptText.length,
      durationSec: meta?.duration ?? null,
    });
    return;
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
      if (shared.kind === "sensitive_secret") {
        await sendVoiceSensitiveTranscriptNote(ctx);
        await sendVoiceSensitiveSecretGuidance(ctx, shared.classes);
        logTelegramTiming("voice.total", startedAt, {
          cached: false,
          inFlight: true,
          sensitiveSecret: true,
          transcriptChars: shared.transcriptChars,
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
      const sensitiveSecret = detectTelegramSensitiveSecret(transcript.text);
      if (sensitiveSecret) {
        // Do not resolve the shared in-flight promise with the raw credential:
        // callers need only the non-secret class summary and character count.
        return {
          kind: "sensitive_secret" as const,
          classes: sensitiveSecret.classes,
          transcriptChars: transcript.text.length,
        };
      }
      rememberVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcript.text);
      return { kind: "ok", text: transcript.text };
    })();
    rememberInFlightVoiceTranscript(ctx.userId, meta?.fileUniqueId, transcriptWork);

    const outcome = await withTypingIndicator(
      ctx.chatId,
      async () => {
        const transcriptOutcome = await transcriptWork;
        if (transcriptOutcome.kind === "sensitive_secret") {
          await sendVoiceSensitiveTranscriptNote(ctx);
          return transcriptOutcome;
        }
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
    if (outcome.kind === "sensitive_secret") {
      await sendVoiceSensitiveSecretGuidance(ctx, outcome.classes);
      logTelegramTiming("voice.total", startedAt, {
        cached: false,
        sensitiveSecret: true,
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
