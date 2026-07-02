import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260702063847_embed_origin_analytics_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("embed origin analytics migration", () => {
  it("creates a service-role-only RLS table for aggregate embed telemetry", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.embed_origin_events");
    expect(migrationSql).toContain(
      "ALTER TABLE public.embed_origin_events ENABLE ROW LEVEL SECURITY",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON public.embed_origin_events FROM PUBLIC, anon, authenticated",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, DELETE ON public.embed_origin_events TO service_role",
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)[\s\S]*public\.embed_origin_events[\s\S]*TO\s+(anon|authenticated)/,
    );
  });

  it("stores origin-level metadata without raw user input or full URLs", () => {
    const tableDefinition = migrationSql.match(
      /CREATE TABLE IF NOT EXISTS public\.embed_origin_events \([\s\S]*?\n\);/,
    )?.[0];

    expect(tableDefinition).toBeTruthy();
    expect(tableDefinition).toContain("referrer_origin TEXT");
    expect(tableDefinition).toContain("referrer_host TEXT");
    expect(tableDefinition).toContain("input_type public.input_type");
    expect(tableDefinition).toContain("risk_level public.risk_level");
    expect(tableDefinition).toContain("reason_count INTEGER");
    expect(tableDefinition).not.toMatch(/\b(raw|redacted|hash|query|fragment|path|url|phone)\b/i);
  });

  it("adds embed telemetry to retention pruning", () => {
    expect(migrationSql).toMatch(
      /DELETE FROM public\.embed_origin_events\s+WHERE created_at < as_of - interval '180 days'/,
    );
    expect(migrationSql).toContain("'embed_origin_events_deleted', deleted_embed_origin_events");
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)",
    );
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION private.prune_app_retention(TIMESTAMPTZ)\n  TO service_role",
    );
  });
});
