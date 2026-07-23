import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260712142514_reconcile_admin_role_lifecycle.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("admin role lifecycle reconciliation migration", () => {
  it("models admin as an exact projection with an explicit revoke branch", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION private.reconcile_admin_role");
    expect(migrationSql).toContain("au.email_confirmed_at IS NOT NULL");
    expect(migrationSql).toContain("JOIN public.admin_allowlist AS al");
    expect(migrationSql).toMatch(
      /ELSE\s+DELETE FROM public\.user_roles\s+WHERE user_id = p_user_id\s+AND role = 'admin'/s,
    );
    expect(migrationSql).toContain("pg_advisory_xact_lock");
  });

  it("reconciles email and confirmation loss instead of filtering null confirmation", () => {
    const trigger = migrationSql.match(
      /CREATE TRIGGER on_auth_user_email_confirmed_role[\s\S]*?EXECUTE FUNCTION public\.handle_confirmed_admin_allowlist_role\(\);/,
    )?.[0];

    expect(trigger).toBeTruthy();
    expect(trigger).toContain("OLD.email IS DISTINCT FROM NEW.email");
    expect(trigger).toContain("OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at");
    expect(trigger).not.toContain("NEW.email_confirmed_at IS NOT NULL");
  });

  it("reconciles allowlist inserts, updates, and deletes", () => {
    expect(migrationSql).toContain(
      "AFTER INSERT OR UPDATE OF email OR DELETE ON public.admin_allowlist",
    );
    expect(migrationSql).toContain("TG_OP IN ('DELETE', 'UPDATE')");
    expect(migrationSql).toContain("IF TG_OP = 'INSERT' THEN");
    expect(migrationSql).toContain("ELSIF TG_OP = 'UPDATE' THEN");
  });

  it("uses the same trimmed case-insensitive email identity as preflight", () => {
    expect(migrationSql).toContain("pg_catalog.lower(pg_catalog.btrim(al.email))");
    expect(migrationSql).toContain("pg_catalog.lower(pg_catalog.btrim(coalesce(au.email, '')))");
  });

  it("keeps privileged helpers unavailable to client and service roles", () => {
    for (const revokePattern of [
      /REVOKE ALL ON FUNCTION private\.reconcile_admin_role\(uuid\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
      /REVOKE ALL ON FUNCTION private\.handle_admin_allowlist_role_change\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
      /REVOKE ALL ON FUNCTION public\.handle_new_user_role\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
      /REVOKE ALL ON FUNCTION public\.handle_confirmed_admin_allowlist_role\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/,
    ]) {
      expect(migrationSql).toMatch(revokePattern);
    }
  });

  it("repairs existing drift set-wise without accumulating per-user advisory locks", () => {
    expect(migrationSql).toContain("SET lock_timeout = '5s'");
    expect(migrationSql).toMatch(
      /INSERT INTO public\.user_roles \(user_id, role\)\s+SELECT au\.id, 'user'/s,
    );
    expect(migrationSql).toMatch(
      /INSERT INTO public\.user_roles \(user_id, role\)\s+SELECT au\.id, 'admin'/s,
    );
    expect(migrationSql).toMatch(
      /DELETE FROM public\.user_roles AS ur\s+WHERE ur\.role = 'admin'/s,
    );
    expect(migrationSql).not.toMatch(
      /FOR v_user_id IN SELECT id FROM auth\.users\s+LOOP\s+PERFORM private\.reconcile_admin_role/s,
    );
  });
});
