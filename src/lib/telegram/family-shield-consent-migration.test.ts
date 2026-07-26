import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260726090000_family_shield_consent_idempotency.sql",
  ),
  "utf8",
).replace(/\r\n?/gu, "\n");

describe("Family Shield consent and idempotency migration", () => {
  it("keeps automatic alerts default-off for both people", () => {
    expect(migration).toMatch(/guardian_auto_alerts_enabled BOOLEAN NOT NULL DEFAULT false/i);
    expect(migration).toMatch(/trusted_auto_alerts_enabled BOOLEAN NOT NULL DEFAULT false/i);
    expect(migration).toMatch(
      /p_mode = 'automatic'[\s\S]*guardian_auto_alerts_enabled[\s\S]*trusted_auto_alerts_enabled[\s\S]*'auto_alerts_disabled'/i,
    );
  });

  it("atomically serializes claims and reserves the cooldown before delivery", () => {
    expect(migration).toMatch(/UNIQUE \(family_id, idempotency_key\)/i);
    expect(migration).toMatch(
      /FROM public\.telegram_family_shield[\s\S]*status = 'active'[\s\S]*FOR UPDATE/i,
    );
    expect(migration).toMatch(
      /INSERT INTO private\.telegram_family_notification_claims[\s\S]*UPDATE public\.telegram_family_shield[\s\S]*last_notified_at = v_now/i,
    );
    expect(migration).toMatch(
      /WHERE claims\.family_id = v_family\.id[\s\S]*claims\.idempotency_key = p_idempotency_key[\s\S]*'duplicate'/i,
    );
  });

  it("stores metadata only and removes expired claims", () => {
    const tableDefinition =
      migration.match(
        /CREATE TABLE private\.telegram_family_notification_claims \(([\s\S]*?)\n\);/i,
      )?.[1] ?? "";

    expect(tableDefinition).not.toMatch(
      /message|payload|checked_text|input|url|phone|username|code|secret|screenshot|ocr|chat_id/i,
    );
    expect(tableDefinition).toMatch(/expires_at TIMESTAMPTZ/i);
    expect(migration).toMatch(
      /DELETE FROM private\.telegram_family_notification_claims\s+WHERE expires_at <= v_now/i,
    );
  });

  it("keeps both SECURITY DEFINER RPCs service-role only with empty search paths", () => {
    for (const [name, signature] of [
      ["claim_telegram_family_notification", "BIGINT, TEXT, TEXT, INTEGER"],
      ["complete_telegram_family_notification", "UUID, BOOLEAN"],
    ] as const) {
      expect(migration).toMatch(
        new RegExp(
          `FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY DEFINER\\s+SET search_path = ''`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\(${signature}\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${name}\\(${signature}\\)[\\s\\S]*?TO service_role`,
          "i",
        ),
      );
    }
  });
});
