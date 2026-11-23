import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type JsonRow = Record<string, unknown>;
export interface HashCandidate {
  hash: string;
  version: string;
}
export interface AppealInput {
  targetHashes: HashCandidate[];
  targetDisplay: string;
  reason: string;
  contactHashes: HashCandidate[];
  contactDisplay: string | null;
}
interface Session {
  child: ChildProcessWithoutNullStreams;
  stdout: () => string;
  exit: Promise<{ code: number | null; spawnFailed: boolean }>;
}
interface Fixture {
  marker: string;
  hashes: string[];
  adminInput: AppealInput;
  cases: {
    name: string;
    first: AppealInput;
    second: AppealInput;
    rollbackFirst: boolean;
    rows: number;
  }[];
}

const sessions = new Set<Session>();
let dockerContainer: string | undefined;

/** No query parameters: libpq host/service/options parameters can override URL authority. */
export function assertLoopbackPostgresUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Appeal proof requires a valid local PostgreSQL URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Appeal proof requires PostgreSQL");
  }
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    throw new Error("Appeal proof refuses a non-loopback PostgreSQL target");
  }
  if (url.username !== "postgres" || url.pathname !== "/postgres") {
    throw new Error("Appeal proof requires the disposable local postgres database");
  }
  if (url.search || url.hash) throw new Error("Appeal proof refuses URL target overrides");
  if (url.hostname === "localhost") url.hostname = "127.0.0.1";
  return url.toString();
}

function configureTransport(databaseUrl: string): void {
  const container = process.env.PSQL_DOCKER_CONTAINER?.trim();
  if (!container) return;
  if (!/^supabase_db_[a-z0-9][a-z0-9_-]{0,80}$/u.test(container)) {
    throw new Error("Appeal proof requires a named local Supabase database container");
  }
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
    throw new Error("Appeal proof refuses Docker environment target overrides");
  }
  const inspect = (args: string[]): unknown =>
    JSON.parse(execFileSync("docker", args, { encoding: "utf8", timeout: 5_000 }));
  const contexts = inspect(["context", "inspect"]) as {
    Endpoints?: { docker?: { Host?: string } };
  }[];
  const endpoint = contexts[0]?.Endpoints?.docker?.Host ?? "";
  if (!endpoint.startsWith("npipe:////./pipe/") && !endpoint.startsWith("unix:///")) {
    throw new Error("Appeal proof refuses a non-local Docker endpoint");
  }
  const containers = inspect(["inspect", container]) as {
    Name?: string;
    Config?: { Labels?: Record<string, string> };
    NetworkSettings?: { Ports?: Record<string, { HostPort?: string }[] | null> };
  }[];
  const target = containers[0];
  const project = container.slice("supabase_db_".length);
  const port = new URL(databaseUrl).port || "5432";
  if (
    target?.Name !== `/${container}` ||
    target.Config?.Labels?.["com.supabase.cli.project"] !== project ||
    !target.NetworkSettings?.Ports?.["5432/tcp"]?.some((binding) => binding.HostPort === port)
  ) {
    throw new Error("Appeal proof Docker target does not match the local database port");
  }
  dockerContainer = container;
}

async function bounded<T>(promise: Promise<T>, label: string, timeoutMs = 10_000): Promise<T> {
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

function startSession(databaseUrl: string): Session {
  const url = new URL(databaseUrl);
  const password = decodeURIComponent(url.password);
  url.password = "";
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("PG")),
  );
  const args = [
    "--no-psqlrc",
    "--set=ON_ERROR_STOP=on",
    "--set=VERBOSITY=terse",
    "--quiet",
    "--no-align",
    "--tuples-only",
    ...(dockerContainer
      ? ["--username=postgres", "--dbname=postgres"]
      : [`--dbname=${url.toString()}`]),
  ];
  const child = spawn(
    dockerContainer ? "docker" : process.env.PSQL_BIN?.trim() || "psql",
    dockerContainer ? ["exec", "-i", dockerContainer, "psql", ...args] : args,
    { env: { ...env, PGPASSWORD: password, PGCONNECT_TIMEOUT: "5" }, stdio: "pipe" },
  );
  child.stdin.setDefaultEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.resume(); // Database diagnostics can contain values: never emit them.
  let output = "";
  let spawnFailed = false;
  child.stdout.on("data", (chunk: string) => (output += chunk));
  child.once("error", () => (spawnFailed = true));
  const session: Session = {
    child,
    stdout: () => output,
    exit: new Promise((done) => child.once("close", (code) => done({ code, spawnFailed }))),
  };
  sessions.add(session);
  void session.exit.then(() => sessions.delete(session));
  return session;
}

