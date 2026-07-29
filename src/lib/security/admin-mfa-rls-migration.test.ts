import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260729131000_admin_mfa_aal2_rls.sql"),
  "utf8",
).replace(/\r\n?/gu, "\n");
const pgTap = readFileSync(
  resolve(process.cwd(), "supabase/tests/admin_mfa_aal2_rls.test.sql"),
  "utf8",
).replace(/\r\n?/gu, "\n");

function policyDefinition(name: string, table: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    migration.match(
      new RegExp(
        `CREATE POLICY "${escapedName}"[\\s\\S]*?ON public\\.${escapedTable}[\\s\\S]*?(?=\\nDROP POLICY|$)`,
        "iu",
      ),
    )?.[0] ?? ""
  );
}

describe("admin MFA AAL2 RLS migration", () => {
  it("defines a fail-closed current-session admin AAL2 predicate", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION private\.is_admin_aal2\(\)[\s\S]*?SECURITY INVOKER[\s\S]*?SET search_path = ''/iu,
    );
    expect(migration).toMatch(
      /EXISTS\s*\([\s\S]*?FROM public\.user_roles[\s\S]*?user_id = auth\.uid\(\)[\s\S]*?role = 'admin'::public\.app_role[\s\S]*?COALESCE\(auth\.jwt\(\) ->> 'aal', ''\) = 'aal2'/iu,
    );
    expect(migration).not.toMatch(/private\.has_role/iu);
    expect(migration).not.toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+private/iu);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION private\.is_admin_aal2\(\)[\s\S]*?FROM PUBLIC, anon, authenticated/iu,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION private\.is_admin_aal2\(\)[\s\S]*?TO authenticated, service_role/iu,
    );
  });

  it.each([
    ["Admins read reports", "reports"],
    ["Admins read entities", "entities"],
    ["Admins read checks", "checks"],
    ["Admins can read audit log", "admin_actions"],
    ["Admins can read telegram reputation", "telegram_reputation_targets"],
  ])("requires AAL2 for %s", (name, table) => {
    const policy = policyDefinition(name, table);
    expect(policy).toContain("FOR SELECT TO authenticated");
    expect(policy).toContain("USING (private.is_admin_aal2())");
  });

  it.each([
    ["Admins update reports", "reports"],
    ["Admins update entities", "entities"],
  ])("requires AAL2 before and after %s", (name, table) => {
    const policy = policyDefinition(name, table);
    expect(policy).toContain("FOR UPDATE TO authenticated");
    expect(policy).toContain("USING (private.is_admin_aal2())");
    expect(policy).toContain("WITH CHECK (private.is_admin_aal2())");
  });

  it("does not replace or weaken either public confirmed-row policy", () => {
    expect(migration).not.toMatch(/Public can read confirmed entities/iu);
    expect(migration).not.toMatch(/Public can read confirmed telegram reputation/iu);
    expect(migration).not.toMatch(/GRANT\s+SELECT[\s\S]*?\b(?:anon|authenticated)\b/iu);
  });

  it("keeps the hosted pgTAP boundary test compatible with the closed private schema", () => {
    expect(pgTap).toContain("SELECT plan(23);");
    expect(pgTap).toContain("NOT has_schema_privilege('authenticated', 'private', 'USAGE')");
    expect(pgTap).toContain("an AAL2 authenticated user without the admin role cannot read checks");
    expect(pgTap).not.toMatch(/SELECT\s+ok\(\s*(?:NOT\s+)?private\.is_admin_aal2\(\)/iu);
    expect(pgTap).not.toMatch(/SELECT\s+is\(\s*\(WITH changed AS/iu);
    expect(pgTap.match(/^WITH changed AS \(/gmu)).toHaveLength(5);
  });
});
