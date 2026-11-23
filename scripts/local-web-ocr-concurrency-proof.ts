import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertLoopbackPostgresUrl,
  configurePsqlTransport,
  requireSuccessfulExit,
  startPsql,
} from "./local-media-consent-concurrency-proof";

type Row = Record<string, unknown>;
type Session = ReturnType<typeof startPsql>;
export interface WebOcrProofTicket {
  ticketId: string;
  issuedAtMs: number;
  expiresAtMs: number;
}

const TTL_MS = 600_000;
const DB_NOW = "floor(extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint";

export function buildWebOcrFixture(): Record<
  "commit" | "rollback" | "expiry" | "timeout" | "prune" | "fresh",
  string
> {
  return {
    commit: randomUUID(),
    rollback: randomUUID(),
    expiry: randomUUID(),
    timeout: randomUUID(),
    prune: randomUUID(),
    fresh: randomUUID(),
  };
}

export function webOcrClaimSql(ticket: WebOcrProofTicket): string {
  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(ticket.ticketId) ||
    ticket.ticketId === "00000000-0000-0000-0000-000000000000" ||
    !Number.isSafeInteger(ticket.issuedAtMs) ||
    !Number.isSafeInteger(ticket.expiresAtMs) ||
    ticket.issuedAtMs < 0 ||
    ticket.expiresAtMs - ticket.issuedAtMs !== TTL_MS
  ) {
    throw new Error("Invalid synthetic Web OCR ticket fixture");
  }
  return `public.claim_web_ocr_ticket(
    p_ticket_id => '${ticket.ticketId}'::uuid,
    p_issued_at_ms => ${ticket.issuedAtMs}::bigint,
    p_expires_at_ms => ${ticket.expiresAtMs}::bigint
  )`;
}

export function assertWebOcrClaim(row: Row, expected: boolean | "lock_timeout"): void {
  if (
    Object.keys(row).sort().join(",") !== "caller_lock_timeout,claimed,elapsed_ms,sqlstate" ||
    typeof row.elapsed_ms !== "number" ||
    !Number.isFinite(row.elapsed_ms) ||
    row.elapsed_ms < 0 ||
    row.caller_lock_timeout !== "0"
  ) {
    throw new Error("Invalid Web OCR claim probe result");
  }
  if (expected === "lock_timeout") {
    if (
      row.claimed !== null ||
      row.sqlstate !== "55P03" ||
      row.elapsed_ms < 4_000 ||
      row.elapsed_ms > 7_500
    ) {
      throw new Error("Web OCR claim did not enforce its five-second lock timeout");
    }
  } else if (row.sqlstate !== "00000" || row.claimed !== expected) {
    throw new Error("Web OCR claim violated the expected authorization outcome");
  }
}

function jsonRows(output: string): Row[] {
  return output
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .map((line) => {
      const row: unknown = JSON.parse(line);
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("Invalid local PostgreSQL probe row");
      }
      return row as Row;
    });
}

function onlyRow(output: string): Row {
  const rows = jsonRows(output);
  if (rows.length !== 1) throw new Error("Expected exactly one local PostgreSQL probe row");
  return rows[0];
}

function positiveInteger(value: unknown): number {
  const number = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) {
    throw new Error("Invalid local PostgreSQL integer");
  }
  return number;
}

async function waitFor<T>(
  session: Session,
  inspect: () => T | undefined,
  timeoutMs = 9_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      session.child.stdout.off("data", onData);
      session.child.off("close", onClose);
    };
    const onData = () => {
      try {
        const value = inspect();
        if (value === undefined) return;
        cleanup();
        resolve(value);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Local Web OCR session exited before its barrier/result"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Local Web OCR session did not reach its barrier/result in time"));
    }, timeoutMs);
    session.child.stdout.on("data", onData);
    session.child.once("close", onClose);
    onData();
  });
}

