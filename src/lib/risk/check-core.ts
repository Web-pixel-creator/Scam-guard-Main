// Transport-independent risk-check core.
// Holds the full check pipeline that used to live inside `checkInput.handler`,
// decoupled from HTTP / Telegram. Callers pass an already-computed
// `rateLimitKey` ("check:<ip>" for web, "tg:<userId>" for the bot).
//
// Contract (see design.md → "Общее ядро проверки check-core.ts"):
//  - score/level are computed ONLY by `scoreFromCodes` (deterministic, R13.5).
//  - Only redacted + hashed data is written to `checks` (R7).
//  - On rate-limit overflow it throws `RateLimitedError` (status 429, retryAfter).
//  - `explanation === null` when no AI provider is configured (`OPENAI_API_KEY`
//    missing) or the AI call fails (R13).
//  - When `skipAi: true`, AI is never called.
//
// AI provider: provider-neutral, OpenAI-compatible Chat Completions API. Set
// `OPENAI_API_KEY` (required to enable AI), `OPENAI_MODEL` (default
// "gpt-4o-mini", must be vision-capable for screenshot OCR), and optionally
// `OPENAI_BASE_URL` (default "https://api.openai.com/v1") to point at any
// OpenAI-compatible gateway (OpenAI, OpenRouter, Together, a local server, …).
import type { Lang } from "@/lib/i18n";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize, maskForDisplay, redactText, type InputType } from "./detect";
import {
  evaluatePhone,
  evaluateTelegram,
  evaluateText,
  evaluateUrl,
  scoreFromCodes,
  type ReasonCode,
  type RiskLevel,
} from "./rules";
import { hashIdentifier } from "./hash";
import { checkSharedRateLimit } from "./shared-rate-limit.server";
import { findVerifiedContact, type VerifiedContact } from "./verified-contacts";
import { matchBrandInUrl, matchBrandInText, type BrandEvidence } from "./brand-matcher";
import { normalizeDomain } from "./domain-normalizer";
import { formatBrandImpersonationExplanations } from "./brand-formatter";
import {
  fallbackImageIntelligence,
  sanitizeImageIntelligence,
  type ImageIntelligenceResult,
} from "./image-intelligence";
import {
  buildPhoneIntelligencePassport,
  type PhoneIntelligencePassport,
} from "./phone-intelligence";
import { buildPhoneReputationSummary, type PhoneReputationSummary } from "./phone-reputation";

/** Источник запроса — для аналитики/логов; не влияет на scoring. */
export type CheckChannel = "web" | "telegram";

export interface RunCheckParams {
  input: string; // сырой ввод пользователя (до redaction)
  type?: InputType; // опционально; иначе detectInputType
  lang: Lang;
  rateLimitKey: string; // "check:<ip>" для веба, "tg:<userId>" для бота
  channel?: CheckChannel; // default "web"
  /** Set false for non-final previews such as Telegram inline typing. */
  persist?: boolean;
  skipAi?: boolean; // принудительно без AI (например быстрый путь)
  /** High-confidence benign image contexts may become safe, but only with zero reason codes. */
  safeIfNoReasons?: boolean;
}

export interface RunCheckResult {
  type: InputType;
  display: string; // maskForDisplay — безопасно для показа
  level: RiskLevel;
  score: number;
  reasons: ReasonCode[];
  explanation: string | null; // null при недоступном AI (деградация, R13)
  knownReports: number; // >0 только для Confirmed_Entity
  /** Verified official contact match (D-011). null if not matched. */
  verifiedContact: {
    orgName: string;
    orgType: VerifiedContact["orgType"];
    source: string;
    display: string;
    contactType: VerifiedContact["contactType"];
    verificationLevel: VerifiedContact["verificationLevel"];
    description: string;
  } | null;
  /** Brand impersonation evidence objects. Empty array if no brand impersonation detected. */
  brandEvidence: BrandEvidence[];
  /** Honest phone metadata: country/prefix/official-directory status. No owner inference. */
  phoneIntelligence?: PhoneIntelligencePassport | null;
  /** Confirmed, moderated Ishonch Guard reports for this phone. No owner inference. */
  phoneReputation?: PhoneReputationSummary | null;
}

