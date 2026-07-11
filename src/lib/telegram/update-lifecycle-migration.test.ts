import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260711050337_telegram_update_lifecycle.sql"),
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
