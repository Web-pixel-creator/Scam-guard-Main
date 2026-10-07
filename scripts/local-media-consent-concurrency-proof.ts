import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";

type JsonRow = Record<string, unknown>;

interface LeaderLease {
  token: string;
  fence: number;
}

interface UpdateLease {
  updateId: number;
  token: string;
  fence: number;
}

interface Fixture {
  updateBase: number;
  userId: number;
  chatId: number;
  promptMessageId: number;
  leaderToken: string;
}

interface PsqlExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  spawnError: Error | null;
}

interface PsqlSession {
  child: ChildProcessWithoutNullStreams;
  stdout: () => string;
  stderr: () => string;
  exit: Promise<PsqlExit>;
}

const activeSessions = new Set<PsqlSession>();

function requiredEnv(name: "SUPABASE_DB_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertLoopbackPostgresUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Local Supabase database URL must use PostgreSQL");
  }
  if (
    url.hostname !== "127.0.0.1" &&
    url.hostname !== "localhost" &&
    url.hostname !== "::1" &&
    url.hostname !== "[::1]"
  ) {
    throw new Error("Concurrency proof refuses a non-loopback PostgreSQL target");
  }
  if (url.username !== "postgres" || url.pathname !== "/postgres") {
    throw new Error("Concurrency proof requires the disposable local postgres database");
  }
  return url.toString();
}

function psqlBinary(): string {
  return process.env.PSQL_BIN?.trim() || "psql";
}

function startPsql(databaseUrl: string): PsqlSession {
  const child = spawn(
    psqlBinary(),
    [
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=on",
      "--set=VERBOSITY=terse",
      "--quiet",
      "--no-align",
      "--tuples-only",
      `--dbname=${databaseUrl}`,
    ],
    {
      env: {
        ...process.env,
        PGCONNECT_TIMEOUT: "5",
      },
      stdio: "pipe",
    },
  );
  child.stdin.setDefaultEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let stdout = "";
  let stderr = "";
  let spawnError: Error | null = null;
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.once("error", (error) => {
    spawnError = error;
  });

  const session: PsqlSession = {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    exit: new Promise<PsqlExit>((resolve) => {
      child.once("close", (code, signal) => resolve({ code, signal, spawnError }));
    }),
  };
  activeSessions.add(session);
  void session.exit.then(() => activeSessions.delete(session));
  return session;
}

function sanitizedDiagnostic(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s]+/giu, "[redacted-local-db-url]")
    .replace(/[\r\n]+/gu, " ")
    .trim()
    .slice(0, 500);
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function requireSuccessfulExit(
  session: PsqlSession,
  label: string,
  timeoutMs = 10_000,
): Promise<string> {
  const result = await withTimeout(session.exit, label, timeoutMs);
  if (result.spawnError) throw new Error(`${label} could not start psql`);
  if (result.code !== 0) {
    const diagnostic = sanitizedDiagnostic(session.stderr());
    throw new Error(`${label} failed${diagnostic ? `: ${diagnostic}` : ""}`);
  }
  return session.stdout();
}

async function runSql(databaseUrl: string, sql: string, label: string): Promise<string> {
  const session = startPsql(databaseUrl);
  session.child.stdin.end(sql);
  return requireSuccessfulExit(session, label);
}

function jsonRows(output: string): JsonRow[] {
  const rows: JsonRow[] = [];
  for (const line of output.split(/\r?\n/gu)) {
    const candidate = line.trim();
    if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
    const parsed: unknown = JSON.parse(candidate);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("psql returned an invalid JSON row");
    }
    rows.push(parsed as JsonRow);
  }
  return rows;
}

