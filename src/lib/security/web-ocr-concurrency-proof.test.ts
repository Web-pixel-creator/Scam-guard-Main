import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertWebOcrClaim,
  buildWebOcrFixture,
  runLocalWebOcrConcurrencyProof,
  webOcrClaimSql,
  type WebOcrProofTicket,
} from "../../../scripts/local-web-ocr-concurrency-proof";
import {
  configurePsqlTransport,
  startPsql,
} from "../../../scripts/local-media-consent-concurrency-proof";

// Importing and testing this runner must never spawn psql/docker or touch a DB.
vi.mock("../../../scripts/local-media-consent-concurrency-proof", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../scripts/local-media-consent-concurrency-proof")>();
  return {
    ...actual,
    configurePsqlTransport: vi.fn(),
    startPsql: vi.fn(() => {
      throw new Error("Synthetic transport boundary");
    }),
  };
});

const script = readFileSync(
  resolve(process.cwd(), "scripts/local-web-ocr-concurrency-proof.ts"),
  "utf8",
).replace(/\r\n?/gu, "\n");
const transport = readFileSync(
  resolve(process.cwd(), "scripts/local-media-consent-concurrency-proof.ts"),
  "utf8",
);
const valid: WebOcrProofTicket = {
  ticketId: "129f599b-841d-4c3e-b4fa-4bda9ecdb990",
  issuedAtMs: 1_800_000_000_000,
  expiresAtMs: 1_800_000_600_000,
};

beforeEach(() => vi.clearAllMocks());

