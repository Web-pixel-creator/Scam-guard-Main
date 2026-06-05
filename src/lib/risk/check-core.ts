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
import { checkRateLimit } from "./rate-limit";
import { findVerifiedContact, type VerifiedContact } from "./verified-contacts";
import { matchBrandInUrl, matchBrandInText, type BrandEvidence } from "./brand-matcher";
import { normalizeDomain } from "./domain-normalizer";
import { formatBrandImpersonationExplanations } from "./brand-formatter";

/** Источник запроса — для аналитики/логов; не влияет на scoring. */
export type CheckChannel = "web" | "telegram";

export interface RunCheckParams {
  input: string; // сырой ввод пользователя (до redaction)
  type?: InputType; // опционально; иначе detectInputType
  lang: Lang;
  rateLimitKey: string; // "check:<ip>" для веба, "tg:<userId>" для бота
  channel?: CheckChannel; // default "web"
  skipAi?: boolean; // принудительно без AI (например быстрый путь)
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
  verifiedContact: { orgName: string; orgType: string; source: string } | null;
  /** Brand impersonation evidence objects. Empty array if no brand impersonation detected. */
  brandEvidence: BrandEvidence[];
}

export type RateLimitedError = Error & { status: 429; retryAfter: number };

/** Web/bot share the same best-effort limit: 10 requests / minute / key. */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function rateLimitedError(retryAfter: number): RateLimitedError {
  const err = new Error("rate_limited") as RateLimitedError;
  err.status = 429;
  err.retryAfter = retryAfter;
  return err;
}

/**
 * Единый конвейер проверки (rules-first):
 *   rate-limit(rateLimitKey) → detectInputType → normalize →
 *   maskForDisplay + redactText → evaluate* → entities lookup →
 *   scoreFromCodes → aiExplain(optional) → insert into checks.
 */
export async function runCheck(params: RunCheckParams): Promise<RunCheckResult> {
  const { input, type, lang, rateLimitKey, skipAi } = params;

  // ---- Rate limit: 10 checks / minute / key (best-effort, in-memory) ----
  const rl = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
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
  if (["phone", "telegram", "url", "apk"].includes(detected)) {
    const hash = await hashIdentifier(normalized);
    const { data: ent } = await supabaseAdmin
      .from("entities")
      .select("report_count, risk_level, moderation_status")
      .eq("entity_hash", hash)
      .maybeSingle();
    if (ent && ent.moderation_status === "confirmed") {
      knownReports = ent.report_count;
      if (ent.risk_level === "high_risk") codes.add("known_reported");
    }
  }

  const reasonList = [...codes];
  const { score, level } = scoreFromCodes(reasonList);

  // Don't call AI if there are no meaningful reason codes for URL type — it would hallucinate.
  // hosted_app_platform (weight 0) is informational only; it shouldn't trigger AI.
  // For non-URL types, AI can still provide useful context even without codes.
  const hasSignificantReasons = reasonList.some(
    (c) => c !== "hosted_app_platform" && c !== "valid_uz_phone",
  );
  const shouldSkipAi =
    skipAi || (detected === "url" && level === "unknown" && !hasSignificantReasons);

  const explanation = shouldSkipAi
    ? null
    : await aiExplain({
        lang,
        type: detected,
        level,
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
  let finalLevel = level;

  const isShortCode = /^\d{3,5}$/.test(workingInput);
  const shouldLookupVerified = detected === "phone" || isShortCode;

  if (shouldLookupVerified) {
    const lookupValue = detected === "phone" ? normalized : workingInput;
    const match = findVerifiedContact(lookupValue);
    if (match) {
      verifiedContact = {
        orgName: match.org.en,
        orgType: match.orgType,
        source: match.source,
      };
      const DANGEROUS_CODES: readonly string[] = [
        "asks_for_sms_code",
        "asks_for_otp",
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
  }

  // ── Persist to checks (with the FINAL level the user sees) ───────────────
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
  const rl = checkRateLimit(rateLimitKey, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    throw rateLimitedError(rl.retryAfterSec);
  }
  const text = await ocrScreenshot(dataUrl, lang);
  return { text };
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

interface AiConfig {
  apiKey: string;
  baseUrl: string; // no trailing slash
  model: string;
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

/** Low-level: call a specific AI config with timeout. */
async function chatCompletionWith(
  cfg: AiConfig,
  messages: ChatMessage[],
  label: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.error(`AI ${label} error`, res.status);
      return null;
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    console.error(`AI ${label} failed`, e instanceof Error ? e.message : "unknown");
    return null;
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

async function chatCompletion(messages: ChatMessage[], label: string): Promise<string | null> {
  const cfg = getAiConfig();
  if (!cfg) return null;
  if (isAiCircuitOpen()) {
    // Primary is broken — try fallback provider if configured
    const fallback = getFallbackAiConfig();
    if (fallback) {
      return chatCompletionWith(fallback, messages, label + "/fallback");
    }
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error(`AI ${label} error`, res.status);
      recordAiFailure();
      return null;
    }
    const data = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    recordAiSuccess();
    return txt?.trim() ?? null;
  } catch (e) {
    console.error(`AI ${label} failed`, e instanceof Error ? e.message : "unknown");
    recordAiFailure();
    return null;
  }
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
