// Hosted restore-drill smoke for the isolated Ishonch Guard staging project.
//
// This script is intentionally pinned to one disposable project reference. It
// exercises database-backed application services without a public app URL,
// Telegram delivery, AI providers, reputation providers, or restored-user
// authentication. Every synthetic row is removed before the final invariant
// check.
import { randomUUID } from "node:crypto";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { moderateReportCore, resolveReputationAppealCore } from "@/lib/admin.functions";
import { submitReputationAppealCore } from "@/lib/reputation-appeal.functions";
import { submitReportCore } from "@/lib/report.functions";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { runCheck } from "@/lib/risk/check-core";
import { hashIdentifier, hashIdentifierVersioned } from "@/lib/risk/hash";
import {
  acceptFamilyInvite,
  createFamilyInvite,
  parseFamilyStartArg,
  revokeFamilyShield,
} from "@/lib/telegram/family-shield.server";

const APPROVED_PROJECT_REF = "gwwcooupkmhihaigympb";
const APPROVED_ORIGIN = `https://${APPROVED_PROJECT_REF}.supabase.co`;
const EXPECTED_COUNTS = {
  authUsers: 2,
  adminAllowlist: 2,
  userRoles: 4,
  checks: 235,
  reports: 8,
  entities: 7,
  appeals: 2,
  familyShield: 7,
  reputationTargets: 9,
  telegramSessions: 4,
} as const;

type BaselineCounts = Record<keyof typeof EXPECTED_COUNTS, number>;

type SyntheticState = {
  marker: string;
  guardianTelegramUserId: number;
  rateLimitHashes: string[];
  checkHash: string;
  reportHash: string;
  appealHash: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function adminClient(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

function assertIsolationContract(): void {
  const projectRef = requiredEnv("HOSTED_STAGING_PROJECT_REF");
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const deliveryMode = requiredEnv("TELEGRAM_UPDATE_DELIVERY_MODE").toLowerCase();

  assert(projectRef === APPROVED_PROJECT_REF, "staging project ref is not approved");
  assert(supabaseUrl === APPROVED_ORIGIN, "Supabase URL is not the approved staging origin");
  assert(deliveryMode === "disabled", "Telegram delivery must be disabled");
  assert(
    process.env.HASH_PEPPER_ACTIVE_VERSION?.trim().toLowerCase() === "v2",
    "staging active hash version must be v2",
  );
  requiredEnv("HASH_PEPPER_ACTIVE_SECRET");
  requiredEnv("HASH_PEPPER_SECRET");
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const forbidden = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "TELEGRAM_MODERATION_CHAT_ID",
    "TELEGRAM_QA_CHAT_ID",
    "OPENAI_API_KEY",
    "OPENAI_FALLBACK_API_KEY",
    "OPENAI_TTS_API_KEY",
    "GEMINI_TTS_API_KEY",
    "GOOGLE_TTS_API_KEY",
    "GOOGLE_SAFE_BROWSING_KEY",
    "GOOGLE_SAFE_BROWSING_API_KEY",
    "URLHAUS_AUTH_KEY",
    "PHISHTANK_API_KEY",
  ].filter((name) => Boolean(process.env[name]?.trim()));

  assert(forbidden.length === 0, `outbound credentials are present: ${forbidden.join(",")}`);
}

async function countTable(table: string): Promise<number> {
  const { count, error } = await adminClient().from(table).select("*", {
    count: "exact",
    head: true,
  });
  if (error) fail(`count failed for ${table}: ${error.code ?? "unknown"}`);
  return count ?? 0;
}

async function readCounts(): Promise<BaselineCounts> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) fail(`Auth user count failed: ${authError.code ?? "unknown"}`);

  const [
    adminAllowlist,
    userRoles,
    checks,
    reports,
    entities,
    appeals,
    familyShield,
    reputationTargets,
    telegramSessions,
  ] = await Promise.all([
    countTable("admin_allowlist"),
    countTable("user_roles"),
    countTable("checks"),
    countTable("reports"),
    countTable("entities"),
    countTable("reputation_appeals"),
    countTable("telegram_family_shield"),
    countTable("telegram_reputation_targets"),
    countTable("telegram_sessions"),
  ]);

  return {
    authUsers: authData.users.length,
    adminAllowlist,
    userRoles,
    checks,
    reports,
    entities,
    appeals,
    familyShield,
    reputationTargets,
    telegramSessions,
  };
}

function assertExpectedCounts(actual: BaselineCounts, label: string): void {
  for (const [name, expected] of Object.entries(EXPECTED_COUNTS)) {
    assert(actual[name as keyof BaselineCounts] === expected, `${label} invariant ${name} changed`);
  }
}

async function firstAdminUserId(): Promise<string> {
  const { data, error } = await adminClient()
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1);
  if (error) fail(`admin role lookup failed: ${error.code ?? "unknown"}`);
  const userId = data?.[0]?.user_id;
  assert(typeof userId === "string" && userId.length > 0, "no restored admin role found");
  return userId;
}