describe("local Web OCR concurrency proof isolation", () => {
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
  ])("rejects unsafe target before transport configuration or connection (%s)", async (url) => {
    await expect(runLocalWebOcrConcurrencyProof(url)).rejects.toThrow();
    expect(configurePsqlTransport).not.toHaveBeenCalled();
    expect(startPsql).not.toHaveBeenCalled();
  });

  it.each([
    "postgres://postgres:synthetic@127.0.0.1:54342/postgres",
    "postgresql://postgres:synthetic@localhost:54342/postgres",
    "postgres://postgres:synthetic@[::1]:54342/postgres",
  ])(
    "uses only the validated local transport and owns nothing on connection failure (%s)",
    async (url) => {
      await expect(runLocalWebOcrConcurrencyProof(url)).rejects.toThrow(
        "Synthetic transport boundary",
      );
      expect(configurePsqlTransport).toHaveBeenCalledOnce();
      expect(startPsql).toHaveBeenCalledOnce();
      expect(startPsql).toHaveBeenCalledWith(vi.mocked(configurePsqlTransport).mock.calls[0][0]);
    },
  );

  it("allocates six disjoint UUID-only synthetic fixture scopes", () => {
    const first = Object.values(buildWebOcrFixture());
    const second = Object.values(buildWebOcrFixture());
    expect(first).toHaveLength(6);
    expect(new Set([...first, ...second]).size).toBe(12);
    for (const id of [...first, ...second]) {
      expect(id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u);
    }
  });

  it("calls the exact RPC with typed named arguments and a ten-minute fixture", () => {
    const sql = webOcrClaimSql(valid);
    expect(sql).toContain("public.claim_web_ocr_ticket(");
    expect(sql).toContain(`p_ticket_id => '${valid.ticketId}'::uuid`);
    expect(sql).toContain(`p_issued_at_ms => ${valid.issuedAtMs}::bigint`);
    expect(sql).toContain(`p_expires_at_ms => ${valid.expiresAtMs}::bigint`);
  });

  it.each([
    { ticketId: "00000000-0000-0000-0000-000000000000" },
    { ticketId: "'::uuid); SELECT 1; --" },
    { issuedAtMs: -1 },
    { issuedAtMs: 0.1 },
    { issuedAtMs: Number.NaN },
    { expiresAtMs: Number.POSITIVE_INFINITY },
    { expiresAtMs: Number.MAX_SAFE_INTEGER + 1 },
    { expiresAtMs: valid.expiresAtMs + 1 },
    { expiresAtMs: valid.expiresAtMs - 1 },
  ])("rejects unsafe SQL fixture values (%j)", (override) => {
    expect(() => webOcrClaimSql({ ...valid, ...override })).toThrow();
  });

  it.each([true, false] as const)("requires exact boolean claim result %s", (claimed) => {
    const row = { claimed, sqlstate: "00000", elapsed_ms: 1, caller_lock_timeout: "0" };
    expect(() => assertWebOcrClaim(row, claimed)).not.toThrow();
    expect(() => assertWebOcrClaim(row, !claimed)).toThrow();
    expect(() => assertWebOcrClaim({ ...row, extra: true }, claimed)).toThrow();
    expect(() => assertWebOcrClaim({ ...row, claimed: String(claimed) }, claimed)).toThrow();
  });

  it("accepts only real bounded 55P03 lock failure, not a statement timeout or authorization", () => {
    const row = { claimed: null, sqlstate: "55P03", elapsed_ms: 5_010, caller_lock_timeout: "0" };
    expect(() => assertWebOcrClaim(row, "lock_timeout")).not.toThrow();
    for (const override of [
      { claimed: true },
      { claimed: false },
      { sqlstate: "57014" },
      { sqlstate: "00000" },
      { elapsed_ms: 3_999 },
      { elapsed_ms: 7_501 },
      { elapsed_ms: Number.NaN },
      { caller_lock_timeout: "5s" },
    ]) {
      expect(() => assertWebOcrClaim({ ...row, ...override }, "lock_timeout")).toThrow();
    }
  });

  it("observes independent PostgreSQL lock waiters before releasing transaction barriers", () => {
    expect(script).toContain("BEGIN ISOLATION LEVEL READ COMMITTED");
    expect(script).toContain("SET LOCAL ROLE service_role");
    expect(script).toContain("SET LOCAL lock_timeout = '0'");
    expect(script).toContain("SET LOCAL statement_timeout = '8s'");
    expect(script).toContain("first.pid === second.pid");
    expect(script).toContain("pg_catalog.pg_blocking_pids");
    expect(script).toContain("pg_catalog.pg_locks");
    expect(script).toContain("locktype IN ('transactionid', 'tuple') AND NOT granted");
    expect(script).toContain("state = 'active' AND wait_event_type = 'Lock'");
    expect(script).toContain("jsonRows(second.session.stdout()).length !== 0");
    expect(script).toContain("observedBarriers !== 4");
  });

  it("checks the post-wait deadline with the DB clock, rollback, and an inert tombstone", () => {
    expect(script).toContain(
      "floor(extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint",
    );
    expect(script).toContain("const expiring = await blockedPair(expiry)");
    expect(script).toContain("SELECT pg_catalog.pg_sleep(greatest(0,");
    expect(script).toContain("await finish(expiring.first, false)");
    expect(script).toContain("assertWebOcrClaim(await result(expiring.second), false)");
    expect(script).toContain("await assertStored(expiry, 1)");
    expect(script).toContain("await singleClaim(expiry, false)");
    expect(script).toContain('assertWebOcrClaim(await result(timingOut.second), "lock_timeout")');
    expect(script).toContain("await assertStored(timeout, 0)");
    expect(script).toContain("await singleClaim(timeout, true)");
  });

  it("rolls back global prune effects, cleans only owned UUIDs, and verifies zero before PASS", () => {
    expect(script).toContain("SELECT private.prune_web_ocr_ticket_claims();");
    expect(script).toMatch(/'old_claim'[\s\S]*'fresh_claim'[\s\S]*ROLLBACK;/u);
    expect(script).toContain("await assertStored(expired, 1)");
    expect(script).toContain("await assertStored(fresh, 0)");
    expect(script).toContain("ticket_id = ANY(ARRAY[");
    expect(script).toContain("DELETE FROM private.web_ocr_ticket_claims WHERE ${ownedWhere}");
    expect(script).toContain("if (ownsScope)");
    expect(script.indexOf("initial.rows !== 0")).toBeLessThan(script.indexOf("ownsScope = true"));
    expect(script).toMatch(/finally \{\s*await terminateSessions\(\);/u);
    expect(script.indexOf("cleanup.remaining !== 0")).toBeLessThan(
      script.indexOf("Local Web OCR concurrency proof: PASS"),
    );
    expect(script).not.toMatch(/\b(?:TRUNCATE|DROP\s+TABLE)\b/iu);
  });

  it("reuses credential-safe local transport without application/provider dependencies", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain(
      'SUPABASE_DB_URL="$database_url" bun scripts/local-web-ocr-concurrency-proof.ts',
    );
    expect(workflow).toContain('<<< "$ocr_output"');
    expect(workflow).toContain(
      "Local Web OCR concurrency proof: PASS (4 observed lock barriers; commit/rollback/expiry/timeout/prune/replay/fresh; cleanup verified; 0 provider calls)",
    );
    expect(script).toContain('from "./local-media-consent-concurrency-proof"');
    expect(transport).toContain('!key.toUpperCase().startsWith("PG")');
    expect(transport).toContain("process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT");
    expect(transport).toContain('target.Config?.Labels?.["com.supabase.cli.project"] !== project');
    expect(transport).toContain("binding.HostPort === port");
    expect(transport).toContain('url.password = ""');
    expect(transport).toContain("child.stderr.resume()");
    expect(script).not.toMatch(/\bfetch\s*\(|@supabase\/supabase-js|from ["']@\//u);
    expect(script).not.toMatch(/console\.(?:log|error)\([^\n]*(?:databaseUrl|error|stderr)/iu);
    expect(script).toContain("import.meta.url === pathToFileURL(resolve(process.argv[1])).href");
  });
});
