import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

const childProcess = vi.hoisted(() => ({ spawn: vi.fn(), execFileSync: vi.fn() }));
vi.mock("node:child_process", () => childProcess);

import {
  assertLoopbackPostgresUrl,
  requireSuccessfulExit,
  startPsql,
} from "../../../scripts/local-media-consent-concurrency-proof";

function fakeChild() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("media proof local transport safety", () => {
  it("imports without starting a subprocess or inspecting Docker", () => {
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
  });

  it.each([
    "postgres://postgres:synthetic@127.0.0.1:54342/postgres",
    "postgresql://postgres:synthetic@localhost:54342/postgres",
    "postgres://postgres:synthetic@[::1]:54342/postgres",
  ])("accepts only canonical bounded loopback targets (%s)", (value) => {
    expect(["127.0.0.1", "[::1]"]).toContain(new URL(assertLoopbackPostgresUrl(value)).hostname);
  });

  it.each([
    "",
    "invalid",
    "https://127.0.0.1/postgres",
    "postgres://postgres:synthetic@db.example.invalid/postgres",
    "postgres://postgres:synthetic@localhost.evil.invalid/postgres",
    "postgres://postgres:synthetic@127.0.0.2/postgres",
    "postgres://postgres:synthetic@127.0.0.1/production",
    "postgres://service_role:synthetic@127.0.0.1/postgres",
    "postgres://postgres:synthetic@127.0.0.1/postgres?host=db.example.invalid",
    "postgres://postgres:synthetic@127.0.0.1/postgres?hostaddr=192.0.2.10",
    "postgres://postgres:synthetic@127.0.0.1/postgres?service=remote",
    "postgres://postgres:synthetic@127.0.0.1/postgres?options=-csearch_path%3Dpublic",
    "postgres://postgres:synthetic@127.0.0.1/postgres#fragment",
  ])("refuses override/invalid targets before any subprocess (%s)", (value) => {
    expect(() => assertLoopbackPostgresUrl(value)).toThrow();
    expect(() => startPsql(value)).toThrow();
    expect(childProcess.spawn).not.toHaveBeenCalled();
  });

  it("keeps decoded password out of argv and strips all inherited libpq options", async () => {
    vi.stubEnv("PSQL_BIN", "");
    vi.stubEnv("PGHOSTADDR", "192.0.2.10");
    vi.stubEnv("PGSERVICE", "remote");
    vi.stubEnv("PGSERVICEFILE", "synthetic-service-file");
    vi.stubEnv("PGOPTIONS", "-csearch_path=untrusted");
    vi.stubEnv("PGPASSWORD", "inherited-synthetic-secret");
    vi.stubEnv("PGPASSFILE", "synthetic-password-file");
    const child = fakeChild();
    childProcess.spawn.mockReturnValue(child);
    const session = startPsql(
      assertLoopbackPostgresUrl(
        "postgres://postgres:synthetic%40password@localhost:54342/postgres",
      ),
    );
    child.emit("close", 0, null);
    await requireSuccessfulExit(session, "synthetic connection");
    const [binary, args, options] = childProcess.spawn.mock.calls[0];
    expect(binary).toBe("psql");
    expect(args).toContain("--dbname=postgres://postgres@127.0.0.1:54342/postgres");
    expect(JSON.stringify(args)).not.toContain("password");
    expect(
      Object.keys(options.env)
        .filter((key) => key.toUpperCase().startsWith("PG"))
        .sort(),
    ).toEqual(["PGCONNECT_TIMEOUT", "PGPASSWORD"]);
    expect(options.env.PGPASSWORD).toBe("synthetic@password");
    expect(options.env.PGCONNECT_TIMEOUT).toBe("5");
    expect(options.env.PATH ?? options.env.Path).toBeDefined();
  });

  it("never includes unstructured psql stderr in a propagated error", async () => {
    const child = fakeChild();
    childProcess.spawn.mockReturnValue(child);
    const session = startPsql("postgres://postgres:synthetic@127.0.0.1:54342/postgres");
    child.stderr.write("password=synthetic-secret; private database diagnostic");
    child.emit("close", 2, null);
    await expect(requireSuccessfulExit(session, "synthetic connection")).rejects.toThrow(
      /^synthetic connection failed$/u,
    );
  });
});
