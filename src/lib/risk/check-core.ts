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
  if (detected === "url" || detected === "apk") evaluateUrl(normalized).forEach((c) => codes.add(c));
  if (detected === "apk") codes.add("apk_download_link");

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
      if (ent.risk_level === "high_risk") codes.add("asks_to_install_apk" as ReasonCode);
    }
  }

  const reasonList = [...codes];
  const { score, level } = scoreFromCodes(reasonList);

  const explanation = skipAi
    ? null
    : await aiExplain({
        lang,
        type: detected,
        level,
        redacted: display,
        reasons: reasonList,
      });

  const inputHash = await hashIdentifier(normalized || safeInput);
  try {
    await supabaseAdmin.from("checks").insert({
      input_type: detected,
      redacted_input: display,
      input_hash: inputHash,
      risk_level: level,
      risk_score: score,
      reason_codes: reasonList,
      ai_explanation: explanation,
      language: lang,
    });
  } catch (e) {
    console.error("log check failed", e);
  }

  return {
    type: detected,
    display,
    level,
    score,
    reasons: reasonList,
    explanation,
    knownReports,
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

/** Body shape accepted by the OpenAI-compatible Chat Completions API. */
type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

/**
 * Call the OpenAI-compatible Chat Completions endpoint and return the assistant
 * message content, or `null` on any failure (missing key, non-2xx, network or
 * parse error). Never throws — callers degrade gracefully.
 */
async function chatCompletion(messages: ChatMessage[], label: string): Promise<string | null> {
  const cfg = getAiConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages }),
    });
    if (!res.ok) {
      // Log status only — never the prompt content or the API key.
      console.error(`AI ${label} error`, res.status);
      return null;
    }
    const data = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    return txt?.trim() ?? null;
  } catch (e) {
    console.error(`AI ${label} failed`, e instanceof Error ? e.message : "unknown");
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
  const sys = `You are Ishonch Guard, an anti-scam assistant for Uzbekistan. Reply in ${langName}. Be calm, factual, 2-4 short sentences. Explain WHY the input may be risky based on the listed reason codes. Never accuse a specific person. Never reveal personal data. End with one concrete safe action. No markdown.`;
  const user = `Input type: ${opts.type}\nRisk level: ${opts.level}\nRedacted input: ${opts.redacted}\nReason codes detected: ${opts.reasons.join(", ") || "(none)"}\n\nWrite the explanation.`;
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
  const sys = `You are an OCR + privacy filter. Extract ALL readable text from the image. Then redact sensitive items: replace OTP / SMS confirmation codes with "••••", full card numbers with "•••• •••• •••• ••••", and full phone numbers with their last 2 digits only (e.g. "+998 •••••••12"). Do NOT add commentary or translation — return only the cleaned, redacted text exactly as it appears. Reply language: ${lang}.`;
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