export type RateLimitedError = Error & { status: 429; retryAfter: number };

/** Web/bot share the same best-effort limit: 10 requests / minute / key. */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const POSSIBLE_VERIFIED_CONTACT_RE = /@[a-zA-Z][a-zA-Z0-9_]{3,}|\+?\d[\d\s().-]{2,}\d/g;
const EMBEDDED_URL_RE =
  /\bhttps?:\/\/[^\s<>()]+|\b(?:t\.me|telegram\.me)\/\+[a-zA-Z0-9_-]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/gi;
const TELEGRAM_INVITE_URL_RE = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/\+[a-zA-Z0-9_-]+/i;

function rateLimitedError(retryAfter: number): RateLimitedError {
  const err = new Error("rate_limited") as RateLimitedError;
  err.status = 429;
  err.retryAfter = retryAfter;
  return err;
}

function findVerifiedContactForCheck(
  input: string,
  detected: InputType,
  normalized: string,
): VerifiedContact | null {
  const trimmed = input.trim();
  const isShortCode = /^\d{3,5}$/.test(trimmed);

  if (detected === "phone" || isShortCode) {
    return findVerifiedContact(detected === "phone" ? normalized : trimmed);
  }

  const candidates = trimmed.match(POSSIBLE_VERIFIED_CONTACT_RE) ?? [];
  for (const candidate of candidates) {
    const match = findVerifiedContact(candidate);
    if (match) return match;
  }

  return null;
}

function cleanEmbeddedUrl(raw: string): string {
  return raw.replace(/[.,!?;:)\]}>"'`]+$/g, "");
}

function extractEmbeddedUrls(input: string, max = 5): string[] {
  const found = new Set<string>();
  for (const match of input.matchAll(EMBEDDED_URL_RE)) {
    const cleaned = cleanEmbeddedUrl(match[0]);
    if (cleaned.length > 0) found.add(cleaned);
    if (found.size >= max) break;
  }
  return [...found];
}

/**
 * Единый конвейер проверки (rules-first):
 *   rate-limit(rateLimitKey) → detectInputType → normalize →
 *   maskForDisplay + redactText → evaluate* → entities lookup →
 *   scoreFromCodes → aiExplain(optional) → insert into checks.
 */