function inviteToken(inviteUrl: string): string {
  const parsed = new URL(inviteUrl);
  const token = parseFamilyStartArg(parsed.searchParams.get("start") ?? "");
  assert(token, "synthetic Family Shield invite token could not be parsed");
  return token;
}

async function readSyntheticReport(reportHash: string) {
  const { data, error } = await adminClient()
    .from("reports")
    .select("id,entity_hash,entity_hash_version,status")
    .eq("entity_hash", reportHash)
    .limit(1)
    .maybeSingle();
  if (error) fail(`synthetic report lookup failed: ${error.code ?? "unknown"}`);
  assert(data, "synthetic report was not stored");
  return data;
}

async function readSyntheticAppeal(appealHash: string) {
  const { data, error } = await adminClient()
    .from("reputation_appeals")
    .select("id,target_hash,target_hash_version,contact_hash_version,status,resolution")
    .eq("target_hash", appealHash)
    .limit(1)
    .maybeSingle();
  if (error) fail(`synthetic appeal lookup failed: ${error.code ?? "unknown"}`);
  assert(data, "synthetic appeal was not stored");
  return data;
}

async function deleteSyntheticRows(state: SyntheticState): Promise<void> {
  const client = adminClient();
  const [{ data: reportRows }, { data: appealRows }] = await Promise.all([
    client.from("reports").select("id").eq("entity_hash", state.reportHash),
    client.from("reputation_appeals").select("id").eq("target_hash", state.appealHash),
  ]);
  const reportIds = (reportRows ?? []).map((row) => String(row.id));
  const appealIds = (appealRows ?? []).map((row) => String(row.id));
  const targetIds = [...reportIds, ...appealIds];

  if (targetIds.length > 0) {
    const { error } = await client.from("admin_actions").delete().in("target_id", targetIds);
    if (error) fail(`admin action cleanup failed: ${error.code ?? "unknown"}`);
  }

  const cleanupOperations = [
    client.from("telegram_reputation_targets").delete().eq("target_hash", state.reportHash),
    client.from("entities").delete().eq("entity_hash", state.reportHash),
    client.from("reports").delete().eq("entity_hash", state.reportHash),
    client.from("reputation_appeals").delete().eq("target_hash", state.appealHash),
    client
      .from("telegram_family_shield")
      .delete()
      .eq("guardian_telegram_user_id", state.guardianTelegramUserId),
    client.from("checks").delete().eq("input_hash", state.checkHash),
    client.from("rate_limit_buckets").delete().in("key_hash", state.rateLimitHashes),
  ];
  const cleanupResults = await Promise.all(cleanupOperations);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) fail(`synthetic cleanup failed: ${cleanupError.code ?? "unknown"}`);
}

async function assertSyntheticRowsAbsent(state: SyntheticState): Promise<void> {
  const client = adminClient();
  const checks = await Promise.all([
    client
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("entity_hash", state.reportHash),
    client
      .from("reputation_appeals")
      .select("id", { count: "exact", head: true })
      .eq("target_hash", state.appealHash),
    client
      .from("telegram_family_shield")
      .select("id", { count: "exact", head: true })
      .eq("guardian_telegram_user_id", state.guardianTelegramUserId),
    client
      .from("checks")
      .select("id", { count: "exact", head: true })
      .eq("input_hash", state.checkHash),
    client
      .from("rate_limit_buckets")
      .select("scope", { count: "exact", head: true })
      .in("key_hash", state.rateLimitHashes),
  ]);
  for (const result of checks) {
    if (result.error) fail(`cleanup absence check failed: ${result.error.code ?? "unknown"}`);
    assert((result.count ?? 0) === 0, "a synthetic marker remained after cleanup");
  }
}

