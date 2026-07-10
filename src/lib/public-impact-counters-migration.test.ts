import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260629163000_public_impact_counters_confirmed_reports.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("public impact counters migration", () => {
  it("keeps report and loss impact limited to confirmed reports", () => {
    expect(migrationSql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_check_stats\(\)/);
    expect(migrationSql).toMatch(
      /reports_total[\s\S]*FROM public\.reports WHERE status = 'confirmed'/,
    );
    expect(migrationSql).toMatch(
      /reports_with_loss_amount[\s\S]*FROM public\.reports WHERE status = 'confirmed' AND amount_lost_uzs > 0/,
    );
    expect(migrationSql).toMatch(
      /reported_loss_uzs[\s\S]*SUM\(amount_lost_uzs\)[\s\S]*WHERE status = 'confirmed' AND amount_lost_uzs > 0/,
    );
    expect(migrationSql).toMatch(/TO service_role/);
    expect(migrationSql).not.toMatch(/TO anon|TO authenticated/);
  });
});