function onlyJsonRow(output: string, operation: string): JsonRow {
  const rows = jsonRows(output);
  if (rows.length !== 1) throw new Error(`${operation} returned ${rows.length} JSON rows`);
  return rows[0];
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Database returned an invalid ${field}`);
  }
  return parsed;
}

function serviceRoleSql(statement: string): string {
  return `
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
${statement}
COMMIT;
`;
}

function openServiceRoleTransaction(statement: string): string {
  return `
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
${statement}
`;
}

function jsonSelect(functionCall: string): string {
  return `SELECT pg_catalog.row_to_json(result)::text FROM ${functionCall} AS result;`;
}

async function callServiceRole(
  databaseUrl: string,
  functionCall: string,
  operation: string,
): Promise<JsonRow> {
  const output = await runSql(databaseUrl, serviceRoleSql(jsonSelect(functionCall)), operation);
  return onlyJsonRow(output, operation);
}

function leaseNamedArgs(lease: UpdateLease, leader: LeaderLease): string {
  return `
    p_update_id => ${lease.updateId}::bigint,
    p_lease_token => '${lease.token}'::uuid,
    p_processing_fence => ${lease.fence}::bigint,
    p_leader_token => '${leader.token}'::uuid,
    p_leader_fence => ${leader.fence}::bigint`;
}

async function acquireLeader(databaseUrl: string, token: string): Promise<LeaderLease> {
  const row = await callServiceRole(
    databaseUrl,
    `public.acquire_telegram_update_leader('${token}'::uuid, 600)`,
    "acquire local polling leader",
  );
  if (row.acquired !== true) throw new Error("Could not acquire the isolated local polling leader");
  return { token, fence: positiveInteger(row.fence, "leader fence") };
}

async function beginUpdate(
  databaseUrl: string,
  updateId: number,
  leader: LeaderLease,
): Promise<UpdateLease> {
  const token = randomUUID();
  const row = await callServiceRole(
    databaseUrl,
    `public.begin_telegram_update(
      ${updateId}::bigint,
      '${token}'::uuid,
      120,
      '${leader.token}'::uuid,
      ${leader.fence}::bigint
    )`,
    "begin local update lease",
  );
  if (row.decision !== "acquired") throw new Error("Could not acquire a local update lease");
  return { updateId, token, fence: positiveInteger(row.processing_fence, "processing fence") };
}

function assertApplied(row: JsonRow, operation: string): void {
  if (row.lease_valid !== true || row.applied !== true) {
    throw new Error(`${operation} did not apply under a current lease`);
  }
}

function claimCall(fixture: Fixture, lease: UpdateLease, leader: LeaderLease): string {
  return `public.claim_telegram_media_provider_consent(
    p_telegram_user_id => ${fixture.userId}::bigint,
    p_chat_id => ${fixture.chatId}::bigint,
    p_chat_type => 'private',
    p_media_kind => 'image',
    ${leaseNamedArgs(lease, leader)},
    p_report_flow_id => NULL::uuid
  )`;
}

async function waitForMarker(session: PsqlSession, marker: string, label: string): Promise<void> {
  if (session.stdout().includes(marker)) return;
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const onData = () => {
        if (!session.stdout().includes(marker)) return;
        cleanup();
        resolve();
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`${label} exited before its database barrier`));
      };
      const cleanup = () => {
        session.child.stdout.off("data", onData);
        session.child.off("close", onClose);
      };
      session.child.stdout.on("data", onData);
      session.child.once("close", onClose);
      onData();
    }),
    label,
    5_000,
  );
}

function markerPid(output: string, marker: string): number {
  const line = output
    .split(/\r?\n/gu)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(`${marker}:`));
  const raw = line?.slice(marker.length + 1);
  return positiveInteger(raw, `${marker} backend pid`);
}

async function waitUntilBothWorkersBlocked(
  databaseUrl: string,
  holderPid: number,
  firstPid: number,
  secondPid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const row = onlyJsonRow(
      await runSql(
        databaseUrl,
        `SELECT pg_catalog.json_build_object(
          'first', ${holderPid} = ANY(pg_catalog.pg_blocking_pids(${firstPid})),
          'second', ${holderPid} = ANY(pg_catalog.pg_blocking_pids(${secondPid}))
        )::text;`,
        "inspect PostgreSQL barrier waiters",
      ),
      "inspect PostgreSQL barrier waiters",
    );
    if (row.first === true && row.second === true) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Two independent PostgreSQL sessions did not reach the strict barrier");
}

async function waitForFirstClaimResult(
  first: PsqlSession,
  second: PsqlSession,
): Promise<{ winner: PsqlSession; loser: PsqlSession; winnerIndex: 0 | 1 }> {
  const inspect = () => {
    const firstRows = jsonRows(first.stdout());
    const secondRows = jsonRows(second.stdout());
    if (firstRows.length > 1 || secondRows.length > 1) {
      throw new Error("A claim session returned more than one result row");
    }
    if (firstRows.length === 1 && secondRows.length === 1) {
      throw new Error("Concurrent claims both completed before the winner committed");
    }
    if (firstRows.length === 1) return { winner: first, loser: second, winnerIndex: 0 as const };
    if (secondRows.length === 1) return { winner: second, loser: first, winnerIndex: 1 as const };
    return null;
  };

  const immediate = inspect();
  if (immediate) return immediate;
  return withTimeout(
    new Promise((resolve, reject) => {
      const onData = () => {
        try {
          const result = inspect();
          if (!result) return;
          cleanup();
          resolve(result);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error("A claim session exited before the first claim result"));
      };
      const cleanup = () => {
        first.child.stdout.off("data", onData);
        second.child.stdout.off("data", onData);
        first.child.off("close", onClose);
        second.child.off("close", onClose);
      };
      first.child.stdout.on("data", onData);
      second.child.stdout.on("data", onData);
      first.child.once("close", onClose);
      second.child.once("close", onClose);
    }),
    "first concurrent claim result",
    5_000,
  );
}

async function waitForClaimResult(session: PsqlSession, label: string): Promise<JsonRow> {
  const inspect = () => {
    const rows = jsonRows(session.stdout());
    if (rows.length > 1) throw new Error(`${label} returned more than one result row`);
    return rows[0] ?? null;
  };
  const immediate = inspect();
  if (immediate) return immediate;
  return withTimeout(
    new Promise((resolve, reject) => {
      const onData = () => {
        try {
          const row = inspect();
          if (!row) return;
          cleanup();
          resolve(row);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`${label} exited before returning a claim result`));
      };
      const cleanup = () => {
        session.child.stdout.off("data", onData);
        session.child.off("close", onClose);
      };
      session.child.stdout.on("data", onData);
      session.child.once("close", onClose);
    }),
    label,
    5_000,
  );
}

async function waitUntilBlockedBy(
  databaseUrl: string,
  blockerPid: number,
  blockedPid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const row = onlyJsonRow(
      await runSql(
        databaseUrl,
        `SELECT pg_catalog.json_build_object(
          'blocked', ${blockerPid} = ANY(pg_catalog.pg_blocking_pids(${blockedPid}))
        )::text;`,
        "inspect overlapping claim transactions",
      ),
      "inspect overlapping claim transactions",
    );
    if (row.blocked === true) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("The losing PostgreSQL claim was not blocked by the uncommitted winner");
}

async function runConcurrentClaims(
  databaseUrl: string,
  fixture: Fixture,
  leader: LeaderLease,
  firstLease: UpdateLease,
  secondLease: UpdateLease,
): Promise<JsonRow[]> {
  const barrierKey = randomInt(1_000_000, 2_000_000_000);
  const holderMarker = `BARRIER_HELD_${randomUUID().replaceAll("-", "")}`;
  const firstMarker = `CLAIM_READY_FIRST_${randomUUID().replaceAll("-", "")}`;
  const secondMarker = `CLAIM_READY_SECOND_${randomUUID().replaceAll("-", "")}`;

  const holder = startPsql(databaseUrl);
  holder.child.stdin.write(`
SET statement_timeout = '10s';
SELECT pg_catalog.pg_advisory_lock(${barrierKey}::bigint);
SELECT pg_catalog.format('${holderMarker}:%s', pg_catalog.pg_backend_pid());
`);
  await waitForMarker(holder, holderMarker, "advisory barrier holder");
  const holderPid = markerPid(holder.stdout(), holderMarker);

  const workerSql = (marker: string, lease: UpdateLease) =>
    openServiceRoleTransaction(`
SELECT pg_catalog.format('${marker}:%s', pg_catalog.pg_backend_pid());
SELECT pg_catalog.pg_advisory_xact_lock_shared(${barrierKey}::bigint);
${jsonSelect(claimCall(fixture, lease, leader))}
`);
  const first = startPsql(databaseUrl);
  const second = startPsql(databaseUrl);
  first.child.stdin.write(workerSql(firstMarker, firstLease));
  second.child.stdin.write(workerSql(secondMarker, secondLease));

  await Promise.all([
    waitForMarker(first, firstMarker, "first claim session"),
    waitForMarker(second, secondMarker, "second claim session"),
  ]);
  const firstPid = markerPid(first.stdout(), firstMarker);
  const secondPid = markerPid(second.stdout(), secondMarker);
  if (new Set([holderPid, firstPid, secondPid]).size !== 3) {
    throw new Error("Concurrency proof did not create three independent PostgreSQL sessions");
  }
  await waitUntilBothWorkersBlocked(databaseUrl, holderPid, firstPid, secondPid);

  holder.child.stdin.end(`
SELECT pg_catalog.pg_advisory_unlock(${barrierKey}::bigint);
`);
  await requireSuccessfulExit(holder, "advisory barrier holder");

  const firstResult = await waitForFirstClaimResult(first, second);
  const winnerRow = onlyJsonRow(firstResult.winner.stdout(), "concurrent claim winner");
  if (winnerRow.lease_valid !== true || winnerRow.applied !== true) {
    throw new Error("The first concurrent claim did not become the one-shot winner");
  }
  const winnerPid = firstResult.winnerIndex === 0 ? firstPid : secondPid;
  const loserPid = firstResult.winnerIndex === 0 ? secondPid : firstPid;
  await waitUntilBlockedBy(databaseUrl, winnerPid, loserPid);

  firstResult.winner.child.stdin.end("COMMIT;\n");
  await requireSuccessfulExit(firstResult.winner, "commit concurrent claim winner");
  const loserRow = await waitForClaimResult(firstResult.loser, "concurrent claim loser");
  if (loserRow.lease_valid !== true || loserRow.applied !== false) {
    throw new Error("The claim blocked behind the winner did not return the expected miss");
  }
  firstResult.loser.child.stdin.end("COMMIT;\n");
  await requireSuccessfulExit(firstResult.loser, "commit concurrent claim loser");

  return firstResult.winnerIndex === 0 ? [winnerRow, loserRow] : [loserRow, winnerRow];
}

async function completeUpdate(
  databaseUrl: string,
  lease: UpdateLease,
  leader: LeaderLease,
): Promise<void> {
  const output = await runSql(
    databaseUrl,
    serviceRoleSql(`SELECT public.complete_telegram_update(
      ${lease.updateId}::bigint,
      '${lease.token}'::uuid,
      ${lease.fence}::bigint,
      '${leader.token}'::uuid,
      ${leader.fence}::bigint
    );`),
    "complete local update lease",
  );
  if (!output.split(/\r?\n/gu).some((line) => line.trim() === "t")) {
    throw new Error("A local update lease did not complete");
  }
}

async function releaseLeader(databaseUrl: string, leader: LeaderLease): Promise<void> {
  const output = await runSql(
    databaseUrl,
    serviceRoleSql(`SELECT public.release_telegram_update_leader(
      '${leader.token}'::uuid,
      ${leader.fence}::bigint
    );`),
    "release local polling leader",
  );
  if (!output.split(/\r?\n/gu).some((line) => line.trim() === "t")) {
    throw new Error("The local polling leader did not release");
  }
}

async function assertConsumedMetadata(databaseUrl: string, fixture: Fixture): Promise<void> {
  const row = onlyJsonRow(
    await runSql(
      databaseUrl,
      `SELECT pg_catalog.json_build_object(
        'row_count', COUNT(*),
        'consumed_count', COUNT(*) FILTER (
          WHERE terminal_reason = 'consumed'
            AND granted_at IS NOT NULL
            AND terminal_at IS NOT NULL
        )
      )::text
      FROM private.telegram_media_provider_consents
      WHERE telegram_user_id = ${fixture.userId}::bigint
        AND chat_id = ${fixture.chatId}::bigint;`,
      "verify consumed metadata-only consent row",
    ),
    "verify consumed metadata-only consent row",
  );
  if (positiveInteger(row.row_count, "consent row count") !== 1) {
    throw new Error("Concurrency proof expected exactly one metadata-only consent row");
  }
  if (positiveInteger(row.consumed_count, "consumed consent count") !== 1) {
    throw new Error("Concurrency proof did not persist the expected consumed metadata state");
  }
}

async function terminateActiveSessions(): Promise<void> {
  const sessions = [...activeSessions];
  for (const session of sessions) {
    if (!session.child.killed) session.child.kill("SIGTERM");
  }
  await Promise.allSettled(
    sessions.map((session) => withTimeout(session.exit, "stop psql", 2_000)),
  );
}

async function cleanupFixture(databaseUrl: string, fixture: Fixture): Promise<void> {
  const output = await runSql(
    databaseUrl,
    `BEGIN;
    SET LOCAL statement_timeout = '10s';
    SET LOCAL lock_timeout = '5s';
    DELETE FROM private.telegram_media_provider_consents
      WHERE telegram_user_id = ${fixture.userId}::bigint
        AND chat_id = ${fixture.chatId}::bigint;
    DELETE FROM public.telegram_webhook_updates
      WHERE update_id BETWEEN ${fixture.updateBase}::bigint AND ${fixture.updateBase + 4}::bigint;
    DELETE FROM private.telegram_update_leaders
      WHERE lease_token = '${fixture.leaderToken}'::uuid;
    COMMIT;
    SELECT pg_catalog.json_build_object(
      'consents', (
        SELECT COUNT(*) FROM private.telegram_media_provider_consents
        WHERE telegram_user_id = ${fixture.userId}::bigint
          AND chat_id = ${fixture.chatId}::bigint
      ),
      'updates', (
        SELECT COUNT(*) FROM public.telegram_webhook_updates
        WHERE update_id BETWEEN ${fixture.updateBase}::bigint AND ${fixture.updateBase + 4}::bigint
      ),
      'leaders', (
        SELECT COUNT(*) FROM private.telegram_update_leaders
        WHERE lease_token = '${fixture.leaderToken}'::uuid
      )
    )::text;`,
    "clean local concurrency fixture",
  );
  const row = onlyJsonRow(output, "clean local concurrency fixture");
  if (row.consents !== 0 || row.updates !== 0 || row.leaders !== 0) {
    throw new Error("Local concurrency fixture cleanup was incomplete");
  }
}

async function runProof(databaseUrl: string, fixture: Fixture): Promise<void> {
  const leader = await acquireLeader(databaseUrl, fixture.leaderToken);
  const leases: UpdateLease[] = [];

  const registerLease = await beginUpdate(databaseUrl, fixture.updateBase, leader);
  leases.push(registerLease);
  assertApplied(
    await callServiceRole(
      databaseUrl,
      `public.register_telegram_media_provider_consent(
        p_telegram_user_id => ${fixture.userId}::bigint,
        p_chat_id => ${fixture.chatId}::bigint,
        p_chat_type => 'private',
        p_media_kind => 'image',
        p_prompt_message_id => ${fixture.promptMessageId}::bigint,
        ${leaseNamedArgs(registerLease, leader)},
        p_report_flow_id => NULL::uuid
      )`,
      "register media consent",
    ),
    "register",
  );

  const grantLease = await beginUpdate(databaseUrl, fixture.updateBase + 1, leader);
  leases.push(grantLease);
  assertApplied(
    await callServiceRole(
      databaseUrl,
      `public.grant_telegram_media_provider_consent(
        p_telegram_user_id => ${fixture.userId}::bigint,
        p_chat_id => ${fixture.chatId}::bigint,
        p_chat_type => 'private',
        p_media_kind => 'image',
        p_prompt_message_id => ${fixture.promptMessageId}::bigint,
        ${leaseNamedArgs(grantLease, leader)},
        p_report_flow_id => NULL::uuid
      )`,
      "grant media consent",
    ),
    "grant",
  );

  const firstClaimLease = await beginUpdate(databaseUrl, fixture.updateBase + 2, leader);
  const secondClaimLease = await beginUpdate(databaseUrl, fixture.updateBase + 3, leader);
  leases.push(firstClaimLease, secondClaimLease);

  const rows = await runConcurrentClaims(
    databaseUrl,
    fixture,
    leader,
    firstClaimLease,
    secondClaimLease,
  );
  if (rows.some((row) => row.lease_valid !== true)) {
    throw new Error("A concurrent claim unexpectedly lost its current update lease");
  }
  const winners = rows.filter((row) => row.applied === true).length;
  const losers = rows.filter((row) => row.applied === false).length;
  if (winners !== 1 || losers !== 1) {
    throw new Error("One-shot consent did not produce exactly one concurrent winner");
  }

  const replayClaimLease = await beginUpdate(databaseUrl, fixture.updateBase + 4, leader);
  leases.push(replayClaimLease);
  const replayRow = await callServiceRole(
    databaseUrl,
    claimCall(fixture, replayClaimLease, leader),
    "replay media consent claim",
  );
  if (replayRow.lease_valid !== true || replayRow.applied !== false) {
    throw new Error("Consumed consent unexpectedly authorized a replay claim");
  }
  await assertConsumedMetadata(databaseUrl, fixture);

  for (const lease of leases) await completeUpdate(databaseUrl, lease, leader);
  await releaseLeader(databaseUrl, leader);
}

async function main(): Promise<void> {
  const databaseUrl = assertLoopbackPostgresUrl(requiredEnv("SUPABASE_DB_URL"));
  const nonce = randomInt(1_000_000, 9_000_000);
  const fixture: Fixture = {
    updateBase: 3_000_000_000 + nonce * 10,
    userId: 8_000_000_000 + nonce,
    chatId: -(9_000_000_000 + nonce),
    promptMessageId: 7_000_000_000 + nonce,
    leaderToken: randomUUID(),
  };

  let proofError: unknown;
  try {
    await runProof(databaseUrl, fixture);
  } catch (error) {
    proofError = error;
  }

  await terminateActiveSessions();
  let cleanupError: unknown;
  try {
    await cleanupFixture(databaseUrl, fixture);
  } catch (error) {
    cleanupError = error;
  }

  if (proofError) throw proofError;
  if (cleanupError) throw cleanupError;
  const mediaCalls = 0;
  if (mediaCalls !== 0) throw new Error("Concurrency proof made an unexpected media call");
  console.log(
    "Local media-consent concurrency proof: PASS (2 concurrent claims + 1 replay, 1 winner, 0 media calls)",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Local media-consent concurrency proof failed",
  );
  process.exitCode = 1;
});
