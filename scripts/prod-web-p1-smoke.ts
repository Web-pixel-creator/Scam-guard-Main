// Production smoke for P1 web report/appeal/admin flows.
//
// Usage:
//   railway run npm run prod:web-p1-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:web-p1-smoke
//
// Security: creates synthetic report/appeal rows with a QA marker, verifies
// admin moderation core actions, then removes its own rows.
import process from "node:process";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { moderateReportCore, resolveReputationAppealCore } from "@/lib/admin.functions";
import { runCheck } from "@/lib/risk/check-core";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import { submitReputationAppealCore } from "@/lib/reputation-appeal.functions";
import { submitReportCore } from "@/lib/report.functions";

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

function fail(message: string): never {
  throw new Error(message);
}

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1]?.trim() || null;
  return null;
}

function timestampId(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function parsePublicUrl(): string {
  const arg = process.argv.slice(2).find((value) => !value.startsWith("--"));
  const raw = arg ?? process.env.PUBLIC_APP_URL;
  if (!raw) {
    fail(
      "missing public URL. Pass it as the first argument or set PUBLIC_APP_URL. " +
        "Example: npm run prod:web-p1-smoke -- https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid public URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public URL must use https, got ${parsed.protocol}`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

async function checkPage(publicUrl: string, path: string): Promise<void> {
  const res = await fetch(`${publicUrl}${path}`, { method: "GET" });
  if (res.status !== 200) fail(`${path} returned status=${res.status}`);
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

async function readReport(marker: string, reportHash: string): Promise<ReportRow> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("id,entity_hash,entity_type,status,created_at")
    .ilike("description", `%${marker}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(`report lookup failed: ${error.message}`);
  let row = data?.[0] as ReportRow | undefined;
  if (!row) {
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

async function readAppeal(marker: string, appealHash: string): Promise<AppealRow> {
  const { data, error } = await supabaseAdmin
    .from("reputation_appeals")
    .select("id,target_hash,target_type,status,created_at")
    .ilike("reason", `%${marker}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(`appeal lookup failed: ${error.message}`);
  let row = data?.[0] as AppealRow | undefined;
  if (!row) {
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

async function assertReportRejected(reportId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("status")
    .eq("id", reportId)
    .maybeSingle();
  if (error) fail(`report verification failed: ${error.message}`);
  if (data?.status !== "rejected") fail(`expected report rejected, got ${data?.status ?? "null"}`);
}

async function assertAppealRejected(appealId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("reputation_appeals")
    .select("status,resolution")
    .eq("id", appealId)
    .maybeSingle();
  if (error) fail(`appeal verification failed: ${error.message}`);
  if (data?.status !== "rejected") fail(`expected appeal rejected, got ${data?.status ?? "null"}`);
  if (!String(data.resolution ?? "").includes("P1 web QA synthetic")) {
    fail("appeal resolution note did not include QA marker text");
  }
}

async function assertAuditActions(reportId: string, appealId: string): Promise<void> {
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

async function deleteByIds(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from(table).delete().in("id", ids);
  if (error) fail(`cleanup ${table} failed: ${error.message}`);
}

async function readCheckIds(marker: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("checks")
    .select("id")
    .ilike("redacted_input", `%${marker}%`);
  if (error) fail(`check lookup failed: ${error.message}`);
  return (data ?? []).map((row) => row.id);
}

async function cleanup(options: {
  report?: ReportRow;
  appeal?: AppealRow;
  marker: string;
}): Promise<void> {
  const targetIds = [options.report?.id, options.appeal?.id].filter((id): id is string =>
    Boolean(id),
  );
  if (targetIds.length > 0) {
    const adminActions = await supabaseAdmin
      .from("admin_actions")
      .delete()
      .in("target_id", targetIds);
    if (adminActions.error) fail(`cleanup admin_actions failed: ${adminActions.error.message}`);
  }

  if (options.report) {
    const tgReputation = await supabaseAdmin
      .from("telegram_reputation_targets")
      .delete()
      .eq("target_hash", options.report.entity_hash);
    if (tgReputation.error) {
      fail(`cleanup telegram_reputation_targets failed: ${tgReputation.error.message}`);
    }

    const entities = await supabaseAdmin
      .from("entities")
      .delete()
      .eq("entity_hash", options.report.entity_hash);
    if (entities.error) fail(`cleanup entities failed: ${entities.error.message}`);

    await deleteByIds("reports", [options.report.id]);
  }

  if (options.appeal) {
    await deleteByIds("reputation_appeals", [options.appeal.id]);
  }

  await deleteByIds("checks", await readCheckIds(options.marker));
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const marker = argValue("marker") ?? `QA-P1-WEB-${timestampId()}`;
  const keepRows = process.argv.includes("--keep-rows");
  const runId = /^QA-P1-WEB-(\d{14})$/.exec(marker)?.[1];
  if (!runId) fail(`marker must match QA-P1-WEB-YYYYMMDDHHMMSS, got ${marker}`);

  const reportValue = `@qa_p1_web_${runId.toLowerCase()}`;
  const appealTarget = `https://qa-p1-${runId}.example.test/security-review`;
  const reportHash = await targetHash(reportValue);
  const appealHash = await targetHash(appealTarget);
  let report: ReportRow | undefined;
  let appeal: AppealRow | undefined;

  console.log(`Production P1 web smoke target: ${publicUrl}`);
  console.log(`QA marker: ${marker}`);
  console.log("Secret values are read from env and are not printed.");

  try {
    await Promise.all([
      checkPage(publicUrl, "/"),
      checkPage(publicUrl, "/report"),
      checkPage(publicUrl, "/appeal"),
    ]);
    console.log("OK /, /report, /appeal pages returned 200");

    const highRiskResult = await runCheck({
      input: `${marker} Служба безопасности банка срочно просит назвать SMS-код для отмены операции.`,
      lang: "ru",
      rateLimitKey: `check:qa:p1-web:${marker}`,
      channel: "web",
      skipAi: true,
    });
    if (highRiskResult.level !== "high_risk") {
      fail(`expected high_risk check result, got ${highRiskResult.level}`);
    }
    if (!highRiskResult.reasons.includes("asks_for_sms_code")) {
      fail("high-risk check result missing asks_for_sms_code reason");
    }
    console.log("OK web high-risk check result passed");

    const reportResult = await submitReportCore(
      {
        value: reportValue,
        type: "telegram",
        description: `${marker} synthetic report success path: caller requested SMS code and transfer.`,
        scamType: "P1 web QA synthetic",
        city: "Tashkent QA",
        lang: "ru",
      },
      `report:qa:p1-web:${marker}`,
    );
    if (!reportResult.ok) fail(`submitReportCore failed: ${reportResult.error}`);

    const appealResult = await submitReputationAppealCore(
      {
        target: appealTarget,
        reason: `${marker} synthetic appeal success path: public label review requested.`,
        contact: "qa-p1-web@example.invalid",
        lang: "ru",
      },
      `appeal:qa:p1-web:${marker}`,
    );
    if (!appealResult.ok) fail(`submitReputationAppealCore failed: ${appealResult.error}`);
    console.log("OK synthetic report and appeal were accepted");

    const [adminUserId, reportRow, appealRow] = await Promise.all([
      readFirstAdminUserId(),
      readReport(marker, reportHash),
      readAppeal(marker, appealHash),
    ]);
    report = reportRow;
    appeal = appealRow;

    await moderateReportCore(
      { reportId: report.id, decision: "rejected", riskLevel: "high_risk" },
      adminUserId,
    );
    await assertReportRejected(report.id);

    await resolveReputationAppealCore(
      {
        appealId: appeal.id,
        decision: "keep_reputation",
        note: `P1 web QA synthetic moderation ${marker}; no production reputation changed.`,
      },
      adminUserId,
    );
    await assertAppealRejected(appeal.id);
    await assertAuditActions(report.id, appeal.id);
    console.log("OK admin report/appeal moderation and audit actions passed");
  } finally {
    if (!keepRows) {
      await cleanup({ report, appeal, marker });
      console.log("OK cleanup done");
    }
  }

  console.log(`OK production P1 web smoke passed marker=${marker}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production P1 web smoke: ${message}`);
  process.exitCode = 1;
});
