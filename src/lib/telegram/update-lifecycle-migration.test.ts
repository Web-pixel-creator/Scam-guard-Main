import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260711050337_telegram_update_lifecycle.sql"),
  "utf8",
);
const staleLeaderReclaimMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260715040836_telegram_polling_stale_leader_reclaim.sql",
  ),
  "utf8",
);

describe("Telegram update lifecycle migration contract", () => {
  it("stores only update and operational lease metadata", () => {
    expect(migration).toMatch(/ALTER TABLE public\.telegram_webhook_updates[\s\S]*status TEXT/i);
    expect(migration).toMatch(/processing_fence BIGINT/i);
    expect(migration).not.toMatch(
      /ADD COLUMN[^;]*(payload|message_text|chat_id|user_id|username|url)/i,
    );
  });

  it("uses volatile lease checks and fence-aware completion", () => {
    expect(migration).toMatch(/telegram_update_lease_is_current[\s\S]*LANGUAGE sql\s+VOLATILE/i);
    expect(migration).toMatch(
      /complete_telegram_update[\s\S]*processing_fence = p_processing_fence[\s\S]*lease_expires_at > v_now/i,
    );
    expect(migration).toMatch(
      /mark_telegram_update_failure[\s\S]*lease_expires_at = pg_catalog\.clock_timestamp\(\)/i,
    );
  });

  it("keeps every public RPC service-role only with an empty search_path", () => {
    const functionNames = [
      "acquire_telegram_update_leader",
      "renew_telegram_update_leader",
      "release_telegram_update_leader",
      "telegram_update_leader_status",
      "begin_telegram_update",
      "renew_telegram_update",
      "complete_telegram_update",
      "mark_telegram_update_failure",
      "telegram_update_lease_current",
      "load_telegram_session_fenced",
      "save_telegram_session_fenced",
    ];
    for (const name of functionNames) {
      expect(migration).toMatch(
        new RegExp(
          `FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY DEFINER\\s+SET search_path = ''`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?TO service_role`, "i"),
      );
    }
  });
});

describe("Telegram stale polling leader reclaim migration contract", () => {
  it("keeps the leader and lifecycle RPCs service-role only with empty search paths", () => {
    for (const name of ["acquire_telegram_update_leader", "begin_telegram_update"]) {
      expect(staleLeaderReclaimMigration).toMatch(
        new RegExp(
          `FUNCTION public\\.${name}\\([\\s\\S]*?SECURITY DEFINER\\s+SET search_path = ''`,
          "i",
        ),
      );
      expect(staleLeaderReclaimMigration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
      expect(staleLeaderReclaimMigration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([\\s\\S]*?TO service_role`, "i"),
      );
    }
  });

  it("retains input validation and does not add Telegram payload storage", () => {
    expect(staleLeaderReclaimMigration).toMatch(/p_update_id < 0/i);
    expect(staleLeaderReclaimMigration).toMatch(/p_lease_token IS NULL/i);
    expect(staleLeaderReclaimMigration).toMatch(/p_lease_seconds < 30/i);
    expect(staleLeaderReclaimMigration).toMatch(/p_lease_seconds > 600/i);
    expect(staleLeaderReclaimMigration).toMatch(
      /\(p_leader_token IS NULL\) <> \(p_leader_fence IS NULL\)/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /NOT private\.telegram_update_leader_is_current\(p_leader_token, p_leader_fence\)/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /FOR UPDATE;[\s\S]*?v_now := pg_catalog\.clock_timestamp\(\);[\s\S]*?IF p_leader_token IS NOT NULL[\s\S]*?NOT private\.telegram_update_leader_is_current\(p_leader_token, p_leader_fence\)/i,
    );
    expect(staleLeaderReclaimMigration).not.toMatch(
      /ADD COLUMN[^;]*(payload|message_text|chat_id|user_id|username|url)/i,
    );
  });

  it("reclaims only stale polling-owned rows and advances both fences", () => {
    expect(staleLeaderReclaimMigration).toMatch(
      /v_superseded_polling_owner := p_leader_token IS NOT NULL[\s\S]*?v_row\.leader_token IS NOT NULL[\s\S]*?v_row\.leader_token IS DISTINCT FROM p_leader_token[\s\S]*?v_row\.leader_fence IS DISTINCT FROM p_leader_fence[\s\S]*?NOT private\.telegram_update_leader_is_current\([\s\S]*?v_row\.leader_token,[\s\S]*?v_row\.leader_fence/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /ADD COLUMN IF NOT EXISTS acquired_at TIMESTAMPTZ[\s\S]*?acquired_at = v_now/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /v_reclaim_not_before := v_current_leader_acquired_at \+ interval '15 seconds'/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /IF v_superseded_polling_owner[\s\S]*?AND NOT v_stale_polling_owner[\s\S]*?SELECT 'busy'/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /IF NOT v_stale_polling_owner AND v_row\.lease_expires_at > v_now THEN[\s\S]*?SELECT 'busy'/i,
    );
    expect(staleLeaderReclaimMigration).toMatch(
      /processing_fence = v_row\.processing_fence \+ 1[\s\S]*?leader_token = p_leader_token[\s\S]*?leader_fence = p_leader_fence[\s\S]*?attempt_count = v_row\.attempt_count \+ 1/i,
    );
  });
});