export async function runCheck(params: RunCheckParams): Promise<RunCheckResult> {
  const { input, type, lang, rateLimitKey, skipAi, persist, safeIfNoReasons } = params;

  // ---- Rate limit: 10 checks / minute / key (shared in production) ----
  const rl = await checkSharedRateLimit("check", rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    throw rateLimitedError(rl.retryAfterSec);
  }

  const workingInput = input.trim();

  const detected = type && type !== "unknown" ? type : detectInputType(workingInput);
  const normalized = normalize(workingInput, detected);
  const display = maskForDisplay(normalized, detected);
  const safeInput = redactText(workingInput);

  const codes = new Set<ReasonCode>();
  evaluateText(safeInput).forEach((c) => codes.add(c));
  if (detected === "phone") evaluatePhone(normalized).forEach((c) => codes.add(c));
  if (detected === "telegram") evaluateTelegram(normalized).forEach((c) => codes.add(c));
  if (detected === "url" || detected === "apk")
    evaluateUrl(normalized).forEach((c) => codes.add(c));
  if (detected === "text" || detected === "unknown") {
    for (const embeddedUrl of extractEmbeddedUrls(safeInput)) {
      evaluateUrl(embeddedUrl).forEach((c) => codes.add(c));
      if (TELEGRAM_INVITE_URL_RE.test(embeddedUrl)) codes.add("suspicious_invite_link");
    }
  }
  if (detected === "apk") codes.add("apk_download_link");

  // ── Brand Impersonation Detection ────────────────────────────────────────
  // Runs after evaluateUrl/evaluateText. Wrapped in try/catch for graceful
  // degradation: if brand detection fails, existing rules still work (R9.7).
  let brandEvidence: BrandEvidence[] = [];
  try {
    if (detected === "url" || detected === "apk") {
      // URL input: normalize domain and check for brand impersonation in URL
      const normalizedDomain = normalizeDomain(normalized);
      const urlResult = matchBrandInUrl(normalizedDomain, normalizedDomain.hostname);
      if (urlResult.detected) {
        codes.add("brand_impersonation");
        brandEvidence = urlResult.evidence;
      }
    }

    if (detected === "text" || detected === "unknown") {
      // Text input: check for brand mentions with suspicious context
      const reasonList = [...codes] as ReasonCode[];
      const textResult = matchBrandInText(safeInput, [], reasonList);
      if (textResult.detected) {
        codes.add("brand_impersonation");
        brandEvidence = [...brandEvidence, ...textResult.evidence];
      }
    }
  } catch (e) {
    // Graceful degradation: log and continue without brand_impersonation.
    // Existing rules (weird_domain, hosted_app_platform, etc.) still provide protection.
    console.error("brand detection failed", e instanceof Error ? e.message : "unknown");
  }

  let knownReports = 0;
  let phoneReputation: PhoneReputationSummary | null = null;
  if (["phone", "telegram", "url", "apk"].includes(detected)) {
    const hash = await hashIdentifier(normalized);
    const { data: ent } = await supabaseAdmin
      .from("entities")
      .select("report_count, risk_level, moderation_status")
      .eq("entity_hash", hash)
      .maybeSingle();
    if (ent && ent.moderation_status === "confirmed") {
      knownReports = ent.report_count;
      if (detected === "phone") {
        phoneReputation = buildPhoneReputationSummary(ent);
      }
      if (ent.risk_level === "high_risk") codes.add("known_reported");
    }
  }

  const reasonList = [...codes];
  const { score, level } = scoreFromCodes(reasonList);
  const scoredLevel: RiskLevel = safeIfNoReasons && reasonList.length === 0 ? "safe" : level;

  // Don't call AI if there are no meaningful reason codes for URL type — it would hallucinate.
  // hosted_app_platform (weight 0) is informational only; it shouldn't trigger AI.
  // For non-URL types, AI can still provide useful context even without codes.
  const hasSignificantReasons = reasonList.some(
    (c) => c !== "hosted_app_platform" && c !== "valid_uz_phone",
  );
  const shouldSkipAi =
    skipAi || (detected === "url" && scoredLevel === "unknown" && !hasSignificantReasons);

  const explanation = shouldSkipAi
    ? null
    : await aiExplain({
        lang,
        type: detected,
        level: scoredLevel,
        redacted: display,
        reasons: reasonList,
      });

  // ── Brand impersonation explanation (formatter integration) ─────────────
  // When brand impersonation is detected, append formatted brand explanations
  // to the AI explanation (or use them as the explanation if AI is unavailable).
  let finalExplanation = explanation;
  if (brandEvidence.length > 0) {
    try {
      const brandExplanations = formatBrandImpersonationExplanations(brandEvidence, lang);
      const brandText = brandExplanations.join("\n");
      if (finalExplanation) {
        finalExplanation = finalExplanation + "\n\n" + brandText;
      } else {
        finalExplanation = brandText;
      }
    } catch (e) {
      // If formatter fails, keep the existing explanation (or null)
      console.error("brand formatter failed", e instanceof Error ? e.message : "unknown");
    }
  }

  // ── Verified contact lookup (D-011) ──────────────────────────────────────
  // Check if the input matches a known official contact. Works for:
  //   - detected "phone" (full numbers like +998712000044)
  //   - short digit-only inputs (1340, 0611, 1257, 102) even when detected as "text"
  // If match + no dangerous reason codes → lower to "safe". Dangerous behavior
  // (OTP/APK/card requests) always overrides verified match.
  let verifiedContact: RunCheckResult["verifiedContact"] = null;
  let finalLevel = scoredLevel;

  const match = findVerifiedContactForCheck(workingInput, detected, normalized);
  if (match) {
    verifiedContact = {
      orgName: match.org[lang],
      orgType: match.orgType,
      source: match.source,
      display: match.display,
      contactType: match.contactType,
      verificationLevel: match.verificationLevel,
      description: match.description[lang],
    };
    const DANGEROUS_CODES: readonly string[] = [
      "asks_for_sms_code",
      "asks_for_otp",
      "asks_for_card_cvv",
      "asks_for_pin",
      "asks_to_share_screen",
      "asks_to_transfer_to_safe_account",
      "requests_personal_data",
      "requests_card_digits",
      "asks_to_install_apk",
      "apk_download_link",
      "asks_to_scan_qr",
      "payment_before_service",
    ];
    const hasDangerous = reasonList.some((c) => DANGEROUS_CODES.includes(c));
    if (!hasDangerous) {
      finalLevel = "safe";
    }
  }

  const isShortCodeInput = /^\d{3,5}$/.test(workingInput);
  const phoneIntelligence =
    detected === "phone" || isShortCodeInput
      ? buildPhoneIntelligencePassport(workingInput, normalized, match)
      : null;

  // ── Persist to checks (with the FINAL level the user sees) ───────────────
  if (persist !== false) {
    const inputHash = await hashIdentifier(normalized || safeInput);
    try {
      await supabaseAdmin.from("checks").insert({
        input_type: detected,
        redacted_input: display,
        input_hash: inputHash,
        risk_level: finalLevel,
        risk_score: score,
        reason_codes: reasonList,
        ai_explanation: finalExplanation,
        language: lang,
      });
    } catch (e) {
      console.error("log check failed", e);
    }
  }

  return {
    type: detected,
    display,
    level: finalLevel,
    score,
    reasons: reasonList,
    explanation: finalExplanation,
    knownReports,
    verifiedContact,
    brandEvidence,
    phoneIntelligence,
    phoneReputation,
  };
}

