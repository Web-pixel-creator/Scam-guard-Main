import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { runCheck, ocrExtractCore } from "./risk/check-core";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "./meta-intent";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePublicStatsRow, type PublicStats } from "@/lib/trust/impact-stats";

export interface MetaIntentCheckResult {
  metaIntent: MetaIntent;
  response: string;
}

export type { PublicStats } from "@/lib/trust/impact-stats";

const checkSchema = z.object({
  input: z.string().min(1).max(2000),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

const ocrSchema = z.object({
  image: z.string().min(1).max(6_000_000),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

/** Resolve the caller IP from the request and build the web rate-limit key. */
function webRateLimitKey(): string {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestIP({ xForwardedFor: true }) ||
    "unknown";
  return `check:${ip}`;
}

// Thin web wrapper: extract IP → build `check:<ip>` key → delegate to the core.
// Behaviour is unchanged: same rate-limit key, 10/60_000 limit, response shape
// and redacted+hashed `checks` write all live in `runCheck`.
export const checkInput = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkSchema.parse(data))
  .handler(async ({ data }) => {
    const metaIntent = classifyMetaIntent(data.input);
    if (metaIntent) {
      return {
        metaIntent,
        response: getMetaIntentResponse(metaIntent, data.lang),
      } satisfies MetaIntentCheckResult;
    }

    return runCheck({
      input: data.input,
      type: data.type,
      lang: data.lang,
      rateLimitKey: webRateLimitKey(),
      channel: "web",
    });
  });

// Thin web wrapper: same `check:<ip>` rate-limit key → delegate to OCR core.
export const ocrExtract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ocrSchema.parse(data))
  .handler(async ({ data }) => {
    return ocrExtractCore(data.image, data.lang, webRateLimitKey());
  });

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
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
      supabaseAdmin.from("reports").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
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
});
