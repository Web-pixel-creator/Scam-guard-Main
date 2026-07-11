import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260711010000_telegram_session_update_sequence.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Telegram session update sequencing migration", () => {
  it("adds a monotonic update id and a service-role-only atomic write function", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS last_update_id BIGINT NOT NULL DEFAULT 0/i);
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS last_update_at TIMESTAMPTZ/i);
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.save_telegram_session_sequenced/i,
    );
    expect(migration).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, public/i);
    expect(migration).toMatch(/jsonb_typeof\(p_patch\)\s*<>\s*'object'/i);
    expect(migration).toMatch(
      /WHERE\s+EXCLUDED\.last_update_id\s*>=\s*telegram_sessions\.last_update_id/i,
    );
    expect(migration).toMatch(
      /telegram_sessions\.last_update_at\s+IS\s+NULL[\s\S]*last_update_at\s*<=\s*now\(\)\s*-\s*interval\s+'7 days'/i,
    );
    expect(migration).toMatch(/p_patch \? 'scenario_data'/i);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.save_telegram_session_sequenced/i);
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.save_telegram_session_sequenced[\s\S]*service_role/i,
    );
  });
});
