import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isIncidentOnlyReportProjection } from "@/lib/report-boundary";
import { syncTelegramReputationAfterModeration } from "@/lib/telegram/reputation.server";

type AdminActionInsert = {
  admin_user_id: string;
  action: "confirm_report" | "reject_report";
  target_type: "report";
  target_id: string;
  reason: string;
};

type AuditLogClient = {
  from(table: "admin_actions"): {
    insert(payload: AdminActionInsert): Promise<{ error: { message?: string } | null }>;
  };
};

const moderateReportInputSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(["confirmed", "rejected"]),
  riskLevel: z.enum(["safe", "unknown", "suspicious", "high_risk"]).default("high_risk"),
});

type ModerateReportInput = z.infer<typeof moderateReportInputSchema>;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

export const listReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["new", "confirmed", "rejected", "all"]).default("new") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["new", "confirmed", "rejected", "all"]).default("all") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin
      .from("entities")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("moderation_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const moderateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => moderateReportInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return moderateReportCore(data, context.userId);
  });

export async function moderateReportCore(data: ModerateReportInput, adminUserId: string) {
  const { data: rep, error } = await supabaseAdmin
    .from("reports")
    .select("entity_hash, entity_type, redacted_value")
    .eq("id", data.reportId)
    .maybeSingle();
  if (error || !rep) throw new Error("Report not found");

  await supabaseAdmin.from("reports").update({ status: data.decision }).eq("id", data.reportId);

  if (!isIncidentOnlyReportProjection(rep)) {
    // Sync corresponding entity only for reports that name a target.
    const { data: ent } = await supabaseAdmin
      .from("entities")
      .select("id")
      .eq("entity_hash", rep.entity_hash)
      .maybeSingle();
    if (ent) {
      await supabaseAdmin
        .from("entities")
        .update({
          moderation_status: data.decision,
          risk_level: data.decision === "confirmed" ? data.riskLevel : "unknown",
        })
        .eq("id", ent.id);
    } else {
      await supabaseAdmin.from("entities").insert({
        entity_type: rep.entity_type,
        entity_hash: rep.entity_hash,
        display_mask: rep.redacted_value,
        moderation_status: data.decision,
        risk_level: data.decision === "confirmed" ? data.riskLevel : "unknown",
        report_count: 1,
      });
    }

    if (rep.entity_type === "telegram") {
      await syncTelegramReputationAfterModeration({
        entityHash: rep.entity_hash,
        displayHint: rep.redacted_value,
        riskLevel: data.decision === "confirmed" ? data.riskLevel : "unknown",
      });
    }
  }
  // Audit log: record who made the decision and why.
  try {
    await (supabaseAdmin as unknown as AuditLogClient).from("admin_actions").insert({
      admin_user_id: adminUserId,
      action: data.decision === "confirmed" ? "confirm_report" : "reject_report",
      target_type: "report",
      target_id: data.reportId,
      reason: `risk_level: ${data.riskLevel}`,
    });
  } catch (e) {
    console.error("audit log insert failed", e instanceof Error ? e.message : "");
  }
  return { ok: true };
}

export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [reportsNew, reportsConfirmed, entitiesConfirmed, checksTotal] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      supabaseAdmin
        .from("entities")
        .select("id", { count: "exact", head: true })
        .eq("moderation_status", "confirmed"),
      supabaseAdmin.from("checks").select("id", { count: "exact", head: true }),
    ]);
    return {
      reports_new: reportsNew.count ?? 0,
      reports_confirmed: reportsConfirmed.count ?? 0,
      entities_confirmed: entitiesConfirmed.count ?? 0,
      checks_total: checksTotal.count ?? 0,
    };
  });

/** Fetch the latest check for an entity (by hash) — used by ReasonTimeline in admin. */
export const getEntityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entityHash: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("checks")
      .select("risk_level, risk_score, reason_codes, ai_explanation, created_at")
      .eq("input_hash", data.entityHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });
