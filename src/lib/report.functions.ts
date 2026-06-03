import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize, maskForDisplay, redactText } from "./risk/detect";
import { hashIdentifier } from "./risk/hash";
import { checkRateLimit } from "./risk/rate-limit";

const reportSchema = z.object({
  value: z.string().min(1).max(500),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  description: z.string().min(5).max(5000),
  scamType: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  amountLostUzs: z.number().int().nonnegative().max(10_000_000_000).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

/** Rate limit: 3 reports / 10 minutes per IP. Prevents report spam/flooding. */
const REPORT_RATE_LIMIT = 3;
const REPORT_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/** Resolve the caller IP for report rate-limiting. Falls back to "unknown" when
 *  called outside an HTTP request context (e.g., Telegram bot handler or tests). */
function reportRateLimitKey(): string {
  try {
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
    return `report:${ip}`;
  } catch {
    // No H3 request context (e.g., called from Telegram handler or tests)
    return "report:unknown";
  }
}

/**
 * Rate-limit key for Telegram report submissions. Called by the bot handler
 * which passes the user ID directly (no HTTP context available).
 */
export function reportRateLimitKeyForTelegram(userId: number): string {
  return `report:tg:${userId}`;
}

export const submitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data }) => {
    // ── Rate limit: 3 reports / 10 min per IP ──
    const rl = checkRateLimit(reportRateLimitKey(), REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS);
    if (!rl.ok) {
      return { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec };
    }
    const detected = data.type && data.type !== "unknown" ? data.type : detectInputType(data.value);
    const normalized = normalize(data.value, detected);
    const display = maskForDisplay(normalized, detected);
    const description = redactText(data.description);
    const hash = await hashIdentifier(normalized);

    // Report abuse protection: dedupe by hash + today (prevents spam/flooding).
    // Same entity_hash on the same day = likely duplicate or abuse.
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data: existing } = await supabaseAdmin
      .from("reports")
      .select("id")
      .eq("entity_hash", hash)
      .gte("created_at", `${today}T00:00:00Z`)
      .limit(1);
    if (existing && existing.length > 0) {
      // Silently accept (don't reveal dedup to potential abuser) but don't insert.
      return { ok: true };
    }

    const { error } = await supabaseAdmin.from("reports").insert({
      entity_type: detected,
      entity_hash: hash,
      redacted_value: display,
      description,
      scam_type: data.scamType ?? null,
      city: data.city ?? null,
      amount_lost_uzs: data.amountLostUzs ?? null,
      language: data.lang,
    });

    if (error) {
      console.error("submit report failed", error);
      return { ok: false, error: "Не удалось отправить жалобу. Попробуйте позже." };
    }

    // Bump entity counter (server-managed)
    try {
      const { data: existing } = await supabaseAdmin
        .from("entities")
        .select("id, report_count")
        .eq("entity_hash", hash)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("entities")
          .update({
            report_count: existing.report_count + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("entities").insert({
          entity_type: detected,
          entity_hash: hash,
          display_mask: display,
          risk_level: "suspicious",
          report_count: 1,
          moderation_status: "new",
        });
      }
    } catch (e) {
      console.error("entity upsert failed", e);
    }

    return { ok: true };
  });

/**
 * Check report rate limit for a Telegram user (called by the bot handler).
 * Returns { ok, retryAfterSec } — the handler shows a rate-limit message if !ok.
 */
export function checkReportRateLimit(userId: number): {
  ok: boolean;
  retryAfterSec: number;
} {
  const key = reportRateLimitKeyForTelegram(userId);
  const result = checkRateLimit(key, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS);
  return { ok: result.ok, retryAfterSec: result.retryAfterSec };
}
