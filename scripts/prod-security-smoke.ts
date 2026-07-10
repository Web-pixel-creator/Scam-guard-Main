import process from "node:process";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { checkProxyIpHeaderTrust } from "./security-smoke-env";

// Usage:
//   railway run npm run prod:security-smoke
//   railway run npm run prod:security-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com railway run npm run prod:security-smoke
//
// Passing a public URL enables additional HTTP security-header checks. Without
// a URL, the smoke keeps the historical Supabase/RLS-only behavior.

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

function recordResult(result: CheckResult): void {
  record(result.label, result.ok, result.detail);
}

function cspDirective(policy: string, name: string): string {
  return (
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

function optionalPublicUrl(): { value: string | null; error: string | null } {
  const raw =
    process.argv.slice(2).find((arg) => !arg.startsWith("--")) ??
    process.env.PUBLIC_APP_URL?.trim() ??
    "";
  if (!raw) return { value: null, error: null };

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") {
      return { value: null, error: `public URL must use https, got ${parsed.protocol}` };
    }
    return {
      value: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`,
      error: null,
    };
  } catch {
    return { value: null, error: `invalid public URL: ${raw}` };
  }
}

async function checkPublicSecurityHeaders(publicUrl: string): Promise<void> {
  const healthz = await fetch(`${publicUrl}/healthz`);
  const healthzCsp = healthz.headers.get("content-security-policy") ?? "";
  const healthzScriptSrc = cspDirective(healthzCsp, "script-src");

  record(
    "public healthz security headers",
    healthz.status === 200 &&
      healthz.headers.get("x-content-type-options") === "nosniff" &&
      healthz.headers.get("x-frame-options") === "DENY" &&
      healthz.headers.get("referrer-policy") === "strict-origin-when-cross-origin" &&
      healthz.headers.get("permissions-policy") === "camera=(), microphone=(), geolocation=()" &&
      healthz.headers.get("strict-transport-security") ===
        "max-age=63072000; includeSubDomains; preload" &&
      cspDirective(healthzCsp, "frame-ancestors") === "frame-ancestors 'none'" &&
      !healthzScriptSrc.includes("'unsafe-inline'"),
    `status=${healthz.status}, frame=${cspDirective(healthzCsp, "frame-ancestors") || "missing"}`,
  );

  const embed = await fetch(`${publicUrl}/embed/check`);
  const embedCsp = embed.headers.get("content-security-policy") ?? "";
  const embedFrameAncestors = cspDirective(embedCsp, "frame-ancestors");
  const embedScriptSrc = cspDirective(embedCsp, "script-src");

  record(
    "public embed security headers",
    embed.status === 200 &&
      embed.headers.get("x-content-type-options") === "nosniff" &&
      embed.headers.get("x-frame-options") === null &&
      embed.headers.get("referrer-policy") === "strict-origin-when-cross-origin" &&
      embed.headers.get("permissions-policy") === "camera=(), microphone=(), geolocation=()" &&
      embed.headers.get("strict-transport-security") ===
        "max-age=63072000; includeSubDomains; preload" &&
      embedFrameAncestors.startsWith("frame-ancestors 'self'") &&
      !embedFrameAncestors.split(/\s+/).includes("https:") &&
      !embedScriptSrc.includes("'unsafe-inline'"),
    `status=${embed.status}, frame=${embedFrameAncestors || "missing"}`,
  );
}

function expectedDeny(
  error: { code?: string; message?: string; details?: string } | null,
): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST205" ||
    text.includes("permission denied") ||
    text.includes("could not find the table") ||
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

async function listAllAuthUsers(service: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth admin listUsers failed: ${error.message}`);

    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) return users;
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmailConfirmed(user: User | undefined): boolean {
  return Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
}

async function checkAdminAuthPolicy(service: SupabaseClient): Promise<void> {
  const { data: allowlistRows, error: allowlistError } = await service
    .from("admin_allowlist")
    .select("email");
  if (allowlistError) {
    record(
      "service can read admin allowlist",
      false,
      `failed (${allowlistError.code ?? "no_code"})`,
    );
    return;
  }
  record(
    "service can read admin allowlist",
    true,
    `rows=${Array.isArray(allowlistRows) ? allowlistRows.length : 0}`,
  );

  const { data: adminRoleRows, error: adminRolesError } = await service
    .from("user_roles")
    .select("user_id,role")
    .eq("role", "admin");
  if (adminRolesError) {
    record("service can read admin roles", false, `failed (${adminRolesError.code ?? "no_code"})`);
    return;
  }

  const authUsers = await listAllAuthUsers(service);
  const usersById = new Map(authUsers.map((user) => [user.id, user]));
  const allowlistEmails = new Set(
    (allowlistRows ?? [])
      .map((row) => normalizeEmail((row as { email?: unknown }).email))
      .filter(Boolean),
  );
  const adminRoles = adminRoleRows ?? [];
  const outsideAllowlist = adminRoles.filter((row) => {
    const user = usersById.get(String(row.user_id));
    return !allowlistEmails.has(normalizeEmail(user?.email));
  });
  const unconfirmedAllowlisted = adminRoles.filter((row) => {
    const user = usersById.get(String(row.user_id));
    const email = normalizeEmail(user?.email);
    return allowlistEmails.has(email) && !isEmailConfirmed(user);
  });
  const confirmedAllowlistedAdminCount = adminRoles.filter((row) => {
    const user = usersById.get(String(row.user_id));
    return allowlistEmails.has(normalizeEmail(user?.email)) && isEmailConfirmed(user);
  }).length;

  record(
    "admin roles require confirmed allowlist",
    outsideAllowlist.length === 0 &&
      unconfirmedAllowlisted.length === 0 &&
      confirmedAllowlistedAdminCount > 0,
    `admins=${adminRoles.length}, confirmed_allowlisted=${confirmedAllowlistedAdminCount}, outside_allowlist=${outsideAllowlist.length}, unconfirmed_allowlisted=${unconfirmedAllowlisted.length}`,
  );
}

async function main(): Promise<void> {
  console.log("Production security smoke target: Supabase project from env");
  console.log("Secret values are read from env and are not printed.");

  recordResult(checkProxyIpHeaderTrust(process.env));
  const publicUrl = optionalPublicUrl();
  if (publicUrl.error) {
    record("public security headers target", false, publicUrl.error);
  } else if (publicUrl.value) {
    await checkPublicSecurityHeaders(publicUrl.value);
  } else {
    console.log("SKIP public security headers: pass PUBLIC_APP_URL or first argument to enable.");
  }

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
    "anon cannot read reputation_appeals",
    "reputation_appeals",
    "id,target_hash,contact_hash,reason",
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
  await expectNoRowsOrDenied(
    anon,
    "anon cannot read embed_origin_events",
    "embed_origin_events",
    "id,referrer_origin,referrer_host",
  );
  await expectNoRowsOrDenied(anon, "anon cannot read admin_allowlist", "admin_allowlist", "email");
  await expectNoRowsOrDenied(anon, "anon cannot read user_roles", "user_roles", "user_id,role");

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
  await expectInsertDenied(anon, "anon cannot insert reputation_appeals", "reputation_appeals", {
    target_type: "telegram",
    target_hash: "security-smoke",
    target_display: "@security_smoke",
    reason: "security smoke appeal payload",
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
  const appealRateLimitSmokeArgs = {
    ...rateLimitSmokeArgs,
    p_scope: "appeal",
    p_key_hash: "e".repeat(64),
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
    "service can count reputation_appeals",
    "reputation_appeals",
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
  await expectServiceCanCount(
    service,
    "service can count embed_origin_events",
    "embed_origin_events",
    "id",
  );
  await checkAdminAuthPolicy(service);

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

  const { data: serviceAppealRateLimitData, error: serviceAppealRateLimitError } =
    await service.rpc("claim_rate_limit", appealRateLimitSmokeArgs);
  record(
    "service can execute claim_rate_limit for appeal",
    !serviceAppealRateLimitError && Array.isArray(serviceAppealRateLimitData),
    serviceAppealRateLimitError
      ? `service rpc failed (${serviceAppealRateLimitError.code ?? "no_code"})`
      : `service rpc ok (${Array.isArray(serviceAppealRateLimitData) ? serviceAppealRateLimitData.length : 0})`,
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
