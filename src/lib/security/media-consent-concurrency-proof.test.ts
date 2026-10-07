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
    expect(script).toMatch(/redacted-local-db-url/u);
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
});