async function main(): Promise<void> {
  assertIsolationContract();
  const baseline = await readCounts();
  assertExpectedCounts(baseline, "initial");

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`.toLowerCase();
  const marker = `STAGING-RESTORE-${suffix}`;
  const reportValue = `@staging_restore_${suffix.replace(/-/g, "_")}`;
  const appealTarget = `https://${suffix}.example.invalid/security-review`;
  const checkRateLimitKey = `check:staging-restore:${suffix}`;
  const reportRateLimitKey = `report:staging-restore:${suffix}`;
  const appealRateLimitKey = `appeal:staging-restore:${suffix}`;
  const guardianTelegramUserId = 9_600_000_000_000 + Math.floor(Date.now() % 1_000_000);
  const checkInput = `${marker} Bank security asks for my SMS code and an immediate transfer to a safe account.`;

  const checkHash = await hashIdentifier(normalize(checkInput, detectInputType(checkInput)));
  const reportHash = await hashIdentifier(normalize(reportValue, detectInputType(reportValue)));
  const appealHash = await hashIdentifier(normalize(appealTarget, detectInputType(appealTarget)));
  const rateLimitHashes = await Promise.all([
    hashIdentifier(`rate-limit:check:${checkRateLimitKey}`),
    hashIdentifier(`rate-limit:report:${reportRateLimitKey}`),
    hashIdentifier(`rate-limit:appeal:${appealRateLimitKey}`),
  ]);
  const state: SyntheticState = {
    marker,
    guardianTelegramUserId,
    rateLimitHashes,
    checkHash,
    reportHash,
    appealHash,
  };

  try {
    const highRisk = await runCheck({
      input: checkInput,
      lang: "en",
      rateLimitKey: checkRateLimitKey,
      channel: "web",
      skipAi: true,
    });
    assert(highRisk.level === "high_risk", "synthetic high-risk check was not high risk");
    assert(
      highRisk.reasons.includes("asks_for_sms_code"),
      "synthetic check missed asks_for_sms_code",
    );
    console.log("OK deterministic high-risk check and v2 write path");

    const reportResult = await submitReportCore(
      {
        value: reportValue,
        type: "telegram",
        description: `${marker} synthetic report: SMS code and safe-account transfer request.`,
        scamType: "hosted staging restore drill",
        city: "Tashkent synthetic",
        lang: "en",
      },
      reportRateLimitKey,
    );
    assert(reportResult.ok, `synthetic report failed: ${reportResult.error}`);

    const appealResult = await submitReputationAppealCore(
      {
        target: appealTarget,
        reason: `${marker} synthetic appeal requests a moderation review.`,
        contact: "restore-drill@example.invalid",
        lang: "en",
      },
      appealRateLimitKey,
    );
    assert(appealResult.ok, `synthetic appeal failed: ${appealResult.error}`);

    const [report, appeal, adminUserId] = await Promise.all([
      readSyntheticReport(reportHash),
      readSyntheticAppeal(appealHash),
      firstAdminUserId(),
    ]);
    assert(report.entity_hash_version === "v2", "report hash version is not v2");
    assert(appeal.target_hash_version === "v2", "appeal target hash version is not v2");
    assert(appeal.contact_hash_version === "v2", "appeal contact hash version is not v2");

    await moderateReportCore(
      { reportId: report.id, decision: "rejected", riskLevel: "high_risk" },
      adminUserId,
    );
    await resolveReputationAppealCore(
      {
        appealId: appeal.id,
        decision: "keep_reputation",
        note: `${marker} synthetic moderation; no restored reputation changed.`,
      },
      adminUserId,
    );

    const [moderatedReport, moderatedAppeal, auditActions] = await Promise.all([
      readSyntheticReport(reportHash),
      readSyntheticAppeal(appealHash),
      adminClient()
        .from("admin_actions")
        .select("action,target_type,target_id")
        .in("target_id", [report.id, appeal.id]),
    ]);
    assert(moderatedReport.status === "rejected", "report moderation did not persist");
    assert(moderatedAppeal.status === "rejected", "appeal moderation did not persist");
    assert(!auditActions.error, "admin audit lookup failed");
    assert((auditActions.data ?? []).length === 2, "admin audit actions are incomplete");
    console.log("OK synthetic report, appeal, moderation, audit, and v2 hashes");

    const invite = await createFamilyInvite(guardianTelegramUserId);
    assert(invite.ok, `Family Shield invite failed: ${invite.reason}`);
    const token = inviteToken(invite.inviteUrl);
    const { data: familyBeforeAccept, error: familyBeforeAcceptError } = await adminClient()
      .from("telegram_family_shield")
      .select("id,invite_code_hash_version,status")
      .eq("guardian_telegram_user_id", guardianTelegramUserId)
      .maybeSingle();
    assert(!familyBeforeAcceptError && familyBeforeAccept, "Family Shield row was not stored");
    assert(
      familyBeforeAccept.invite_code_hash_version === "v2",
      "Family Shield invite hash version is not v2",
    );

    const accepted = await acceptFamilyInvite({
      token,
      trustedTelegramUserId: guardianTelegramUserId + 1,
      trustedChatId: guardianTelegramUserId + 2,
    });
    assert(accepted.ok, `Family Shield accept failed: ${accepted.reason}`);
    const revoked = await revokeFamilyShield(guardianTelegramUserId);
    assert(revoked.ok, `Family Shield revoke failed: ${revoked.reason}`);
    console.log("OK synthetic Family Shield create, accept, revoke, and v2 hash");

    const activeHash = await hashIdentifierVersioned(`${marker}:version-check`);
    assert(activeHash.version === "v2", "active hash helper did not use v2");
  } finally {
    await deleteSyntheticRows(state);
  }

  await assertSyntheticRowsAbsent(state);
  const finalCounts = await readCounts();
  assertExpectedCounts(finalCounts, "final");
  assert(
    JSON.stringify(finalCounts) === JSON.stringify(baseline),
    "final counts differ from the restored baseline",
  );
  console.log("OK synthetic cleanup and restored count invariants");
  console.log("OK hosted staging service smoke passed");
}

main().catch((error) => {
  console.error(
    "FAIL hosted staging service smoke:",
    error instanceof Error ? error.message : "unknown",
  );
  process.exitCode = 1;
});