async function requireExit(session: Session, label: string): Promise<string> {
  const result = await bounded(session.exit, label);
  if (result.spawnFailed || result.code !== 0) throw new Error(`${label} failed`);
  return session.stdout();
}

async function runSql(databaseUrl: string, sql: string, label: string): Promise<string> {
  const session = startSession(databaseUrl);
  session.child.stdin.end(`SET statement_timeout = '10s';\n${sql}\n`);
  return requireExit(session, label);
}

function jsonRows(output: string): JsonRow[] {
  return output
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .map((line) => {
      const row: unknown = JSON.parse(line);
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("Appeal proof received an invalid database row");
      }
      return row as JsonRow;
    });
}

function onlyRow(output: string): JsonRow {
  const rows = jsonRows(output);
  if (rows.length !== 1) throw new Error("Appeal proof expected exactly one database row");
  return rows[0];
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function appealCall(input: AppealInput): string {
  return `SELECT pg_catalog.row_to_json(result)::text
FROM public.submit_reputation_appeal(
  p_target_type => 'telegram'::public.input_type,
  p_target_hashes => ${literal(JSON.stringify(input.targetHashes))}::jsonb,
  p_target_display => ${literal(input.targetDisplay)},
  p_reason => ${literal(input.reason)},
  p_contact_hashes => ${literal(JSON.stringify(input.contactHashes))}::jsonb,
  p_contact_display => ${input.contactDisplay === null ? "NULL::text" : literal(input.contactDisplay)}
) AS result;`;
}

function transactionSql(marker: string, input: AppealInput): string {
  return `BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '20s';
SELECT pg_catalog.format('${marker}:%s', pg_catalog.pg_backend_pid());
${appealCall(input)}\n`;
}

async function waitFor<T>(session: Session, inspect: () => T | null, label: string): Promise<T> {
  const current = inspect();
  if (current !== null) return current;
  let cleanup = () => {};
  try {
    return await bounded(
      new Promise<T>((done, reject) => {
        const onData = () => {
          try {
            const result = inspect();
            if (result !== null) done(result);
          } catch (error) {
            reject(error);
          }
        };
        const onClose = () => reject(new Error(`${label} exited before its database barrier`));
        cleanup = () => {
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
  } finally {
    cleanup();
  }
}

async function markerPid(session: Session, marker: string): Promise<number> {
  return waitFor(
    session,
    () => {
      const line = session
        .stdout()
        .split(/\r?\n/gu)
        .find((value) => value.startsWith(`${marker}:`));
      if (!line) return null;
      const pid = Number(line.slice(marker.length + 1));
      if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Invalid local backend PID");
      return pid;
    },
    "appeal session startup",
  );
}

async function resultRow(session: Session): Promise<JsonRow> {
  return waitFor(
    session,
    () => {
      const rows = jsonRows(session.stdout());
      if (rows.length > 1) throw new Error("Appeal proof received multiple RPC rows");
      return rows[0] ?? null;
    },
    "appeal submission",
  );
}

/** Polling only observes a real DB barrier; a sleep is never proof of overlap. */
async function waitUntilAdvisoryBlocked(
  databaseUrl: string,
  blockerPid: number,
  blockedPid: number,
  rowLock = false,
): Promise<void> {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const row = onlyRow(
      await runSql(
        databaseUrl,
        `SELECT pg_catalog.json_build_object(
          'blocked', ${blockerPid} = ANY(pg_catalog.pg_blocking_pids(${blockedPid})),
          'advisory_wait', EXISTS (
            SELECT 1 FROM pg_catalog.pg_locks
            WHERE pid = ${blockedPid}
              AND ${rowLock ? "locktype IN ('transactionid', 'tuple')" : "locktype = 'advisory'"}
              AND NOT granted
          ),
          'active_wait', EXISTS (
            SELECT 1 FROM pg_catalog.pg_stat_activity
            WHERE pid = ${blockedPid} AND state = 'active' AND wait_event_type = 'Lock'
          )
        )::text;`,
        "inspect appeal advisory barrier",
      ),
    );
    if (row.blocked === true && row.advisory_wait === true && row.active_wait === true) return;
    await new Promise<void>((done) => setTimeout(done, 25));
  }
  throw new Error("Appeal sessions did not reach the observed database-lock barrier");
}

export function assertReceipt(row: JsonRow, notify: boolean): void {
  if (
    Object.keys(row).sort().join(",") !== "accepted,notify_moderation" ||
    row.accepted !== true ||
    row.notify_moderation !== notify
  ) {
    throw new Error("Appeal receipt violated accepted/notification contract");
  }
}

export function buildFixture(nonce: string = randomUUID()): Fixture {
  const marker = `local-appeal-proof:${nonce}`;
  const allHashes = new Set<string>();
  const hash = (scope: string, version: string): HashCandidate => ({
    hash: createHash("sha256").update(`${marker}:${scope}:${version}`).digest("hex"),
    version,
  });
  const input = (scope: string): AppealInput => {
    const targetHashes = ["v3", "v2", "legacy"].map((version) => hash(scope, version));
    targetHashes.forEach((candidate) => allHashes.add(candidate.hash));
    return {
      targetHashes,
      targetDisplay: marker,
      reason: `${marker} Synthetic evidence A for ${scope}.`,
      contactHashes: [],
      contactDisplay: null,
    };
  };
  const same = input("same");
  const reason = input("reason");
  const contact = input("contact");
  const rotation = input("rotation");
  rotation.contactHashes = ["v3", "v2", "legacy"].map((version) =>
    hash("contact-rotation", version),
  );
  rotation.contactDisplay = "synthetic masked contact";
  const reordered = input("reordered");
  const rollback = input("rollback");
  const adminInput = input("admin");
  return {
    marker,
    hashes: [...allHashes],
    adminInput,
    cases: [
      { name: "exact duplicate", first: same, second: same, rollbackFirst: false, rows: 1 },
      {
        name: "distinct reason",
        first: reason,
        second: { ...reason, reason: `${marker} Synthetic evidence B for reason.` },
        rollbackFirst: false,
        rows: 2,
      },
      {
        name: "distinct contact",
        first: contact,
        second: {
          ...contact,
          contactHashes: [hash("contact-distinct", "v3")],
          contactDisplay: "another synthetic masked contact",
        },
        rollbackFirst: false,
        rows: 2,
      },
      {
        // Old-first -> new-reader is supported. A stale writer lacking a newly
        // stored alias cannot be supported without an alias map; do not claim it.
        name: "forward rotation",
        first: {
          ...rotation,
          targetHashes: rotation.targetHashes.slice(1),
          contactHashes: rotation.contactHashes.slice(1),
        },
        second: rotation,
        rollbackFirst: false,
        rows: 1,
      },
      {
        name: "same aliases reordered",
        first: reordered,
        second: { ...reordered, targetHashes: [...reordered.targetHashes].reverse() },
        rollbackFirst: false,
        rows: 1,
      },
      { name: "writer rollback", first: rollback, second: rollback, rollbackFirst: true, rows: 1 },
    ],
  };
}

function ownedWhere(fixture: Fixture): string {
  return `target_hash = ANY(ARRAY[${fixture.hashes.map(literal).join(",")}]::text[])
    AND target_type = 'telegram'::public.input_type
    AND target_display = ${literal(fixture.marker)}`;
}

async function readCaseRows(databaseUrl: string, input: AppealInput): Promise<JsonRow[]> {
  const result = await runSql(
    databaseUrl,
    `SELECT pg_catalog.row_to_json(r)::text FROM (
      SELECT reason, contact_hash, contact_hash_version, target_hash, target_hash_version, status
      FROM public.reputation_appeals
      WHERE target_hash = ANY(ARRAY[${input.targetHashes.map((h) => literal(h.hash)).join(",")}]::text[])
        AND target_type = 'telegram'::public.input_type
        AND target_display = ${literal(input.targetDisplay)}
      ORDER BY created_at, id
    ) r;`,
    "read synthetic appeal evidence",
  );
  return jsonRows(result);
}

async function runCase(databaseUrl: string, scenario: Fixture["cases"][number]): Promise<void> {
  const first = startSession(databaseUrl);
  const firstMarker = `FIRST_${randomUUID().replaceAll("-", "")}`;
  first.child.stdin.write(transactionSql(firstMarker, scenario.first));
  const firstPid = await markerPid(first, firstMarker);
  assertReceipt(await resultRow(first), true);

  const second = startSession(databaseUrl);
  const secondMarker = `SECOND_${randomUUID().replaceAll("-", "")}`;
  second.child.stdin.write(transactionSql(secondMarker, scenario.second));
  const secondPid = await markerPid(second, secondMarker);
  if (firstPid === secondPid)
    throw new Error("Appeal proof requires independent PostgreSQL sessions");
  await waitUntilAdvisoryBlocked(databaseUrl, firstPid, secondPid);
  if (jsonRows(second.stdout()).length !== 0) {
    throw new Error("Second appeal completed before the uncommitted writer released its lock");
  }
  first.child.stdin.end(scenario.rollbackFirst ? "ROLLBACK;\n" : "COMMIT;\n");
  await requireExit(first, "first appeal transaction");
  assertReceipt(await resultRow(second), scenario.rollbackFirst);
  second.child.stdin.end("COMMIT;\n");
  await requireExit(second, "second appeal transaction");

  const stored = await readCaseRows(databaseUrl, scenario.second);
  if (stored.length !== scenario.rows || stored.some((row) => row.status !== "new")) {
    throw new Error("Committed appeal count/status did not match the concurrency contract");
  }
  const expected = scenario.rollbackFirst
    ? [scenario.second]
    : scenario.rows === 1
      ? [scenario.first]
      : [scenario.first, scenario.second];
  for (const evidence of expected) {
    if (
      !stored.some(
        (row) =>
          row.reason === evidence.reason &&
          row.contact_hash === (evidence.contactHashes[0]?.hash ?? null) &&
          row.contact_hash_version === (evidence.contactHashes[0]?.version ?? null),
      )
    ) {
      throw new Error("Distinct committed evidence/contact was overwritten or lost");
    }
  }
  const replay = onlyRow(
    await runSql(
      databaseUrl,
      `${transactionSql("REPLAY", scenario.second)}COMMIT;`,
      "replay committed appeal",
    ),
  );
  assertReceipt(replay, false);
  const afterReplay = await readCaseRows(databaseUrl, scenario.second);
  if (JSON.stringify(afterReplay) !== JSON.stringify(stored)) {
    throw new Error("An exact replay changed committed evidence");
  }
  // In rollback cases the rolled-back receipt is not counted as a committed
  // notification eligibility. This proof sends no moderation notification.
  console.log(
    `Appeal ${scenario.name}: PASS (${scenario.rows} rows; 1 committed notice eligibility)`,
  );
}

/** Real UPDATE models the admin's existing service-role status write, not a mock. */
function adminResolveSql(marker: string, input: AppealInput): string {
  return `BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '20s';
SELECT pg_catalog.format('${marker}:%s', pg_catalog.pg_backend_pid());
WITH changed AS (
  UPDATE public.reputation_appeals SET status = 'resolved', updated_at = now()
  WHERE target_hash = ANY(ARRAY[${input.targetHashes.map((h) => literal(h.hash)).join(",")}]::text[])
    AND target_type = 'telegram'::public.input_type
    AND target_display = ${literal(input.targetDisplay)}
    AND status IN ('new', 'reviewing')
  RETURNING id
)
SELECT pg_catalog.json_build_object('updated', count(*))::text FROM changed;\n`;
}

async function committedSubmission(databaseUrl: string, input: AppealInput): Promise<JsonRow> {
  return onlyRow(
    await runSql(databaseUrl, `${transactionSql("SINGLE", input)}COMMIT;`, "committed appeal"),
  );
}

async function runAdminRace(databaseUrl: string, input: AppealInput): Promise<void> {
  assertReceipt(await committedSubmission(databaseUrl, input), true);
  // Duplicate reads/locks the open row before admin resolution starts.
  const submit = startSession(databaseUrl);
  submit.child.stdin.write(transactionSql("SUBMIT_HOLDS_ROW", input));
  const submitPid = await markerPid(submit, "SUBMIT_HOLDS_ROW");
  assertReceipt(await resultRow(submit), false);
  const admin = startSession(databaseUrl);
  admin.child.stdin.write(adminResolveSql("ADMIN_WAITS", input));
  const adminPid = await markerPid(admin, "ADMIN_WAITS");
  if (submitPid === adminPid)
    throw new Error("Admin race requires independent PostgreSQL sessions");
  await waitUntilAdvisoryBlocked(databaseUrl, submitPid, adminPid, true);
  if (jsonRows(admin.stdout()).length !== 0) throw new Error("Admin bypassed the appeal row lock");
  submit.child.stdin.end("COMMIT;\n");
  await requireExit(submit, "row-locking duplicate transaction");
  if ((await resultRow(admin)).updated !== 1)
    throw new Error("Admin did not resolve exactly one row");
  admin.child.stdin.end("COMMIT;\n");
  await requireExit(admin, "waiting admin transaction");
  let stored = await readCaseRows(databaseUrl, input);
  if (stored.length !== 1 || stored[0].status !== "resolved") {
    throw new Error("Duplicate before resolution did not preserve exactly one resolved row");
  }
  // Resolution committed before the next appeal: one new open episode is legitimate.
  assertReceipt(await committedSubmission(databaseUrl, input), true);
  stored = await readCaseRows(databaseUrl, input);
  if (stored.length !== 2 || stored.filter((row) => row.status === "new").length !== 1) {
    throw new Error("Closed-episode resubmission did not preserve historical evidence");
  }
  // Reverse overlap: admin holds the UPDATE lock before submit reads the open row.
  const adminFirst = startSession(databaseUrl);
  adminFirst.child.stdin.write(adminResolveSql("ADMIN_HOLDS_ROW", input));
  const adminFirstPid = await markerPid(adminFirst, "ADMIN_HOLDS_ROW");
  if ((await resultRow(adminFirst)).updated !== 1)
    throw new Error("Admin-first fixture did not update");
  const submitSecond = startSession(databaseUrl);
  submitSecond.child.stdin.write(transactionSql("SUBMIT_WAITS", input));
  const submitSecondPid = await markerPid(submitSecond, "SUBMIT_WAITS");
  if (adminFirstPid === submitSecondPid) throw new Error("Reverse admin race reused a session");
  await waitUntilAdvisoryBlocked(databaseUrl, adminFirstPid, submitSecondPid, true);
  if (jsonRows(submitSecond.stdout()).length !== 0) {
    throw new Error("Submission bypassed the uncommitted admin resolution");
  }
  adminFirst.child.stdin.end("COMMIT;\n");
  await requireExit(adminFirst, "admin-first resolution");
  assertReceipt(await resultRow(submitSecond), true);
  submitSecond.child.stdin.end("COMMIT;\n");
  await requireExit(submitSecond, "submission after admin resolution");
  stored = await readCaseRows(databaseUrl, input);
  if (
    stored.length !== 3 ||
    stored.filter((row) => row.status === "resolved").length !== 2 ||
    stored.filter((row) => row.status === "new").length !== 1
  ) {
    throw new Error("Admin-first overlap lost evidence or failed to reopen the closed episode");
  }
  assertReceipt(await committedSubmission(databaseUrl, input), false);
  if (JSON.stringify(await readCaseRows(databaseUrl, input)) !== JSON.stringify(stored)) {
    throw new Error("Post-admin duplicate replay changed evidence");
  }
  console.log("Appeal admin resolution: PASS (both row-lock orders; closed episode can reopen)");
}

async function terminateSessions(): Promise<void> {
  await Promise.all(
    [...sessions].map(async (session) => {
      if (!session.child.stdin.writableEnded && !session.child.stdin.destroyed) {
        session.child.stdin.end("ROLLBACK;\n");
      }
      try {
        await bounded(session.exit, "appeal proof session shutdown", 6_000);
      } catch {
        session.child.kill();
        await bounded(session.exit, "appeal proof killed session shutdown", 5_000);
      }
    }),
  );
}

export async function main(): Promise<void> {
  if (process.argv.slice(2).length !== 0) throw new Error("Appeal proof accepts no arguments");
  const databaseUrl = assertLoopbackPostgresUrl(process.env.SUPABASE_DB_URL?.trim() ?? "");
  configureTransport(databaseUrl);
  const fixture = buildFixture();
  let failure: unknown;
  let cleanupFailed = false;
  let ownsScope = false;
  try {
    const initial = onlyRow(
      await runSql(
        databaseUrl,
        `SELECT pg_catalog.json_build_object('rows', count(*))::text
         FROM public.reputation_appeals
         WHERE target_hash = ANY(ARRAY[${fixture.hashes.map(literal).join(",")}]::text[]);`,
        "prove fresh local appeal scope",
      ),
    );
    if (initial.rows !== 0) throw new Error("Synthetic appeal hashes are already in use");
    ownsScope = true;
    for (const scenario of fixture.cases) await runCase(databaseUrl, scenario);
    await runAdminRace(databaseUrl, fixture.adminInput);
  } catch (error) {
    failure = error;
  } finally {
    try {
      await terminateSessions();
    } catch {
      cleanupFailed = true;
    }
    try {
      if (ownsScope) {
        const cleanup = onlyRow(
          await runSql(
            databaseUrl,
            `BEGIN;
           SET LOCAL lock_timeout = '5s';
           DELETE FROM public.reputation_appeals WHERE ${ownedWhere(fixture)};
           COMMIT;
           SELECT pg_catalog.json_build_object('remaining', count(*))::text
           FROM public.reputation_appeals WHERE ${ownedWhere(fixture)};`,
            "cleanup owned synthetic appeal rows",
          ),
        );
        if (cleanup.remaining !== 0) cleanupFailed = true;
      }
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) {
    throw new Error("Appeal proof failed to verify cleanup; inspect owned synthetic rows locally");
  }
  if (failure) throw failure;
  console.log(
    "Local appeal concurrency proof: PASS (8 observed lock barriers; duplicate/distinct/rotation/rollback/admin/replay; cleanup verified)",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    // Intentionally generic: child/driver diagnostics may contain a connection URL.
    console.error(
      "Local appeal concurrency proof: FAIL (inspect local synthetic proof; no credentials logged)",
    );
    process.exitCode = 1;
  });
}