/**
 * OCR-ядро: извлечение + редактирование текста из data URL изображения.
 * Применяет тот же rate-limit, что и runCheck, по переданному ключу.
 */
export async function ocrExtractCore(
  dataUrl: string,
  lang: Lang,
  rateLimitKey: string,
): Promise<{ text: string | null }> {
  const rl = await checkSharedRateLimit("check", rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    throw rateLimitedError(rl.retryAfterSec);
  }
  const text = await ocrScreenshot(dataUrl, lang);
  return { text };
}

/**
 * Structured image understanding for Telegram photos/screenshots.
 *
 * Unlike `ocrExtractCore`, this returns sanitized evidence: visual category,
 * QR purpose, risk hints and redacted text. The image itself stays in memory
 * only and is never persisted. Scoring still happens later in `runCheck`.
 */
export async function analyzeImageCore(
  dataUrl: string,
  lang: Lang,
  rateLimitKey: string,
): Promise<ImageIntelligenceResult | null> {
  const rl = await checkSharedRateLimit("check", rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    throw rateLimitedError(rl.retryAfterSec);
  }
  const raw = await analyzeScreenshotImage(dataUrl, lang);
  if (!raw) return null;
  return sanitizeImageIntelligence(raw) ?? fallbackImageIntelligence(raw);
}

/**
 * Voice-note transcription for Telegram.
 *
 * Audio stays in memory as a data URL. The returned text is redacted and clipped
 * before the Telegram handler passes it into `runCheck`, so persistence still
 * sees only sanitized check input.
 */
