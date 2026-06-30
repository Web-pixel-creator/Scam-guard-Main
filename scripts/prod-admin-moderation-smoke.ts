import { moderateReportCore, resolveReputationAppealCore } from "@/lib/admin.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";

type ReportRow = {
  id: string;
  entity_hash: string;
  entity_type: string;
  status: string;
};

type AppealRow = {
  id: string;
  target_hash: string;
  target_type: string;
  status: string;
};

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1]?.trim() || null;
  return null;
}

function fail(message: string): never {
  throw new Error(message);
}

function runIdFromMarker(marker: string): string | null {
  const match = /^QA-P1-WEB-(\d{14})$/.exec(marker);
  return match?.[1] ?? null;
}

async function targetHash(value: string): Promise<string> {
  const type = detectInputType(value);
  return hashIdentifier(normalize(value, type));
}

async function readFirstAdminUserId(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);
  if (error) fail(`admin lookup failed: ${error.message}`);
  const userId = data?.[0]?.user_id;
  if (!userId) fail("no admin user found in user_roles");
  return userId;
}

async function readReport(marker: string, reportHash: string | null): Promise<ReportRow> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id,entity_hash,entity_type,status,created_at")
    .ilike("description", `%${marker}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(`report lookup failed: ${error.message}`);
  let row = data?.[0] as ReportRow | undefined;
  if (!row && reportHash) {
    const byHash = await supabaseAdmin
      .from("reports")
      .select("id,entity_hash,entity_type,status,created_at")
      .eq("entity_hash", reportHash)
      .order("created_at", { ascending: false })
      .limit(1);
    if (byHash.error) fail(`report hash lookup failed: ${byHash.error.message}`);
    row = byHash.data?.[0] as ReportRow | undefined;
  }
  if (!row) fail(`no report found for marker ${marker}`);
  return row;
}

async function readAppeal(marker: string, appealHash: string | null): Promise<AppealRow> {
  const { data, error } = await supabaseAdmin
    .from("reputation_appeals")
    .select("id,target_hash,target_type,status,created_at")
    .ilike("reason", `%${marker}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(`appeal lookup failed: ${error.message}`);
  let row = data?.[0] as AppealRow | undefined;
  if (!row && appealHash) {
    const byHash = await supabaseAdmin
      .from("reputation_appeals")
      .select("id,target_hash,target_type,status,created_at")
      .eq("target_hash", appealHash)
      .order("created_at", { ascending: false })
      .limit(1);
    if (byHash.error) fail(`appeal hash lookup failed: ${byHash.error.message}`);
    row = byHash.data?.[0] as AppealRow | undefined;
  }
  if (!row) fail(`no appeal found for marker ${marker}`);
  return row;
}

async function readCheckIds(marker: string): Promise<string[]> {
  const { data: markerRows, error } = await supabaseAdmin
    .from("checks")
    .select("id")
    .ilike("redacted_input", `%${marker}%`);
  if (error) fail(`check lookup failed: ${error.message}`);
  let data = markerRows;
  if (!data || data.length === 0) {
    const prefix = marker.split("-").slice(0, 3).join("-");
    const fallback = await supabaseAdmin
      .from("checks")
      .select("id")
      .ilike("redacted_input", `%${prefix}%`);
    if (fallback.error) fail(`check prefix lookup failed: ${fallback.error.message}`);
    data = fallback.data ?? [];
  }
  return data.map((row) => row.id);
}

async function assertReportRejected(reportId: string) {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("status")
    .eq("id", reportId)
    .maybeSingle();
  if (error) fail(`report verification failed: ${error.message}`);
  if (data?.status !== "rejected") fail(`expected report rejected, got ${data?.status ?? "null"}`);
}

async function assertAppealRejected(appealId: string) {
  const { data, error } = await supabaseAdmin
    .from("reputation_appeals")
    .select("status,resolution")
    .eq("id", appealId)
    .maybeSingle();
  if (error) fail(`appeal verification failed: ${error.message}`);
  if (data?.status !== "rejected") fail(`expected appeal rejected, got ${data?.status ?? "null"}`);
  if (!String(data.resolution ?? "").includes("P1 QA synthetic")) {
    fail("appeal resolution note did not include QA marker text");
  }
}

