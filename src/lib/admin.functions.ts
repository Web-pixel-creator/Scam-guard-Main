import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  .inputValidator((d: unknown) =>
    z
      .object({
        reportId: z.string().uuid(),
        decision: z.enum(["confirmed", "rejected"]),
        riskLevel: z.enum(["safe", "unknown", "suspicious", "high_risk"]).default("high_risk"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rep, error } = await supabaseAdmin
      .from("reports")
      .select("entity_hash, entity_type, redacted_value")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !rep) throw new Error("Report not found");

    await supabaseAdmin.from("reports").update({ status: data.decision }).eq("id", data.reportId);

    // Sync corresponding entity
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
    return { ok: true };
  });

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
