import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(process.cwd(), "scripts/local-media-consent-concurrency-proof.ts"),
  "utf8",
).replace(/\r\n?/gu, "\n");
const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8").replace(
  /\r\n?/gu,
  "\n",
);

describe("local media-consent concurrency proof", () => {
  it("uses independent direct PostgreSQL sessions with a strict two-stage barrier", () => {
    expect(script).toContain('from "node:child_process"');
    expect(script).toContain("--no-psqlrc");
    expect(script).toContain("SET LOCAL ROLE service_role");
    expect(script).toMatch(/pg_advisory_lock\([\s\S]*pg_advisory_xact_lock_shared/u);
    expect(script).toMatch(/new Set\(\[holderPid, firstPid, secondPid\]\)\.size !== 3/u);
    expect(script).toMatch(/waitUntilBothWorkersBlocked[\s\S]*pg_blocking_pids/u);
    expect(script).toMatch(/waitForFirstClaimResult[\s\S]*waitUntilBlockedBy/u);
    expect(script).toMatch(
      /winner\.child\.stdin\.end\("COMMIT;\\n"\)[\s\S]*waitForClaimResult\([\s\S]*loser\.child\.stdin\.end\("COMMIT;\\n"\)/u,
    );
    expect(script).toMatch(/winners !== 1 \|\| losers !== 1/u);
    expect(script).toMatch(/const replayClaimLease = await beginUpdate/u);
    expect(script).toMatch(/replayRow\.lease_valid !== true \|\| replayRow\.applied !== false/u);
    expect(script).not.toContain(".unref(");
  });

  it("is loopback-only, metadata-only and verifies exact fixture cleanup before PASS", () => {
    expect(script).toMatch(/Concurrency proof refuses a non-loopback PostgreSQL target/u);
    expect(script).toMatch(/requires the disposable local postgres database/u);
    expect(script).not.toContain("@supabase/supabase-js");
    expect(script).not.toMatch(/\bfetch\s*\(/u);
    expect(script).not.toMatch(
      /(?:telegram\.org|api\.openai|generativelanguage|file_id|media_bytes|transcript|provider_payload)/iu,
    );
    expect(script).toMatch(
      /DELETE FROM private\.telegram_media_provider_consents[\s\S]*DELETE FROM public\.telegram_webhook_updates[\s\S]*DELETE FROM private\.telegram_update_leaders/u,
    );
    expect(script).toMatch(/row\.consents !== 0 \|\| row\.updates !== 0 \|\| row\.leaders !== 0/u);
    expect(script.indexOf("await cleanupFixture(databaseUrl, fixture)")).toBeLessThan(
      script.indexOf("Local media-consent concurrency proof: PASS"),
    );
    expect(script).toContain("child.stderr.resume()");
    expect(script).toContain("no credentials logged");
    expect(script).not.toMatch(/console\.(?:log|error)\([^\n]*databaseUrl/iu);
  });

  it("runs after db start and pgTAP with a privately parsed direct DB URL", () => {
    const dbStart = workflow.indexOf("supabase db start");
    const pgTap = workflow.indexOf("Database tests (pgTAP)");
    const proof = workflow.indexOf("Atomic media consent concurrency proof");
    const proofStep = workflow.slice(proof);

    expect(dbStart).toBeGreaterThan(-1);
    expect(pgTap).toBeGreaterThan(dbStart);
    expect(proof).toBeGreaterThan(pgTap);
    expect(proofStep).toContain("command -v psql >/dev/null");
    expect(proofStep).toContain('supabase status -o env > "$status_env"');
    expect(proofStep).toContain("read_status_value DB_URL");
    expect(proofStep).toContain('SUPABASE_DB_URL="$database_url"');
    expect(proofStep).not.toContain("read_status_value API_URL");
    expect(proofStep).not.toContain("read_status_value SERVICE_ROLE_KEY");
    expect(proofStep).toContain("grep -Fqx");
    expect(proofStep).toContain(
      "Local media-consent concurrency proof: PASS (2 concurrent claims + 1 replay, 1 winner, 0 media calls)",
    );
    expect(proofStep).not.toMatch(/\b(?:source|eval)\b/u);
    expect(proofStep).not.toMatch(/(?:cat|echo|printf)[^\n]*database_url/iu);
  });

  it("proves controlled registration arrival in both id orders before expired-row replay", () => {
    expect(script).toContain("firstPid === secondPid");
    expect(script).toMatch(
      /waitUntilBlockedBy\(databaseUrl, firstPid, secondPid\)[\s\S]*jsonRows\(second\.stdout\(\)\)\.length !== 0[\s\S]*first\.child\.stdin\.end\("COMMIT;\\n"\)/u,
    );
    expect(script).toContain("leases[1], leases[2], true");
    expect(script).toContain("leases[4], leases[3], false");
    expect(script).toContain("staleRow.lease_valid !== true || staleRow.applied !== false");
    expect(script).toContain("JSON.stringify(after) !== JSON.stringify(before)");
    expect(workflow).toContain("local-media-consent-concurrency-proof.ts --ordering");
    expect(workflow).toContain(
      "Local media-consent ordering proof: PASS (both arrival orders, expired stale miss, fresh renewal, cleanup verified)",
    );
  });

  it("bounds optional Windows Docker transport to a matching local Supabase container", () => {
    expect(script).toContain("assertLoopbackPostgresUrl(requiredEnv");
    expect(script).toContain("process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT");
    expect(script).toContain('endpoint.startsWith("npipe:////./pipe/")');
    expect(script).toContain('endpoint.startsWith("unix:///")');
    expect(script).toContain('target.Config?.Labels?.["com.supabase.cli.project"] !== project');
    expect(script).toContain("binding.HostPort === port");
    expect(script).toContain("timeout: 5_000");
    expect(script).not.toMatch(/shell:\s*true/u);
  });

  it("proves retention overlap, real lock timeout and prune-first registration without weakening caller limits", () => {
    expect(script).toContain("SET LOCAL lock_timeout = '0'");
    expect(script).toContain("SET LOCAL statement_timeout = '8s'");
    expect(script).toContain("EXCEPTION WHEN query_canceled THEN");
    expect(script).toContain('row.sqlstate !== "55P03"');
    expect(script).toContain('row.caller_lock_timeout !== "0"');
    expect(script).toContain("elapsedMs < 4_000 || elapsedMs > 7_500");
    expect(script).toContain("rollback.checks !== 1");
    expect(script).toContain(
      "retry.checks_deleted !== 1 || retry.telegram_media_provider_consents_deleted !== 0",
    );
    expect(script).toContain("waitUntilBlockedBy(databaseUrl, first.pid, secondPid)");
    expect(script).toContain("await runRetentionSingletonProof(databaseUrl)");
    expect(script).toContain("await runRetentionTimeoutProof(databaseUrl, fixture)");
    expect(script).toContain("await runRetentionPruneFirstProof(databaseUrl, fixture)");
    expect(script).toContain("Local retention timeout diagnostic: PASS");
    expect(script).toContain("row.checks !== 0");
  });

  it("requires the complete retention proof after claims and ordering in CI", () => {
    const retention = workflow.indexOf("local-media-consent-concurrency-proof.ts --retention");
    expect(retention).toBeGreaterThan(
      workflow.indexOf("local-media-consent-concurrency-proof.ts --ordering"),
    );
    expect(workflow.slice(retention)).toContain("grep -Fqx");
    expect(workflow.slice(retention)).toContain(
      "Local retention concurrency proof: PASS (singleton, bounded lock wait, rollback, fresh consent, cleanup verified)",
    );
    expect(workflow).not.toContain("--retention-timeout");
    expect(script.indexOf("await cleanupFixture(databaseUrl, fixture)")).toBeLessThan(
      script.indexOf("Local retention concurrency proof: PASS"),
    );
  });
});
