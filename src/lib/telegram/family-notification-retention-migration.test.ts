import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const retentionMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729105030_family_notification_claim_retention.sql",
  ),
  "utf8",
).replace(/\r\n?/gu, "\n");

const scheduleMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260614064831_schedule_retention_cleanup_v1.sql"),
  "utf8",
).replace(/\r\n?/gu, "\n");

describe("Family Shield notification claim retention migration", () => {
  it("bounds production DDL waits before replacing the retention function", () => {
    expect(retentionMigration).toContain("SET lock_timeout = '5s'");
    expect(retentionMigration).toContain("SET statement_timeout = '60s'");
    const firstDdl = retentionMigration.indexOf(
      "CREATE OR REPLACE FUNCTION private.prune_app_retention",
    );
    expect(retentionMigration.indexOf("SET lock_timeout")).toBeLessThan(firstDdl);
    expect(retentionMigration.indexOf("SET statement_timeout")).toBeLessThan(firstDdl);
  });

  it("adds expired claims to the existing scheduled retention path", () => {
    expect(retentionMigration).toMatch(
      /DELETE FROM private\.telegram_family_notification_claims\s+WHERE expires_at <= as_of/i,
    );
    expect(retentionMigration).toMatch(
      /GET DIAGNOSTICS deleted_family_notification_claims = ROW_COUNT/i,
    );
    expect(retentionMigration).toContain(
      "'telegram_family_notification_claims_deleted', deleted_family_notification_claims",
    );
    expect(scheduleMigration).toContain("'SELECT private.prune_app_retention();'");
  });

  it("preserves every cleanup category from the previous active function", () => {
    expect(retentionMigration).toMatch(/DELETE FROM public\.checks[\s\S]*interval '90 days'/i);
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.reports[\s\S]*status IN \('confirmed', 'rejected', 'duplicate'\)[\s\S]*interval '365 days'/i,
    );
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.reports[\s\S]*status IN \('new', 'reviewing'\)[\s\S]*interval '180 days'/i,
    );
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.telegram_sessions[\s\S]*interval '30 days'/i,
    );
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.telegram_reputation_targets[\s\S]*moderation_status <> 'confirmed'[\s\S]*interval '180 days'/i,
    );
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.telegram_family_shield[\s\S]*status = 'revoked'[\s\S]*interval '30 days'/i,
    );
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.telegram_family_shield[\s\S]*status = 'pending'[\s\S]*interval '7 days'/i,
    );
    expect(retentionMigration).toContain("DELETE FROM public.telegram_webhook_updates");
    expect(retentionMigration).toContain("DELETE FROM public.rate_limit_buckets");
    expect(retentionMigration).toMatch(
      /DELETE FROM public\.embed_origin_events[\s\S]*interval '180 days'/i,
    );
    expect(retentionMigration).not.toMatch(
      /DELETE FROM public\.(?:admin_actions|reputation_appeals)/i,
    );
  });

  it("preserves the hardened function boundary", () => {
    expect(retentionMigration).toMatch(
      /CREATE OR REPLACE FUNCTION private\.prune_app_retention\(as_of TIMESTAMPTZ DEFAULT now\(\)\)[\s\S]*LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = pg_catalog, public/i,
    );
    expect(retentionMigration).toContain(
      "REVOKE ALL ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)\n  FROM PUBLIC, anon, authenticated",
    );
    expect(retentionMigration).toContain(
      "GRANT EXECUTE ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)\n  TO service_role",
    );
    expect(retentionMigration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION private\.prune_app_retention\(TIMESTAMPTZ\)\s+TO\s+(?:PUBLIC|anon|authenticated)/i,
    );
  });

  it("does not replace or directly modify the cron job", () => {
    const executableSql = retentionMigration
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    expect(executableSql).not.toMatch(/\bcron\.(?:schedule|unschedule)\b/i);
    expect(executableSql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?cron\.job\b/i);
  });
});
