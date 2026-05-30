import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize, maskForDisplay, redactText } from "./risk/detect";
import {
  evaluatePhone, evaluateTelegram, evaluateText, evaluateUrl,
  scoreFromCodes, type ReasonCode,
} from "./risk/rules";
import { hashIdentifier } from "./risk/hash";
import { checkRateLimit } from "./risk/rate-limit";

const checkSchema = z.object({
  input: z.string().min(1).max(2000),
  type: z.enum(["phone","telegram","url","text","payment","apk","unknown"]).optional(),
  lang: z.enum(["ru","uz","en"]).default("ru"),
});

const ocrSchema = z.object({
  image: z.string().min(1).max(6_000_000),
  lang: z.enum(["ru","uz","en"]).default("ru"),
});

async function aiExplain(opts: {
  lang: "ru"|"uz"|"en";
  type: string;
  level: string;
  redacted: string;
  reasons: string[];
}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const langName = { ru: "Russian", uz: "Uzbek (Latin)", en: "English" }[opts.lang];
  const sys = `You are Ishonch Guard, an anti-scam assistant for Uzbekistan. Reply in ${langName}. Be calm, factual, 2-4 short sentences. Explain WHY the input may be risky based on the listed reason codes. Never accuse a specific person. Never reveal personal data. End with one concrete safe action. No markdown.`;
  const user = `Input type: ${opts.type}\nRisk level: ${opts.level}\nRedacted input: ${opts.redacted}\nReason codes detected: ${opts.reasons.join(", ") || "(none)"}\n\nWrite the explanation.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    return txt?.trim() ?? null;
  } catch (e) {
    console.error("AI explain failed", e);
    return null;
  }
}

/**
 * Extract text from a screenshot via Gemini Vision.
 * The prompt instructs the model to mask OTP codes, full card numbers and
 * full phone numbers so sensitive data never lands in our DB. We additionally
 * run `redactText` as a defence-in-depth step.
 */
async function ocrScreenshot(dataUrl: string, lang: "ru"|"uz"|"en"): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const sys = `You are an OCR + privacy filter. Extract ALL readable text from the image. Then redact sensitive items: replace OTP / SMS confirmation codes with "••••", full card numbers with "•••• •••• •••• ••••", and full phone numbers with their last 2 digits only (e.g. "+998 •••••••12"). Do NOT add commentary or translation — return only the cleaned, redacted text exactly as it appears. Reply language: ${lang}.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract text from this screenshot following the rules." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OCR error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    return txt?.trim() ?? null;
  } catch (e) {
    console.error("OCR failed", e);
    return null;
  }
}

export const checkInput = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkSchema.parse(data))
  .handler(async ({ data }) => {
    // ---- Rate limit: 10 checks / minute / IP (best-effort, in-memory) ----
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
    const rl = checkRateLimit(`check:${ip}`, 10, 60_000);
    if (!rl.ok) {
      const err = new Error("rate_limited");
      (err as { status?: number; retryAfter?: number }).status = 429;
      (err as { retryAfter?: number }).retryAfter = rl.retryAfterSec;
      throw err;
    }

    const workingInput = data.input.trim();

    const detected = data.type && data.type !== "unknown"
      ? data.type
      : detectInputType(workingInput);
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

    const explanation = await aiExplain({
      lang: data.lang, type: detected, level, redacted: display, reasons: reasonList,
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
        language: data.lang,
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
  });

export const ocrExtract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ocrSchema.parse(data))
  .handler(async ({ data }) => {
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
    const rl = checkRateLimit(`check:${ip}`, 10, 60_000);
    if (!rl.ok) {
      const err = new Error("rate_limited");
      (err as { status?: number }).status = 429;
      (err as { retryAfter?: number }).retryAfter = rl.retryAfterSec;
      throw err;
    }
    const text = await ocrScreenshot(data.image, data.lang);
    return { text };
  });