export async function transcribeVoiceCore(
  dataUrl: string,
  lang: Lang,
  rateLimitKey: string,
): Promise<{ text: string | null }> {
  const rl = await checkSharedRateLimit("check", rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    throw rateLimitedError(rl.retryAfterSec);
  }

  const cfg = getAiConfig();
  if (!cfg) return { text: null };

  const parsed = parseDataUrlPayload(dataUrl);
  if (!parsed || !parsed.mimeType.startsWith("audio/")) return { text: null };

  const raw = isGeminiConfig(cfg)
    ? await transcribeAudioWithGemini(cfg, parsed, lang)
    : await transcribeAudioWithOpenAiCompatible(cfg, parsed, lang);

  return { text: sanitizeTranscript(raw) };
}

// ---------------------------------------------------------------------------
// AI helpers (private). Secrets are read INSIDE the functions (per-request,
// CODING_RULES §6), never at module scope.
//
// Provider-neutral: any OpenAI-compatible Chat Completions endpoint. The only
// hard requirement to ENABLE AI is `OPENAI_API_KEY`; without it both helpers
// return null and the pipeline degrades gracefully (rules-only, R13).
// ---------------------------------------------------------------------------

const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_AI_MODEL = "gpt-4o-mini";
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const MAX_TRANSCRIPT_CHARS = 2000;

interface AiConfig {
  apiKey: string;
  baseUrl: string; // no trailing slash
  model: string;
}

interface DataUrlPayload {
  mimeType: string;
  base64: string;
}

/**
 * Resolve the OpenAI-compatible AI config from the environment, per-request.
 * Returns `null` when no API key is set, which is the signal to degrade to a
 * rules-only result (`explanation`/OCR `text` === null).
 */
function getAiConfig(): AiConfig | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_AI_MODEL;
  return { apiKey, baseUrl, model };
}

/** Optional fallback provider (used when primary is circuit-broken). */
function getFallbackAiConfig(): AiConfig | null {
  const fallbackUrl = process.env.OPENAI_FALLBACK_BASE_URL;
  if (!fallbackUrl) return null;
  const apiKey = process.env.OPENAI_FALLBACK_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_FALLBACK_MODEL ?? DEFAULT_AI_MODEL;
  return { apiKey, baseUrl: fallbackUrl.replace(/\/+$/, ""), model };
}

function getTranscriptionModel(cfg: AiConfig): string {
  return process.env.OPENAI_TRANSCRIBE_MODEL ?? process.env.OPENAI_AUDIO_MODEL ?? cfg.model;
}

function parseDataUrlPayload(dataUrl: string): DataUrlPayload | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1].trim().toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  if (!mimeType || !base64) return null;
  return { mimeType, base64 };
}

function sanitizeTranscript(raw: string | null): string | null {
  const text = raw?.trim();
  if (!text) return null;
  const redacted = redactText(text).trim();
  if (!redacted) return null;
  return redacted.length > MAX_TRANSCRIPT_CHARS
    ? redacted.slice(0, MAX_TRANSCRIPT_CHARS).trim()
    : redacted;
}

function isGeminiConfig(cfg: AiConfig): boolean {
  return /generativelanguage\.googleapis\.com/i.test(cfg.baseUrl);
}

