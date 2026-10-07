import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904120000_telegram_media_provider_consent_claim.sql",
  ),
  "utf8",
).replace(/\r\n?/gu, "\n");

const functionSignatures = [
  [
    "register_telegram_media_provider_consent",
    "BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID",
  ],
  [
    "grant_telegram_media_provider_consent",
    "BIGINT, BIGINT, TEXT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID",
  ],
  [
    "revoke_telegram_media_provider_consent",
    "BIGINT, BIGINT, TEXT, BIGINT, BIGINT, UUID, BIGINT, UUID, BIGINT",
  ],
  [
    "claim_telegram_media_provider_consent",
    "BIGINT, BIGINT, TEXT, TEXT, BIGINT, UUID, BIGINT, UUID, BIGINT, UUID",
  ],
] as const;

function getFunctionDefinition(name: string): string {
  const definition = migration.match(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, "i"),
  )?.[0];

  expect(definition, `${name} must exist in the migration`).toBeDefined();
  return definition ?? "";
}

describe("Telegram external-media consent migration", () => {
  it("stores only bounded consent metadata in a private RLS table", () => {
    const tableDefinition =
      migration.match(
        /CREATE TABLE private\.telegram_media_provider_consents \(([\s\S]*?)\n\);/i,
      )?.[1] ?? "";

    expect(tableDefinition).toMatch(/PRIMARY KEY \(telegram_user_id, chat_id\)/i);
    expect(tableDefinition).toMatch(/media_kind TEXT NOT NULL[\s\S]*'report_image'/i);
    expect(tableDefinition).toMatch(/report_flow_id UUID/i);
    expect(tableDefinition).toMatch(/prompt_message_id BIGINT NOT NULL/i);
    expect(tableDefinition).toMatch(/expires_at TIMESTAMPTZ NOT NULL/i);
    expect(tableDefinition).toMatch(/last_update_id BIGINT NOT NULL/i);
    expect(tableDefinition).toMatch(
      /CHECK \(\(media_kind = 'report_image'\) = \(report_flow_id IS NOT NULL\)\)/i,
    );
    expect(tableDefinition).not.toMatch(
      /^\s*(?:payload|telegram_file_id|file_id|media_bytes|image|audio|ocr|transcript|user_text|provider_payload|secret_value)\s/imu,
    );
    expect(migration).toContain(
      "ALTER TABLE private.telegram_media_provider_consents ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE private\.telegram_media_provider_consents\s+FROM PUBLIC, anon, authenticated, service_role/i,
    );
  });

  it("bounds DDL waits and indexes the retention boundary", () => {
    const firstDdl = migration.indexOf("CREATE TABLE private.telegram_media_provider_consents");

    expect(migration).toContain("SET lock_timeout = '5s'");
    expect(migration).toContain("SET statement_timeout = '60s'");
    expect(migration.indexOf("SET lock_timeout")).toBeLessThan(firstDdl);
    expect(migration.indexOf("SET statement_timeout")).toBeLessThan(firstDdl);
    expect(migration).toMatch(
      /CREATE INDEX telegram_media_provider_consents_expires_idx\s+ON private\.telegram_media_provider_consents \(expires_at\)/i,
    );
  });

  it("keeps every privileged RPC lease-fenced and service-role only", () => {
    expect(migration).toMatch(
      /FUNCTION private\.lock_telegram_media_consent_update_lease\([\s\S]*?FROM public\.telegram_webhook_updates AS update_row[\s\S]*?FOR UPDATE;[\s\S]*?FROM private\.telegram_update_leaders AS leader[\s\S]*?FOR SHARE;[\s\S]*?RETURN private\.telegram_update_lease_is_current/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.lock_telegram_media_consent_update_lease\([\s\S]*?FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /FUNCTION private\.lock_telegram_media_consent_scope\([\s\S]*?pg_advisory_xact_lock[\s\S]*?FROM private\.telegram_media_provider_consents AS consent[\s\S]*?FOR UPDATE/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.lock_telegram_media_consent_scope\(BIGINT, BIGINT\)\s+FROM PUBLIC, anon, authenticated, service_role/i,
    );

    for (const [name, signature] of functionSignatures) {
      const definition = getFunctionDefinition(name);

      expect(definition).toMatch(
        /RETURNS TABLE\(lease_valid BOOLEAN, applied BOOLEAN\)[\s\S]*LANGUAGE plpgsql\s+VOLATILE\s+SECURITY DEFINER\s+SET search_path = ''\s+SET lock_timeout = '5s'/i,
      );
      expect(definition).toMatch(
        /p_leader_token IS NULL OR p_leader_fence IS NULL OR p_leader_fence < 1/i,
      );
      expect(definition).toMatch(
        /IF NOT private\.lock_telegram_media_consent_update_lease\([\s\S]*?\) THEN\s+RETURN QUERY SELECT false, false/i,
      );
      expect(definition).toMatch(
        /(?:WHERE|AND) private\.telegram_update_lease_is_current\([\s\S]*?\)[\s\S]*?GET DIAGNOSTICS v_row_count = ROW_COUNT/i,
      );
      expect(migration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\(\\s*${signature.replaceAll(
            ", ",
            ",\\s*",
          )}\\s*\\) FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${name}\\(\\s*${signature.replaceAll(
            ", ",
            ",\\s*",
          )}\\s*\\) TO service_role`,
          "i",
        ),
      );
    }
  });

  it("registers a ten-minute prompt and rejects older update ids", () => {
    const definition = getFunctionDefinition("register_telegram_media_provider_consent");

    expect(definition).toMatch(/v_now \+ interval '10 minutes'/i);
    expect(definition).toMatch(
      /ON CONFLICT \(telegram_user_id, chat_id\) DO UPDATE[\s\S]*?WHERE \([\s\S]*?EXCLUDED\.last_update_id >= consent\.last_update_id/i,
    );
    expect(definition).toMatch(
      /granted_at = NULL[\s\S]*terminal_at = NULL[\s\S]*terminal_reason = NULL/i,
    );
  });

  it("binds grant and revoke transitions to the exact disclosure prompt", () => {
    const grant = getFunctionDefinition("grant_telegram_media_provider_consent");
    const revoke = getFunctionDefinition("revoke_telegram_media_provider_consent");

    for (const definition of [grant, revoke]) {
      expect(definition).toMatch(
        /consent\.telegram_user_id = p_telegram_user_id[\s\S]*consent\.chat_id = p_chat_id[\s\S]*consent\.chat_type = p_chat_type/i,
      );
      expect(definition).toMatch(
        /consent\.prompt_message_id = p_prompt_message_id[\s\S]*consent\.terminal_at IS NULL[\s\S]*p_update_id > consent\.last_update_id/i,
      );
    }
    expect(grant).toMatch(/consent\.granted_at IS NULL/i);
    expect(grant).toMatch(/consent\.report_flow_id IS NOT DISTINCT FROM p_report_flow_id/i);
    expect(revoke).toMatch(/terminal_reason = 'revoked'/i);
  });

  it("implements one-winner claim as one conditional UPDATE", () => {
    const claim = getFunctionDefinition("claim_telegram_media_provider_consent");

    expect(claim.match(/UPDATE private\.telegram_media_provider_consents/giu)).toHaveLength(1);
    expect(claim).not.toMatch(/SELECT[\s\S]*FROM private\.telegram_media_provider_consents/i);
    expect(claim).toMatch(
      /SET\s+terminal_at = v_now,\s+terminal_reason = 'consumed',\s+last_update_id = p_update_id/i,
    );
    expect(claim).toMatch(
      /consent\.media_kind = p_media_kind[\s\S]*consent\.report_flow_id IS NOT DISTINCT FROM p_report_flow_id[\s\S]*consent\.granted_at IS NOT NULL[\s\S]*consent\.terminal_at IS NULL[\s\S]*p_update_id > consent\.last_update_id/i,
    );
    expect(claim).toMatch(
      /GET DIAGNOSTICS v_row_count = ROW_COUNT;[\s\S]*?IF v_row_count = 1 THEN\s+RETURN QUERY SELECT true, true;[\s\S]*?RETURN QUERY SELECT private\.telegram_update_lease_is_current\([\s\S]*?\), false/i,
    );
  });

  it("adds expired consent tombstones to the existing retention path", () => {
    expect(migration.indexOf("DELETE FROM public.telegram_webhook_updates")).toBeLessThan(
      migration.indexOf("DELETE FROM private.telegram_media_provider_consents"),
    );
    expect(migration).toMatch(
      /DELETE FROM private\.telegram_media_provider_consents\s+WHERE expires_at <= as_of/i,
    );
    expect(migration).toMatch(/GET DIAGNOSTICS deleted_media_provider_consents = ROW_COUNT/i);
    expect(migration).toContain(
      "'telegram_media_provider_consents_deleted', deleted_media_provider_consents",
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.prune_app_retention\(TIMESTAMPTZ\)\s+FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION private\.prune_app_retention\(TIMESTAMPTZ\)\s+TO service_role/i,
    );
  });
});
