import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260724190000_hash_pepper_versioning_v1.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\r\n?/gu, "\n");

describe("hash pepper versioning migration", () => {
  it.each([
    ["checks", "input_hash_version"],
    ["reports", "entity_hash_version"],
    ["entities", "entity_hash_version"],
    ["telegram_reputation_targets", "target_hash_version"],
    ["reputation_appeals", "target_hash_version"],
    ["telegram_family_shield", "invite_code_hash_version"],
  ])("labels existing %s hashes as legacy without rewriting them", (table, column) => {
    expect(migration).toMatch(
      new RegExp(
        `ALTER TABLE public\\.${table}[\\s\\S]*?ADD COLUMN ${column} TEXT NOT NULL DEFAULT 'legacy'`,
        "i",
      ),
    );
  });

  it("keeps contact hash version nullability consistent with the optional contact hash", () => {
    expect(migration).toMatch(/ADD COLUMN contact_hash_version TEXT/i);
    expect(migration).toMatch(
      /\(contact_hash IS NULL AND contact_hash_version IS NULL\)[\s\S]*\(contact_hash IS NOT NULL AND contact_hash_version IS NOT NULL\)/i,
    );
    expect(migration).toMatch(
      /UPDATE public\.reputation_appeals[\s\S]*SET contact_hash_version = 'legacy'[\s\S]*WHERE contact_hash IS NOT NULL/i,
    );
    expect(migration.indexOf("SET contact_hash_version = 'legacy'")).toBeLessThan(
      migration.indexOf("reputation_appeals_contact_hash_version_consistency"),
    );
  });

  it("accepts only bounded non-secret version ids and never embeds a secret value", () => {
    expect(migration.match(/\^\[a-z\]\[a-z0-9_\]\{0,15\}\$/g)?.length).toBeGreaterThanOrEqual(7);
    expect(migration).not.toMatch(
      /HASH_PEPPER_(?:SECRET|ACTIVE_SECRET|PREVIOUS_SECRET)\s*[:=]\s*['"][^'"]+/i,
    );
  });
});