function workerSql(ticket: WebOcrProofTicket, marker: string): string {
  return `
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '8s';
SET LOCAL lock_timeout = '0';
SET LOCAL idle_in_transaction_session_timeout = '20s';
SELECT pg_catalog.format('${marker}:%s', pg_catalog.pg_backend_pid());
DO $web_ocr_probe$
DECLARE
  started_at timestamptz := pg_catalog.clock_timestamp();
  claimed boolean;
  failure_state text := '00000';
BEGIN
  BEGIN
    claimed := ${webOcrClaimSql(ticket)};
  EXCEPTION WHEN query_canceled THEN
    GET STACKED DIAGNOSTICS failure_state = RETURNED_SQLSTATE;
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS failure_state = RETURNED_SQLSTATE;
  END;
  PERFORM pg_catalog.set_config('web_ocr_proof.result', pg_catalog.json_build_object(
    'claimed', claimed, 'sqlstate', failure_state,
    'elapsed_ms', extract(epoch FROM pg_catalog.clock_timestamp() - started_at) * 1000,
    'caller_lock_timeout', pg_catalog.current_setting('lock_timeout')
  )::text, true);
END;
$web_ocr_probe$;
SELECT pg_catalog.current_setting('web_ocr_proof.result');
`;
}

/** Direct PostgreSQL only; no application/provider client or real user identifiers. */
export async function runLocalWebOcrConcurrencyProof(target: string): Promise<void> {
  // Validate before transport configuration or any child process / database call.
  const databaseUrl = assertLoopbackPostgresUrl(target);
  configurePsqlTransport(databaseUrl);
  const fixture = buildWebOcrFixture();
  const ids = Object.values(fixture);
  const ownedWhere = `ticket_id = ANY(ARRAY[${ids.map((id) => `'${id}'::uuid`).join(",")}])`;
  const sessions = new Set<Session>();
  let ownsScope = false;
  let observedBarriers = 0;
  let proofError: unknown;
  let cleanupError: unknown;

  const startSession = () => {
    const session = startPsql(databaseUrl);
    sessions.add(session);
    void session.exit.then(() => sessions.delete(session));
    return session;
  };
  const runSql = async (sql: string): Promise<string> => {
    const session = startSession();
    session.child.stdin.end(`SET statement_timeout = '10s'; SET lock_timeout = '5s';\n${sql}`);
    return requireSuccessfulExit(session, "local Web OCR SQL", 12_000);
  };
  const rowSql = async (sql: string): Promise<Row> => onlyRow(await runSql(sql));
  const dbNow = async (): Promise<number> =>
    positiveInteger((await rowSql(`SELECT json_build_object('now', ${DB_NOW})::text;`)).now);
  const freshTicket = async (ticketId: string): Promise<WebOcrProofTicket> => {
    const issuedAtMs = (await dbNow()) - 1_000;
    return { ticketId, issuedAtMs, expiresAtMs: issuedAtMs + TTL_MS };
  };
  const result = (session: Session): Promise<Row> =>
    waitFor(session, () => {
      const rows = jsonRows(session.stdout());
      if (rows.length > 1) throw new Error("Web OCR worker returned extra result rows");
      return rows[0];
    });
  const startWorker = async (ticket: WebOcrProofTicket) => {
    const marker = `OCR_${randomUUID().replaceAll("-", "")}`;
    const session = startSession();
    session.child.stdin.write(workerSql(ticket, marker));
    const pid = await waitFor(session, () => {
      const line = session
        .stdout()
        .split(/\r?\n/gu)
        .find((line) => line.startsWith(`${marker}:`));
      return line ? positiveInteger(line.slice(marker.length + 1)) : undefined;
    });
    return { session, pid };
  };
  const finish = async (session: Session, commit: boolean) => {
    session.child.stdin.end(commit ? "COMMIT;\n" : "ROLLBACK;\n");
    await requireSuccessfulExit(session, "finish local Web OCR transaction");
  };
  const singleClaim = async (ticket: WebOcrProofTicket, expected: boolean) => {
    const worker = await startWorker(ticket);
    assertWebOcrClaim(await result(worker.session), expected);
    await finish(worker.session, true);
  };
  const assertStored = async (ticket: WebOcrProofTicket, expected: number) => {
    const row = await rowSql(`SELECT json_build_object('rows', count(*),
      'exact', coalesce(bool_and(issued_at_ms = ${ticket.issuedAtMs}::bigint
        AND expires_at_ms = ${ticket.expiresAtMs}::bigint), true))::text
      FROM private.web_ocr_ticket_claims WHERE ticket_id = '${ticket.ticketId}'::uuid;`);
    if (row.rows !== expected || row.exact !== true) {
      throw new Error("Web OCR proof stored unexpected ticket metadata");
    }
  };
  const blockedPair = async (ticket: WebOcrProofTicket) => {
    const first = await startWorker(ticket);
    assertWebOcrClaim(await result(first.session), true);
    const second = await startWorker(ticket);
    if (first.pid === second.pid) throw new Error("Web OCR proof requires separate connections");
    const deadline = Date.now() + 4_000;
    let blocked = false;
    while (Date.now() < deadline) {
      const row = await rowSql(`SELECT json_build_object(
        'blocked', ${first.pid} = ANY(pg_catalog.pg_blocking_pids(${second.pid})),
        'waiting', EXISTS (SELECT FROM pg_catalog.pg_locks WHERE pid = ${second.pid}
          AND locktype IN ('transactionid', 'tuple') AND NOT granted),
        'active', EXISTS (SELECT FROM pg_catalog.pg_stat_activity WHERE pid = ${second.pid}
          AND state = 'active' AND wait_event_type = 'Lock')
      )::text;`);
      if (row.blocked === true && row.waiting === true && row.active === true) {
        blocked = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    if (!blocked || jsonRows(second.session.stdout()).length !== 0) {
      throw new Error("Web OCR waiter did not remain blocked behind its uncommitted winner");
    }
    observedBarriers += 1;
    return { first: first.session, second: second.session };
  };
  const terminateSessions = async () => {
    const remaining = [...sessions];
    // Rollback first also reaches container-side psql when using docker exec.
    for (const session of remaining) {
      if (!session.child.stdin.destroyed && !session.child.stdin.writableEnded) {
        session.child.stdin.end("ROLLBACK;\n");
      }
    }
    await Promise.allSettled(
      remaining.map((session) => requireSuccessfulExit(session, "rollback Web OCR probe", 2_000)),
    );
    for (const session of remaining) {
      if (sessions.has(session) && !session.child.killed) session.child.kill("SIGTERM");
    }
    await Promise.allSettled(
      remaining.map((session) => requireSuccessfulExit(session, "stop Web OCR probe", 2_000)),
    );
  };

  try {
    const initial = await rowSql(`SELECT json_build_object('rows', count(*))::text
      FROM private.web_ocr_ticket_claims WHERE ${ownedWhere};`);
    if (initial.rows !== 0) throw new Error("Synthetic Web OCR scope is not empty");
    ownsScope = true;

    const commit = await freshTicket(fixture.commit);
    const committed = await blockedPair(commit);
    await finish(committed.first, true);
    assertWebOcrClaim(await result(committed.second), false);
    await finish(committed.second, true);
    await singleClaim(commit, false);
    await assertStored(commit, 1);

    const rollback = await freshTicket(fixture.rollback);
    const rolledBack = await blockedPair(rollback);
    await finish(rolledBack.first, false);
    assertWebOcrClaim(await result(rolledBack.second), true);
    await finish(rolledBack.second, true);
    await singleClaim(rollback, false);
    await assertStored(rollback, 1);

    const expiresAtMs = (await dbNow()) + 3_000;
    const expiry = { ticketId: fixture.expiry, issuedAtMs: expiresAtMs - TTL_MS, expiresAtMs };
    const expiring = await blockedPair(expiry);
    // DB clock is authoritative. The winner rolls back, allowing the waiter's
    // INSERT to succeed only after expiry: this exercises the post-INSERT gate.
    await runSql(`SELECT pg_catalog.pg_sleep(greatest(0,
      (${expiresAtMs}::bigint - ${DB_NOW})::double precision / 1000) + 0.05);`);
    if ((await dbNow()) < expiresAtMs) throw new Error("Expiry proof did not reach its deadline");
    await finish(expiring.first, false);
    assertWebOcrClaim(await result(expiring.second), false);
    await finish(expiring.second, true);
    // An inert expired tombstone is intentional; false never authorizes OCR.
    await assertStored(expiry, 1);
    await singleClaim(expiry, false);

    const timeout = await freshTicket(fixture.timeout);
    const timingOut = await blockedPair(timeout);
    assertWebOcrClaim(await result(timingOut.second), "lock_timeout");
    await finish(timingOut.second, true);
    await finish(timingOut.first, false);
    await assertStored(timeout, 0);
    await singleClaim(timeout, true);
    await assertStored(timeout, 1);

    const now = await dbNow();
    const expired = {
      ticketId: fixture.prune,
      issuedAtMs: now - TTL_MS - 1_000,
      expiresAtMs: now - 1_000,
    };
    const fresh = await freshTicket(fixture.fresh);
    await runSql(`INSERT INTO private.web_ocr_ticket_claims (ticket_id, issued_at_ms, expires_at_ms)
      VALUES ('${expired.ticketId}'::uuid, ${expired.issuedAtMs}::bigint, ${expired.expiresAtMs}::bigint);`);
    const pruned = await rowSql(`
BEGIN;
SET LOCAL ROLE service_role;
SELECT private.prune_web_ocr_ticket_claims();
SELECT json_build_object(
  'expired_absent', NOT EXISTS (SELECT FROM private.web_ocr_ticket_claims
    WHERE ticket_id = '${expired.ticketId}'::uuid),
  'old_claim', ${webOcrClaimSql(expired)},
  'fresh_claim', ${webOcrClaimSql(fresh)}
)::text;
ROLLBACK;`);
    if (
      pruned.expired_absent !== true ||
      pruned.old_claim !== false ||
      pruned.fresh_claim !== true
    ) {
      throw new Error("Pruning resurrected an expired ticket or prevented a fresh claim");
    }
    // The prune test rolls back every global deletion, preserving unrelated rows.
    await assertStored(expired, 1);
    await assertStored(fresh, 0);
    await singleClaim(fresh, true);
    await singleClaim(fresh, false);
    await assertStored(fresh, 1);
    if (observedBarriers !== 4) throw new Error("Missing Web OCR concurrency barrier evidence");
  } catch (error) {
    proofError = error;
  } finally {
    await terminateSessions();
    if (ownsScope) {
      try {
        const cleanup = await rowSql(`DELETE FROM private.web_ocr_ticket_claims WHERE ${ownedWhere};
          SELECT json_build_object('remaining', count(*))::text
          FROM private.web_ocr_ticket_claims WHERE ${ownedWhere};`);
        if (cleanup.remaining !== 0)
          cleanupError = new Error("Web OCR fixture cleanup left owned rows");
      } catch (error) {
        cleanupError = error;
      } finally {
        await terminateSessions();
      }
    }
  }
  if (cleanupError) throw cleanupError;
  if (proofError) throw proofError;
  console.log(
    "Local Web OCR concurrency proof: PASS (4 observed lock barriers; commit/rollback/expiry/timeout/prune/replay/fresh; cleanup verified; 0 provider calls)",
  );
}

async function main(): Promise<void> {
  if (process.argv.length > 2) throw new Error("Local Web OCR proof takes no arguments");
  await runLocalWebOcrConcurrencyProof(process.env.SUPABASE_DB_URL?.trim() ?? "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Driver errors, SQL payloads and connection credentials are never printed.
    console.error(
      "Local Web OCR concurrency proof: FAIL (local synthetic proof; no credentials logged)",
    );
    process.exitCode = 1;
  });
}
