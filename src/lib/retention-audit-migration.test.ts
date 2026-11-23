import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

function migration(name: string): string {
  return readFileSync(
    new URL(`../../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

const migrationNames = readdirSync(new URL("../../supabase/migrations/", import.meta.url))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .reverse();
const retentionSql = migration(
  migrationNames.find((name) =>
    migration(name).includes("CREATE OR REPLACE FUNCTION private.prune_app_retention"),
  ) ?? "missing-retention-function.sql",
);
const scheduleSql = migration("20260614064831_schedule_retention_cleanup_v1.sql");
const adminActionsSql = migration("20260603100000_cleanup_duplicate_trigger.sql");
const hardeningSql = migration("20260612124559_security_definer_hardening_v1.sql");

function latestRetentionFunction(sql: string): string {
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION private\.prune_app_retention[\s\S]*?REVOKE ALL ON FUNCTION private\.prune_app_retention/,
  );
  expect(match).toBeTruthy();
  return match?.[0] ?? "";
}

function withoutLineComments(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("CORE-009 retention and admin audit migrations", () => {
  it("keeps the retention helper private and service-role only", () => {
    expect(retentionSql).toContain(
      "CREATE OR REPLACE FUNCTION private.prune_app_retention(as_of TIMESTAMPTZ DEFAULT now())",
    );
    expect(retentionSql).toContain("SECURITY DEFINER");
    expect(retentionSql).toContain(
      "REVOKE ALL ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)\n  FROM PUBLIC, anon, authenticated",
    );
    expect(retentionSql).toContain(
      "GRANT EXECUTE ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)\n  TO service_role",
    );
    expect(retentionSql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.prune_app_retention\(TIMESTAMPTZ\)\s+TO\s+(anon|authenticated)/,
    );
  });

  it("prunes only documented volatile data and preserves audit and appeal records", () => {
    const fn = latestRetentionFunction(retentionSql);

    expect(fn).toMatch(/DELETE FROM public\.checks[\s\S]*interval '90 days'/);
    expect(fn).toMatch(
      /DELETE FROM public\.reports[\s\S]*status IN \('confirmed', 'rejected', 'duplicate'\)[\s\S]*interval '365 days'/,
    );
    expect(fn).toMatch(
      /DELETE FROM public\.reports[\s\S]*status IN \('new', 'reviewing'\)[\s\S]*interval '180 days'/,
    );
    expect(fn).toMatch(/DELETE FROM public\.telegram_sessions[\s\S]*interval '30 days'/);
    expect(fn).toMatch(
      /DELETE FROM public\.telegram_reputation_targets[\s\S]*moderation_status <> 'confirmed'[\s\S]*interval '180 days'/,
    );
    expect(fn).toMatch(/DELETE FROM public\.telegram_family_shield[\s\S]*status = 'revoked'/);
    expect(fn).toMatch(/DELETE FROM public\.telegram_family_shield[\s\S]*status = 'pending'/);
    expect(fn).toContain("DELETE FROM public.telegram_webhook_updates");
    expect(fn).toContain("DELETE FROM public.rate_limit_buckets");
    expect(fn).not.toMatch(/DELETE FROM public\.admin_actions/);
    expect(fn).not.toMatch(/DELETE FROM public\.reputation_appeals/);
  });

  it("bounds each runtime lock wait and rejects overlapping pruning transactions before deleting", () => {
    const fn = withoutLineComments(latestRetentionFunction(retentionSql));
    expect(fn).toMatch(/SET search_path = pg_catalog, public\s+SET lock_timeout = '5s'\s+AS \$\$/);
    expect(fn).toContain("pg_catalog.pg_try_advisory_xact_lock(");
    expect(fn).toContain("pg_catalog.hashtextextended('ishonch_guard:prune_app_retention:v1', 0)");
    expect(fn).toContain(
      "RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'retention_prune_busy'",
    );
    expect(fn.indexOf("pg_try_advisory_xact_lock")).toBeLessThan(fn.indexOf("DELETE FROM"));
    expect(fn).not.toMatch(/\bEXCEPTION\s+WHEN\b/i);
    expect(fn).not.toMatch(/pg_(?:try_)?advisory_(?:lock|unlock)\(/);
  });

  it("preserves the previous deletion order, windows and successful JSON response", () => {
    const previous = latestRetentionFunction(
      migration("20260904120000_telegram_media_provider_consent_claim.sql"),
    );
    const deletionAndResult = (sql: string): string =>
      withoutLineComments(sql.slice(sql.indexOf("  DELETE FROM public.checks"))).trim();
    expect(deletionAndResult(latestRetentionFunction(retentionSql))).toBe(
      deletionAndResult(previous),
    );
  });

  it("schedules retention cleanup through cron APIs instead of direct cron.job writes", () => {
    const executableSql = withoutLineComments(scheduleSql);

    expect(scheduleSql).toContain("CREATE EXTENSION IF NOT EXISTS pg_cron");
    expect(scheduleSql).toContain("PERFORM cron.unschedule(existing_job_id)");
    expect(scheduleSql).toContain("PERFORM cron.schedule(");
    expect(scheduleSql).toContain("'ishonch_prune_app_retention_daily'");
    expect(scheduleSql).toContain("'17 20 * * *'");
    expect(scheduleSql).toContain("'SELECT private.prune_app_retention();'");
    expect(executableSql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO\s+)?cron\.job\b/i);
  });

  it("keeps admin audit rows behind RLS and admin-only read policies", () => {
    expect(adminActionsSql).toContain("CREATE TABLE IF NOT EXISTS public.admin_actions");
    expect(adminActionsSql).toContain("ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY");
    expect(adminActionsSql).toContain("GRANT ALL ON public.admin_actions TO service_role");
    expect(adminActionsSql).toContain("GRANT SELECT ON public.admin_actions TO authenticated");
    expect(adminActionsSql).toMatch(
      /CREATE POLICY "Service role inserts audit entries"[\s\S]*FOR INSERT TO service_role[\s\S]*WITH CHECK \(true\)/,
    );

    expect(hardeningSql).toMatch(
      /CREATE POLICY "Admins can read audit log"[\s\S]*ON public\.admin_actions FOR SELECT TO authenticated[\s\S]*USING \(private\.has_role\(auth\.uid\(\), 'admin'\)\)/,
    );
    expect(hardeningSql).toContain(
      "REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role)\n  FROM PUBLIC, anon, authenticated",
    );
  });
});