function geminiNativeModelName(model: string): string {
  return model.replace(/^models\//, "");
}

function extractGeminiText(data: unknown): string | null {
  const candidate = (data as { candidates?: unknown[] })?.candidates?.[0] as
    | { content?: { parts?: Array<{ text?: unknown }> } }
    | undefined;
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
}

async function transcribeAudioWithGemini(
  cfg: AiConfig,
  payload: DataUrlPayload,
  lang: Lang,
): Promise<string | null> {
  const model = geminiNativeModelName(getTranscriptionModel(cfg));
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const langName = { ru: "Russian", uz: "Uzbek or Russian", en: "English" }[lang];
  const prompt = `Transcribe this Telegram voice note for an anti-scam assistant. Keep the speaker's language when possible (${langName}). Return only the transcript, no advice. Redact any OTP/SMS code, PIN, CVV, password, full phone number, or full card number. If speech is not understandable, return an empty string.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: payload.mimeType, data: payload.base64 } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`AI voice transcription error ${res.status}`);
      return null;
    }
    return extractGeminiText(await res.json());
  } catch (e) {
    console.error(`AI voice transcription failed: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeAudioWithOpenAiCompatible(
  cfg: AiConfig,
  payload: DataUrlPayload,
  lang: Lang,
): Promise<string | null> {
  const bytes = Uint8Array.from(Buffer.from(payload.base64, "base64"));
  const form = new FormData();
  form.set("model", getTranscriptionModel({ ...cfg, model: DEFAULT_TRANSCRIBE_MODEL }));
  form.set("response_format", "json");
  if (lang === "ru" || lang === "en") form.set("language", lang);
  form.set("file", new Blob([bytes], { type: payload.mimeType }), "telegram-voice.ogg");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`AI voice transcription error ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === "string" ? data.text.trim() : null;
  } catch (e) {
    console.error(`AI voice transcription failed: ${e instanceof Error ? e.message : "unknown"}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Body shape accepted by the OpenAI-compatible Chat Completions API. */
type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
      >;
    };

/**
 * Call the OpenAI-compatible Chat Completions endpoint and return the assistant
 * message content, or `null` on any failure (missing key, non-2xx, network or
 * parse error). Never throws — callers degrade gracefully.
 */

// ── AI Circuit Breaker ────────────────────────────────────────────────────
// After AI_CIRCUIT_THRESHOLD consecutive failures, skip AI for
// AI_CIRCUIT_COOLDOWN_MS to avoid hanging on a dead provider.
const AI_CIRCUIT_THRESHOLD = 3;
const AI_CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const AI_TIMEOUT_MS = 10_000; // 10 seconds per request
const AI_MAX_ATTEMPTS = 3; // initial attempt + 2 retries
const AI_RETRY_BACKOFF_MS = [50, 150] as const;

let aiConsecutiveFailures = 0;
let aiCircuitOpenUntil = 0;

function isAiCircuitOpen(): boolean {
  if (aiCircuitOpenUntil === 0) return false;
  if (Date.now() >= aiCircuitOpenUntil) {
    // Cooldown elapsed — reset and try again
    aiCircuitOpenUntil = 0;
    aiConsecutiveFailures = 0;
    return false;
  }
  return true;
}

function recordAiFailure(): void {
  aiConsecutiveFailures++;
  if (aiConsecutiveFailures >= AI_CIRCUIT_THRESHOLD) {
    aiCircuitOpenUntil = Date.now() + AI_CIRCUIT_COOLDOWN_MS;
    console.error(
      `AI circuit breaker OPEN — skipping AI for ${AI_CIRCUIT_COOLDOWN_MS / 1000}s after ${aiConsecutiveFailures} failures`,
    );
  }
}

function recordAiSuccess(): void {
  aiConsecutiveFailures = 0;
}

function isAiQuotaExhausted(status: number, body: string): boolean {
  return (
    status === 429 &&
    /RESOURCE_EXHAUSTED|quota exceeded|generate_content_free_tier_requests/i.test(body)
  );
}

function isTransientAiStatus(status: number, body = ""): boolean {
  if (isAiQuotaExhausted(status, body)) return false;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelay(attemptIndex: number): number {
  return AI_RETRY_BACKOFF_MS[attemptIndex] ?? AI_RETRY_BACKOFF_MS[AI_RETRY_BACKOFF_MS.length - 1];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === "AbortError";
}

async function safeResponseText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function callChatCompletionOnce(
  cfg: AiConfig,
  messages: ChatMessage[],
  label: string,
  attempt: number,
): Promise<{ kind: "success"; text: string | null } | { kind: "failure"; transient: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await safeResponseText(res);
      const transient = isTransientAiStatus(res.status, body);
      const quotaExhausted = isAiQuotaExhausted(res.status, body);
      console.error(
        `AI ${label} error ${res.status} (attempt ${attempt}/${AI_MAX_ATTEMPTS}, transient=${transient}, quota_exhausted=${quotaExhausted})`,
      );
      return { kind: "failure", transient };
    }

    const data = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    return { kind: "success", text: txt?.trim() ?? null };
  } catch (e) {
    const transient = !isAbortError(e);
    console.error(
      `AI ${label} failed (attempt ${attempt}/${AI_MAX_ATTEMPTS}, transient=${transient}): ${
        e instanceof Error ? e.message : "unknown"
      }`,
    );
    return { kind: "failure", transient };
  } finally {
    clearTimeout(timeout);
  }
}

async function chatCompletionWithRetry(
  cfg: AiConfig,
  messages: ChatMessage[],
  label: string,
): Promise<{ text: string | null; transientFailure: boolean }> {
  for (let i = 0; i < AI_MAX_ATTEMPTS; i++) {
    const attempt = i + 1;
    const result = await callChatCompletionOnce(cfg, messages, label, attempt);
    if (result.kind === "success") return { text: result.text, transientFailure: false };
    if (!result.transient) return { text: null, transientFailure: false };
    if (attempt >= AI_MAX_ATTEMPTS) return { text: null, transientFailure: true };
    await delay(retryDelay(i));
  }
  return { text: null, transientFailure: true };
}

async function chatCompletion(messages: ChatMessage[], label: string): Promise<string | null> {
  const cfg = getAiConfig();
  if (!cfg) return null;
  const fallback = getFallbackAiConfig();

  if (isAiCircuitOpen()) {
    // Primary is broken — try fallback provider if configured.
    if (fallback) {
      const fallbackResult = await chatCompletionWithRetry(fallback, messages, label + "/fallback");
      return fallbackResult.text;
    }
    return null;
  }
  const result = await chatCompletionWithRetry(cfg, messages, label);
  if (result.text !== null) {
    recordAiSuccess();
    return result.text;
  }

  if (fallback) {
    const fallbackResult = await chatCompletionWithRetry(fallback, messages, label + "/fallback");
    if (fallbackResult.text !== null) {
      recordAiSuccess();
      return fallbackResult.text;
    }
  }

  if (result.transientFailure) recordAiFailure();
  return null;
}

async function aiExplain(opts: {
  lang: Lang;
  type: string;
  level: string;
  redacted: string;
  reasons: string[];
}): Promise<string | null> {
  const langName = { ru: "Russian", uz: "Uzbek (Latin)", en: "English" }[opts.lang];
  const sys = `You are Ishonch Guard, an anti-scam assistant for Uzbekistan. Reply in ${langName}. Be calm, factual, and practical in 2-4 short sentences. If reason codes are present, explain the risk from those signals only. If there are no reason codes, do not invent danger: say that there is not enough evidence, briefly identify the likely message type when obvious (for example delivery pickup SMS, restaurant QR menu, promo, or normal contact), and mention which dangerous requests are missing. Never accuse a specific person. Never reveal personal data. End with one concrete safe action. No markdown.`;
  const user = `Input type: ${opts.type}\nRisk level: ${opts.level}\nRedacted input: ${opts.redacted}\nReason codes detected: ${opts.reasons.join(", ") || "(none)"}\n\nWrite the user-facing explanation.`;
  return chatCompletion(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    "explain",
  );
}

/**
 * Extract text from a screenshot via a vision-capable model (set `OPENAI_MODEL`
 * to a vision model). The prompt instructs the model to mask OTP codes, full
 * card numbers and full phone numbers so sensitive data never lands in our DB.
 * We additionally run `redactText` as a defence-in-depth step.
 */
async function ocrScreenshot(dataUrl: string, lang: Lang): Promise<string | null> {
  const sys = `You are an OCR + privacy filter for an anti-scam bot. Extract ALL readable text from the image, including sender names, visible domains, labels near QR codes, and short context like "SMS screenshot", "restaurant menu", or "QR code visible" when it is obvious from the image. If a QR URL is visibly printed next to the QR, include that URL; do not guess or claim to decode a QR that is not visibly readable. Then redact sensitive items: replace OTP / SMS confirmation codes with "••••", full card numbers with "•••• •••• •••• ••••", and full phone numbers with their last 2 digits only (e.g. "+998 •••••••12"). Do NOT add advice, verdicts, translation, or analysis — return only the cleaned, redacted text/context. Reply language: ${lang}.`;
  const text = await chatCompletion(
    [
      { role: "system", content: sys },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract text from this screenshot following the rules." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    "ocr",
  );
  return text ? redactText(text) : null;
}

async function analyzeScreenshotImage(dataUrl: string, lang: Lang): Promise<string | null> {
  const sys = `You are a structured image evidence extractor for Ishonch Guard, an anti-scam assistant for Uzbekistan.

Return JSON only. No markdown. No advice. No verdict.

Schema:
{
  "text": string|null,
  "visualCategory": "delivery_sms"|"restaurant_menu_qr"|"qr_menu_or_info"|"qr_login_or_payment"|"chat_screenshot"|"payment_request"|"apk_prompt"|"document"|"telegram_promo_post"|"casino_or_betting_promo"|"crypto_giveaway_or_nft"|"wallet_or_defi_action"|"news_or_channel_post"|"unknown",
  "confidence": "low"|"medium"|"high",
  "qr": { "present": boolean, "visibleUrl": string|null, "purpose": "menu"|"info"|"login"|"payment"|"unknown" },
  "riskHints": Array<"otp_or_secret"|"apk_install"|"qr_login"|"qr_payment"|"payment_request"|"card_data"|"urgent_pressure"|"brand_impersonation"|"casino_bonus_or_free_spins"|"fake_captcha_or_voting"|"giveaway_or_prize_actions"|"task_reward_or_engagement"|"wallet_or_defi_urgency"|"ton_referral_or_earning"|"telegram_invite_or_private_link">,
  "summary": string|null
}

Rules:
- Extract only visible text. Do not guess QR contents unless a URL is visibly printed.
- For Telegram post screenshots and video frames, preserve visible channel names, usernames, domains, link previews, button labels, captions, promo conditions, reward amounts, and any words about casino, free spins, NFT, Stars, TON, wallet, voting, captcha, deposits, invite/referral, or urgent actions.
- Use Telegram/Web3 promo categories and riskHints only when visible text combines a topic with an action or reward: casino/free spins plus deposit/bonus/link; NFT/Stars/gift plus captcha/vote/reaction/subscribe; wallet/DeFi plus urgency/top-up/fees/liquidation; TON/crypto plus invite/referral earning.
- Treat visible "spin", "777", "lucky draw/ludka", "claim", "gift for Stars", public contest/voting domains, and Telegram bot/app buttons as action mechanics when they are tied to NFT, Stars, tokens, prizes, or rewards.
- Redact OTP/SMS codes, PINs, passwords, full card numbers, passport data and full phone numbers.
- A restaurant menu, restaurant poster, loyalty promo, table booking poster, or informational QR is NOT dangerous by itself. Use riskHints only if it visibly asks for payment, login, card data, SMS code, APK install or money transfer.
- A normal delivery pickup/order SMS is NOT dangerous by itself. Use riskHints only if there is a link, fee/payment request, OTP/code request, APK install, card data request, or pressure.
- If text is blurry, set confidence "low" and keep text null or partial.
- summary must be one short factual sentence in ${lang}.`;

  return chatCompletion(
    [
      { role: "system", content: sys },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract structured anti-scam evidence from this image." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    "image-intelligence",
  );
}
