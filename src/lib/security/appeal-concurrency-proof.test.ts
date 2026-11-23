import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appealCall,
  assertLoopbackPostgresUrl,
  assertReceipt,
  buildFixture,
} from "../../../scripts/local-appeal-concurrency-proof";

const script = readFileSync(
  resolve(process.cwd(), "scripts/local-appeal-concurrency-proof.ts"),
  "utf8",
).replace(/\r\n?/gu, "\n");

describe("local appeal concurrency proof safety and contract", () => {
  it("requires the real appeal proof and its success sentinel in CI", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain(
      'SUPABASE_DB_URL="$database_url" bun scripts/local-appeal-concurrency-proof.ts',
    );
    expect(workflow).toContain('<<< "$appeal_output"');
    expect(workflow).toContain(
      "Local appeal concurrency proof: PASS (8 observed lock barriers; duplicate/distinct/rotation/rollback/admin/replay; cleanup verified)",
    );
  });

  it.each([
    "postgres://postgres:synthetic@127.0.0.1:54342/postgres",
    "postgresql://postgres:synthetic@localhost:54342/postgres",
    "postgres://postgres:synthetic@[::1]:54342/postgres",
  ])("accepts a bounded disposable loopback target (%s)", (url) => {
    const result = new URL(assertLoopbackPostgresUrl(url));
    expect(["127.0.0.1", "[::1]"]).toContain(result.hostname);
  });

  it.each([
    "",
    "invalid",
    "https://127.0.0.1/postgres",
    "postgres://postgres:synthetic@db.example.com/postgres",
    "postgres://postgres:synthetic@localhost.evil.test/postgres",
    "postgres://postgres:synthetic@127.0.0.2/postgres",
    "postgres://postgres:synthetic@127.0.0.1/production",
    "postgres://service_role:synthetic@127.0.0.1/postgres",
    "postgres://postgres:synthetic@127.0.0.1/postgres?host=db.example.com",
    "postgres://postgres:synthetic@127.0.0.1/postgres?service=remote",
    "postgres://postgres:synthetic@127.0.0.1/postgres#fragment",
  ])("fails closed before a connection for invalid/override target (%s)", (url) => {
    expect(() => assertLoopbackPostgresUrl(url)).toThrow();
  });

  it("creates disjoint synthetic ownership scopes and never invents real identifiers", () => {
    const first = buildFixture("test-one");
    const second = buildFixture("test-two");
    expect(first.cases).toHaveLength(6);
    expect(first.hashes).toHaveLength(21);
    expect(new Set(first.hashes).size).toBe(21);
    expect(first.hashes.some((hash) => second.hashes.includes(hash))).toBe(false);
    for (const scenario of first.cases) {
      for (const input of [scenario.first, scenario.second]) {
        expect(input.targetDisplay).toBe(first.marker);
        expect(input.reason).toContain(first.marker);
        expect(input.contactHashes.length === 0).toBe(input.contactDisplay === null);
        for (const candidate of [...input.targetHashes, ...input.contactHashes]) {
          expect(candidate.hash).toMatch(/^[0-9a-f]{64}$/u);
          expect(candidate.version).toMatch(/^[a-z][a-z0-9_]{0,15}$/u);
        }
      }
    }
  });

  it("preserves distinct evidence and tests only the supported forward rotation boundary", () => {
    const cases = buildFixture("scenarios").cases;
    expect(cases.find((entry) => entry.name === "distinct reason")?.rows).toBe(2);
    expect(cases.find((entry) => entry.name === "distinct contact")?.rows).toBe(2);
    const rotation = cases.find((entry) => entry.name === "forward rotation")!;
    expect(rotation.first.targetHashes[0].version).toBe("v2");
    expect(rotation.second.targetHashes[0].version).toBe("v3");
    expect(rotation.second.targetHashes).toEqual(
      expect.arrayContaining(rotation.first.targetHashes),
    );
    expect(rotation.second.contactHashes).toEqual(
      expect.arrayContaining(rotation.first.contactHashes),
    );
    expect(cases.filter((entry) => entry.rollbackFirst)).toHaveLength(1);
  });

  it("calls the exact atomic RPC as service_role at read committed", () => {
    const input = buildFixture("quote").cases[0].first;
    input.reason = "Synthetic caller's evidence";
    const sql = appealCall(input);
    expect(sql).toContain("public.submit_reputation_appeal(");
    expect(sql).toContain("'telegram'::public.input_type");
    expect(sql).toContain("Synthetic caller''s evidence");
    expect(sql).toContain("p_contact_hashes => '[]'::jsonb");
    expect(sql).toContain("p_contact_display => NULL::text");
    expect(script).toContain("BEGIN ISOLATION LEVEL READ COMMITTED");
    expect(script).toContain("SET LOCAL ROLE service_role");
    expect(script).toContain("SET LOCAL lock_timeout = '5s'");
    expect(script).toContain("SET LOCAL statement_timeout = '10s'");
  });

  it.each([
    [{ accepted: true, notify_moderation: true }, true],
    [{ accepted: true, notify_moderation: false }, false],
  ])("accepts only the expected two-field receipt (%j)", (row, notify) => {
    expect(() => assertReceipt(row, notify)).not.toThrow();
  });

  it.each([
    {},
    { accepted: false, notify_moderation: true },
    { accepted: true, notify_moderation: "true" },
    { accepted: true, notify_moderation: false },
    { accepted: true, notify_moderation: true, id: "unexpected" },
  ])("rejects mismatched or broadened internal receipts (%j)", (row) => {
    expect(() => assertReceipt(row, true)).toThrow();
  });

  it("observes a real independent advisory lock waiter before releasing the writer", () => {
    expect(script).toContain("firstPid === secondPid");
    expect(script).toContain("pg_catalog.pg_blocking_pids");
    expect(script).toContain("pg_catalog.pg_locks");
    expect(script).toContain("locktype = 'advisory'");
    expect(script).toContain("AND NOT granted");
    expect(script).toContain("pg_catalog.pg_stat_activity");
    expect(script).toContain("state = 'active' AND wait_event_type = 'Lock'");
    expect(script).toMatch(
      /await waitUntilAdvisoryBlocked\(databaseUrl, firstPid, secondPid\);[\s\S]*jsonRows\(second.stdout\(\)\).length !== 0[\s\S]*first.child.stdin.end\(scenario.rollbackFirst/u,
    );
    expect(script).toContain("assertReceipt(await resultRow(second), scenario.rollbackFirst)");
    expect(script).toContain("JSON.stringify(afterReplay) !== JSON.stringify(stored)");
  });

  it("proves admin row locks in both arrival orders and permits a new episode", () => {
    expect(script).toContain("UPDATE public.reputation_appeals SET status = 'resolved'");
    expect(script).toContain("locktype IN ('transactionid', 'tuple')");
    expect(script).toContain("waitUntilAdvisoryBlocked(databaseUrl, submitPid, adminPid, true)");
    expect(script).toContain(
      "waitUntilAdvisoryBlocked(databaseUrl, adminFirstPid, submitSecondPid, true)",
    );
    expect(script).toContain("assertReceipt(await resultRow(submitSecond), true)");
    expect(script).toContain('stored.filter((row) => row.status === "resolved").length !== 2');
    expect(script).toContain("await runAdminRace(databaseUrl, fixture.adminInput)");
  });

  it("cleans only exact owned hash/type/display scope and verifies cleanup before PASS", () => {
    expect(script).toContain("target_hash = ANY(ARRAY[");
    expect(script).toContain("AND target_type = 'telegram'::public.input_type");
    expect(script).toContain("AND target_display = ${literal(fixture.marker)}");
    expect(script).toContain("DELETE FROM public.reputation_appeals WHERE ${ownedWhere(fixture)}");
    expect(script).toContain("cleanup.remaining !== 0");
    expect(script).toContain("if (ownsScope)");
    expect(script.indexOf("initial.rows !== 0")).toBeLessThan(script.indexOf("ownsScope = true"));
    expect(script.indexOf("await terminateSessions();")).toBeLessThan(
      script.indexOf("DELETE FROM public.reputation_appeals"),
    );
    expect(script.indexOf("cleanup.remaining !== 0")).toBeLessThan(
      script.indexOf("Local appeal concurrency proof: PASS"),
    );
    expect(script).not.toMatch(/\b(?:TRUNCATE|DROP\s+TABLE)\b/iu);
  });

  it("requires a matching local Docker target and never prints connection/error payloads", () => {
    expect(script).toContain("process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT");
    expect(script).toContain('endpoint.startsWith("npipe:////./pipe/")');
    expect(script).toContain('endpoint.startsWith("unix:///")');
    expect(script).toContain('target.Config?.Labels?.["com.supabase.cli.project"] !== project');
    expect(script).toContain("binding.HostPort === port");
    expect(script).toContain('url.password = ""');
    expect(script).toContain("PGPASSWORD: password");
    expect(script).not.toMatch(/console\.(?:log|error)\([^\n]*(?:databaseUrl|error|stderr)/iu);
    expect(script).not.toMatch(/\bfetch\s*\(/u);
    expect(script).not.toContain("@supabase/supabase-js");
    expect(script).not.toContain(".unref(");
  });
});
