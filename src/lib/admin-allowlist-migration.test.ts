import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260629085533_gate_admin_allowlist_on_email_confirmation.sql",
);

const migrationSql = readFileSync(migrationPath, "utf8");

describe("admin allowlist email-confirmation migration", () => {
  it("does not let the signup trigger grant admin without a confirmed email", () => {
    const signupFunction = migrationSql.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user_role\(\)[\s\S]*?\$\$;/,
    )?.[0];

    expect(signupFunction).toBeTruthy();
    expect(signupFunction).toContain("NEW.email_confirmed_at IS NOT NULL");
    expect(signupFunction).toContain("v_is_verified_allowlisted");
    expect(signupFunction).toMatch(/WHEN v_is_verified_allowlisted THEN 'admin'::public\.app_role/);
  });

  it("adds a confirmation update trigger that grants allowlisted admin only after verification", () => {
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.handle_confirmed_admin_allowlist_role()",
    );
    expect(migrationSql).toContain("AFTER UPDATE OF email, email_confirmed_at ON auth.users");
    expect(migrationSql).toContain("NEW.email_confirmed_at IS NOT NULL");
    expect(migrationSql).toContain("VALUES (NEW.id, 'admin')");
  });

  it("downgrades previously auto-granted unverified allowlisted admins", () => {
    expect(migrationSql).toContain("WITH downgraded AS");
    expect(migrationSql).toContain("au.email_confirmed_at IS NULL");
    expect(migrationSql).toContain("FROM public.admin_allowlist");
    expect(migrationSql).toContain("SELECT user_id, 'user'::public.app_role");
  });

  it("keeps trigger functions non-callable from public client roles", () => {
    expect(migrationSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated",
    );
    expect(migrationSql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.handle_confirmed_admin_allowlist_role() FROM PUBLIC, anon, authenticated",
    );
  });
});
