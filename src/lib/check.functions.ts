import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runCheck, ocrExtractCore } from "./risk/check-core";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "./meta-intent";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePublicStatsRow, type PublicStats } from "@/lib/trust/impact-stats";
import { publicRateLimitKey } from "@/lib/request-ip.server";
import { MAX_IMAGE_DATA_URL_LENGTH, parseAllowedImageDataUrl } from "./risk/media-data-url";
import { checkSharedRateLimit } from "./risk/shared-rate-limit.server";
import {
  embedTelemetryContextSchema,
  recordEmbedOriginEvent,
} from "./embed-origin-analytics.server";

export interface MetaIntentCheckResult {
  metaIntent: MetaIntent;
  response: string;
}

export type { PublicStats } from "@/lib/trust/impact-stats";

const PUBLIC_STATS_CACHE_TTL_MS = 30_000;
const CHECK_RATE_LIMIT = 10;
const CHECK_RATE_WINDOW_MS = 60_000;
let publicStatsCache: { value: PublicStats; expiresAt: number } | null = null;
let publicStatsInFlight: Promise<PublicStats> | null = null;

function rateLimitedError(retryAfter: number): Error & { status: 429; retryAfter: number } {
  const error = new Error("rate_limited") as Error & { status: 429; retryAfter: number };
  error.status = 429;
  error.retryAfter = retryAfter;
  return error;
}

const checkSchema = z.object({
  input: z.string().min(1).max(2000),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
  embed: embedTelemetryContextSchema.optional(),
});

const ocrSchema = z.object({
  image: z
    .string()
    .min(1)
    .max(MAX_IMAGE_DATA_URL_LENGTH)
    .transform((value, ctx) => {
      const parsed = parseAllowedImageDataUrl(value);
      if (!parsed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "invalid_image_data_url",
        });
        return z.NEVER;
      }
      return parsed.dataUrl;
    }),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

// Thin web wrapper: extract IP → build `check:<ip>` key → delegate to the core.
// Behaviour is unchanged: same rate-limit key, 10/60_000 limit, response shape
// and redacted+hashed `checks` write all live in `runCheck`.
export const checkInput = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkSchema.parse(data))
  .handler(async ({ data }) => {
    const rateLimitKey = publicRateLimitKey("check");
    const metaIntent = classifyMetaIntent(data.input);
    if (metaIntent) {
      // Meta-intents return before runCheck, so they must claim the same shared
      // check bucket here before their service-role analytics write.
      const admission = await checkSharedRateLimit(
        "check",
        rateLimitKey,
        CHECK_RATE_LIMIT,
        CHECK_RATE_WINDOW_MS,
      );
      if (!admission.ok) throw rateLimitedError(admission.retryAfterSec);

      const result = {
        metaIntent,
        response: getMetaIntentResponse(metaIntent, data.lang),
      } satisfies MetaIntentCheckResult;
      await recordEmbedOriginEvent({
        context: data.embed,
        eventType: "meta_intent",
        lang: data.lang,
      });
      return result;
    }

    const result = await runCheck({
      input: data.input,
      lang: data.lang,
      rateLimitKey,
      channel: "web",
    });
    await recordEmbedOriginEvent({
      context: data.embed,
      eventType: "check_result",
      lang: data.lang,
      result,
    });
    return result;
  });

// Thin web wrapper: same `check:<ip>` rate-limit key → delegate to OCR core.
export const ocrExtract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ocrSchema.parse(data))
  .handler(async ({ data }) => {
    return ocrExtractCore(data.image, data.lang, publicRateLimitKey("check"));
  });

async function loadPublicStatsUncached(): Promise<PublicStats> {
  const [rpcResult, highRiskResult, suspiciousResult, reportsResult, reportsWithLossResult] =
    await Promise.all([
      supabaseAdmin.rpc("get_check_stats"),
      supabaseAdmin
        .from("checks")
        .select("id", { count: "exact", head: true })
        .eq("risk_level", "high_risk"),
      supabaseAdmin
        .from("checks")
        .select("id", { count: "exact", head: true })
        .eq("risk_level", "suspicious"),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gt("amount_lost_uzs", 0),
    ]);

  if (rpcResult.error) console.error("Unable to load public stats RPC", rpcResult.error);

  const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  const highRisk = highRiskResult.error ? undefined : (highRiskResult.count ?? 0);
  const suspicious = suspiciousResult.error ? undefined : (suspiciousResult.count ?? 0);
  const reportsTotal = reportsResult.error ? undefined : (reportsResult.count ?? 0);
  const reportsWithLoss = reportsWithLossResult.error
    ? undefined
    : (reportsWithLossResult.count ?? 0);

  const base = normalizePublicStatsRow(row);

  let reportedLossUzs = base.reported_loss_uzs;
  if (reportedLossUzs === 0 && (reportsWithLoss ?? base.reports_with_loss_amount) > 0) {
    const { data: amountRows, error: amountError } = await supabaseAdmin
      .from("reports")
      .select("amount_lost_uzs")
      .eq("status", "confirmed")
      .gt("amount_lost_uzs", 0)
      .limit(5000);

    if (!amountError && amountRows) {
      reportedLossUzs = amountRows.reduce(
        (sum, row) => sum + Math.max(0, Number(row.amount_lost_uzs ?? 0)),
        0,
      );
    }
  }

  return normalizePublicStatsRow(base, {
    high_risk: highRisk ?? base.high_risk,
    suspicious: suspicious ?? base.suspicious,
    reports_total: reportsTotal ?? base.reports_total,
    reports_with_loss_amount: reportsWithLoss ?? base.reports_with_loss_amount,
    reported_loss_uzs: reportedLossUzs,
  }) satisfies PublicStats;
}

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (publicStatsCache && publicStatsCache.expiresAt > now) {
    return { ...publicStatsCache.value } satisfies PublicStats;
  }

  publicStatsInFlight ??= loadPublicStatsUncached().finally(() => {
    publicStatsInFlight = null;
  });

  const stats = await publicStatsInFlight;
  publicStatsCache = {
    value: stats,
    expiresAt: Date.now() + PUBLIC_STATS_CACHE_TTL_MS,
  };
  return { ...stats } satisfies PublicStats;
});
