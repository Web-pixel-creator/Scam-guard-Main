import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

const results: CheckResult[] = [];

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function publicKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

function record(label: string, ok: boolean, detail: string): void {
  results.push({ label, ok, detail });
  console.log(`${ok ? "OK" : "FAIL"} ${label}: ${detail}`);
}

function expectedDeny(
  error: { code?: string; message?: string; details?: string } | null,
): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    text.includes("permission denied") ||
    text.includes("row-level security") ||
    text.includes("violates row-level security") ||
    text.includes("not allowed")
  );
}

async function expectNoRowsOrDenied(
  client: SupabaseClient,
  label: string,
  table: string,
  columns = "id",
): Promise<void> {
  const { data, error } = await client.from(table).select(columns).limit(1);
  if (expectedDeny(error)) {
    record(label, true, `denied (${error?.code ?? "no_code"})`);
    return;
  }
  if (error) {
    record(label, false, `unexpected error (${error.code ?? "no_code"})`);
    return;
  }
  const count = Array.isArray(data) ? data.length : 0;
  record(label, count === 0, count === 0 ? "no rows exposed" : `returned ${count} row(s)`);
}

async function expectInsertDenied(
  client: SupabaseClient,
  label: string,
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.from(table).insert(payload);
  record(
    label,
    Boolean(error),
    error ? `denied (${error.code ?? "no_code"})` : "insert unexpectedly succeeded",
  );
}

async function expectServiceCanCount(
  client: SupabaseClient,
  label: string,
  table: string,
  columns = "id",
): Promise<void> {
  const { error, count } = await client.from(table).select(columns, { count: "exact", head: true });
  record(
    label,
    !error,
    error ? `service read failed (${error.code ?? "no_code"})` : `service count ok (${count ?? 0})`,
  );
}

async function main(): Promise<void> {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = publicKey();
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!anonKey)
    throw new Error("SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY is not set");

  const clientOptions = {
    auth: { persistSession: false, autoRefreshToken: false },
  };
  const anon = createClient(supabaseUrl, anonKey, clientOptions);
  const service = createClient(supabaseUrl, serviceRoleKey, clientOptions);

  console.log("Production security smoke target: Supabase project from env");
  console.log("Secret values are read from env and are not printed.");

  await expectNoRowsOrDenied(
    anon,
    "anon cannot read checks",
    "checks",
    "id,redacted_input,input_hash",
  );
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read reports",
    "reports",
    "id,redacted_value,entity_hash",
  );
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read telegram_sessions",
    "telegram_sessions",
    "telegram_user_id",
  );
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read telegram_family_shield",
    "telegram_family_shield",
    "id",
  );
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read telegram_webhook_updates",
    "telegram_webhook_updates",
    "update_id",
  );
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read rate_limit_buckets",
    "rate_limit_buckets",
    "scope,key_hash",
  );

  const { data: hiddenEntities, error: hiddenEntitiesError } = await anon
    .from("entities")
    .select("id,moderation_status")
    .neq("moderation_status", "confirmed")
    .limit(1);
  record(
    "anon sees no unconfirmed entities",
    expectedDeny(hiddenEntitiesError) ||
      (!hiddenEntitiesError && (hiddenEntities ?? []).length === 0),
    hiddenEntitiesError
      ? `denied (${hiddenEntitiesError.code ?? "no_code"})`
      : `rows=${hiddenEntities?.length ?? 0}`,
  );

  const { data: reputationRows, error: reputationError } = await anon
    .from("telegram_reputation_targets")
    .select("id,moderation_status,source_type,moderated_report_count")
    .limit(25);
  const reputationRowsAreSafe =
    !reputationError &&
    (reputationRows ?? []).every(
      (row) =>
        row.moderation_status === "confirmed" &&
        ["official", "moderated_report"].includes(String(row.source_type)) &&
        Number(row.moderated_report_count) > 0,
    );
  record(
    "anon telegram reputation rows are public-safe only",
    expectedDeny(reputationError) || reputationRowsAreSafe,
    reputationError
      ? `denied (${reputationError.code ?? "no_code"})`
      : `rows=${reputationRows?.length ?? 0}`,
  );

  await expectInsertDenied(anon, "anon cannot insert checks", "checks", {
    input_type: "text",
    redacted_input: "security-smoke",
    input_hash: "security-smoke",
    risk_level: "unknown",
    risk_score: 0,
    reason_codes: [],
    language: "ru",
  });
  await expectInsertDenied(anon, "anon cannot insert reports", "reports", {
    entity_type: "text",
    redacted_value: "security-smoke",
    entity_hash: "security-smoke",
    description: "security smoke report payload",
    language: "ru",
  });

  const { error: anonPruneError } = await anon.rpc("prune_telegram_sessions");
  record(
    "anon cannot execute prune_telegram_sessions",
    Boolean(anonPruneError),
    anonPruneError ? `denied (${anonPruneError.code ?? "no_code"})` : "rpc unexpectedly succeeded",
  );

  const { error: anonStatsError } = await anon.rpc("get_check_stats");
  record(
    "anon cannot execute get_check_stats",
    Boolean(anonStatsError),
    anonStatsError ? `denied (${anonStatsError.code ?? "no_code"})` : "rpc unexpectedly succeeded",
  );

  const rateLimitSmokeHash = "f".repeat(64);
  const rateLimitSmokeArgs = {
    p_scope: "check",
    p_key_hash: rateLimitSmokeHash,
    p_limit: 1000,
    p_window_seconds: 60,
  };
  const { error: anonRateLimitError } = await anon.rpc("claim_rate_limit", rateLimitSmokeArgs);
  record(
    "anon cannot execute claim_rate_limit",
    Boolean(anonRateLimitError),
    anonRateLimitError
      ? `denied (${anonRateLimitError.code ?? "no_code"})`
      : "rpc unexpectedly succeeded",
  );

  await expectServiceCanCount(service, "service can count checks", "checks");
  await expectServiceCanCount(service, "service can count reports", "reports");
  await expectServiceCanCount(
    service,
    "service can count telegram_family_shield",
    "telegram_family_shield",
  );
  await expectServiceCanCount(
    service,
    "service can count telegram_webhook_updates",
    "telegram_webhook_updates",
    "update_id",
  );
  await expectServiceCanCount(
    service,
    "service can count rate_limit_buckets",
    "rate_limit_buckets",
    "scope",
  );

  const { error: serviceStatsError } = await service.rpc("get_check_stats");
  record(
    "service can execute get_check_stats",
    !serviceStatsError,
    serviceStatsError
      ? `service rpc failed (${serviceStatsError.code ?? "no_code"})`
      : "service rpc ok",
  );

  const { data: serviceRateLimitData, error: serviceRateLimitError } = await service.rpc(
    "claim_rate_limit",
    rateLimitSmokeArgs,
  );
  record(
    "service can execute claim_rate_limit",
    !serviceRateLimitError && Array.isArray(serviceRateLimitData),
    serviceRateLimitError
      ? `service rpc failed (${serviceRateLimitError.code ?? "no_code"})`
      : `service rpc ok (${Array.isArray(serviceRateLimitData) ? serviceRateLimitData.length : 0})`,
  );

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(`Security smoke failed: ${failed.map((r) => r.label).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("OK production security smoke passed.");
}

main().catch((error) => {
  console.error(
    "FAIL production security smoke crashed:",
    error instanceof Error ? error.message : "unknown",
  );
  process.exitCode = 1;
});