async function assertAuditActions(reportId: string, appealId: string) {
  const { data, error } = await supabaseAdmin
    .from("admin_actions")
    .select("action,target_type,target_id")
    .in("target_id", [reportId, appealId]);
  if (error) fail(`audit verification failed: ${error.message}`);
  const actions = data ?? [];
  const hasReportAction = actions.some(
    (row) =>
      row.target_id === reportId && row.target_type === "report" && row.action === "reject_report",
  );
  const hasAppealAction = actions.some(
    (row) =>
      row.target_id === appealId &&
      row.target_type === "reputation_appeal" &&
      row.action === "keep_reputation",
  );
  if (!hasReportAction) fail("missing reject_report audit action");
  if (!hasAppealAction) fail("missing keep_reputation audit action");
}

async function deleteByIds(table: string, ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from(table).delete().in("id", ids);
  if (error) fail(`cleanup ${table} failed: ${error.message}`);
}

async function cleanup(options: { report: ReportRow; appeal: AppealRow; checkIds: string[] }) {
  const { report, appeal, checkIds } = options;
  const targetIds = [report.id, appeal.id];

  const adminActions = await supabaseAdmin
    .from("admin_actions")
    .delete()
    .in("target_id", targetIds);
  if (adminActions.error) fail(`cleanup admin_actions failed: ${adminActions.error.message}`);

  const tgReputation = await supabaseAdmin
    .from("telegram_reputation_targets")
    .delete()
    .eq("target_hash", report.entity_hash);
  if (tgReputation.error) {
    fail(`cleanup telegram_reputation_targets failed: ${tgReputation.error.message}`);
  }

  const entities = await supabaseAdmin
    .from("entities")
    .delete()
    .eq("entity_hash", report.entity_hash);
  if (entities.error) fail(`cleanup entities failed: ${entities.error.message}`);

  await deleteByIds("checks", checkIds);
  await deleteByIds("reports", [report.id]);
  await deleteByIds("reputation_appeals", [appeal.id]);
}

async function main() {
  const marker = argValue("marker") || process.env.QA_MARKER;
  if (!marker) {
    fail("Usage: vite-node scripts/prod-admin-moderation-smoke.ts --marker QA-P1-WEB-...");
  }
  const keepRows = process.argv.includes("--keep-rows");
  const runId = runIdFromMarker(marker);
  const reportHash = runId ? await targetHash(`@qa_p1_web_${runId.toLowerCase()}`) : null;
  const appealHash = runId
    ? await targetHash(`https://qa-p1-${runId}.example.test/security-review`)
    : null;

  const [adminUserId, report, appeal, checkIds] = await Promise.all([
    readFirstAdminUserId(),
    readReport(marker, reportHash),
    readAppeal(marker, appealHash),
    readCheckIds(marker),
  ]);

  await moderateReportCore(
    { reportId: report.id, decision: "rejected", riskLevel: "high_risk" },
    adminUserId,
  );
  await assertReportRejected(report.id);

  await resolveReputationAppealCore(
    {
      appealId: appeal.id,
      decision: "keep_reputation",
      note: `P1 QA synthetic moderation ${marker}; no production reputation changed.`,
    },
    adminUserId,
  );
  await assertAppealRejected(appeal.id);
  await assertAuditActions(report.id, appeal.id);

  if (!keepRows) {
    await cleanup({ report, appeal, checkIds });
  }

  console.log(
    [
      "OK production admin moderation smoke passed",
      `marker=${marker}`,
      `report=${report.id}`,
      `appeal=${appeal.id}`,
      `checks=${checkIds.length}`,
      `cleanup=${keepRows ? "kept" : "done"}`,
    ].join(" "),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production admin moderation smoke: ${message}`);
  process.exitCode = 1;
});
