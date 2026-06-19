import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INCIDENT_ONLY_HASH_PREFIX, INCIDENT_ONLY_REDACTED_VALUE } from "@/lib/report-boundary";
import { detectInputType, normalize, maskForDisplay, redactText } from "./risk/detect";
import { hashIdentifier } from "./risk/hash";
import { checkRateLimit } from "./risk/rate-limit";
import { checkSharedRateLimit } from "./risk/shared-rate-limit.server";
import { registerTelegramReportCandidate } from "@/lib/telegram/reputation.server";
import { notifyModeration } from "@/lib/telegram/moderation-notifier.server";

const reportSchema = z.object({
  value: z.string().min(1).max(500),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  description: z.string().min(5).max(5000),
  scamType: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  amountLostUzs: z.number().int().nonnegative().max(10_000_000_000).optional(),
  incidentOnly: z.boolean().default(false),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

type ReportInput = z.input<typeof reportSchema>;
type SubmitReportResult = { ok: true } | { ok: false; error: string; retryAfterSec?: number };

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

export async function submitReportCore(
  data: ReportInput,
  rateLimitKey: string,
): Promise<SubmitReportResult> {
  const report = reportSchema.parse(data);
  const rl = await checkSharedRateLimit(
    "report",
    rateLimitKey,
    REPORT_RATE_LIMIT,
    REPORT_RATE_WINDOW_MS,
  );
  if (!rl.ok) {
    return { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec };
  }

  const description = redactText(report.description);
  const incidentOnly = report.incidentOnly === true;
  const detected = incidentOnly
    ? "text"
    : report.type && report.type !== "unknown"
      ? report.type
      : detectInputType(report.value);
  const normalized = incidentOnly
    ? `${INCIDENT_ONLY_HASH_PREFIX}${description}`
    : normalize(report.value, detected);
  const display = incidentOnly
    ? INCIDENT_ONLY_REDACTED_VALUE
    : maskForDisplay(normalized, detected);
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
    void notifyModeration({
      kind: "report",
      entityType: detected,
      redactedValue: display,
      scamType: report.scamType ?? null,
      city: report.city ?? null,
      amountLostUzs: report.amountLostUzs ?? null,
      language: report.lang,
      incidentOnly,
      duplicateOfExisting: true,
    });
    return { ok: true };
  }

  const { error } = await supabaseAdmin.from("reports").insert({
    entity_type: detected,
    entity_hash: hash,
    redacted_value: display,
    description,
    scam_type: report.scamType ?? null,
    city: report.city ?? null,
    amount_lost_uzs: report.amountLostUzs ?? null,
    language: report.lang,
  });

  if (error) {
    console.error("submit report failed", error);
    return { ok: false, error: "submit_failed" };
  }

  void notifyModeration({
    kind: "report",
    entityType: detected,
    redactedValue: display,
    scamType: report.scamType ?? null,
    city: report.city ?? null,
    amountLostUzs: report.amountLostUzs ?? null,
    language: report.lang,
    incidentOnly,
  });

  if (incidentOnly) {
    return { ok: true };
  }

  if (detected === "telegram") {
    await registerTelegramReportCandidate({ entityHash: hash, displayHint: display });
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
}

export const submitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data }) => {
    return submitReportCore(data, reportRateLimitKey());
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
