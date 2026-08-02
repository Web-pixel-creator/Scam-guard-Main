// Unit/integration tests for the Telegram session store (`session.server.ts`).
//
// Task 4.2 — exercises the effectful layer (Supabase access) with a mocked
// service-role client. The real `supabaseAdmin` is replaced via `vi.mock`, so no
// network/DB is touched: we control exactly what `select().eq().maybeSingle()`
// and `upsert()` return, and we capture the arguments passed to them.
//
// Validates: Requirements 1.4, 2.3, 15.2
import { describe, it, expect, beforeEach, vi } from "vitest";

// Controllable mock state shared between the `vi.mock` factory and the tests.
// `vi.mock` is hoisted above imports, so the state must be created with
// `vi.hoisted` to be initialised before the factory runs.
const mockState = vi.hoisted(() => ({
  // Result returned by `select(...).eq(...).maybeSingle()`.
  maybeSingleResult: { data: null as unknown, error: null as unknown },
  // Result returned by `upsert(...)`.
  upsertResult: { error: null as unknown },
  rpcResult: { data: null as unknown, error: null as unknown },
  // Captured calls for assertions.
  calls: {
    from: [] as unknown[][],
    select: [] as unknown[][],
    eq: [] as unknown[][],
    maybeSingle: 0,
    upsert: [] as unknown[][],
    rpc: [] as unknown[][],
  },
}));

// Replace the service-role client. The session module only ever reaches the DB
// through `supabaseAdmin.from(TABLE)`, so a single chainable builder is enough.
vi.mock("@/integrations/supabase/client.server", () => {
  const builder = {
    select: (...args: unknown[]) => {
      mockState.calls.select.push(args);
      return builder;
    },
    eq: (...args: unknown[]) => {
      mockState.calls.eq.push(args);
      return builder;
    },
    maybeSingle: async () => {
      mockState.calls.maybeSingle += 1;
      return mockState.maybeSingleResult;
    },
    upsert: async (...args: unknown[]) => {
      mockState.calls.upsert.push(args);
      return mockState.upsertResult;
    },
  };
  const supabaseAdmin = {
    from: (...args: unknown[]) => {
      mockState.calls.from.push(args);
      return builder;
    },
    rpc: async (...args: unknown[]) => {
      mockState.calls.rpc.push(args);
      return mockState.rpcResult;
    },
  };
  return { supabaseAdmin };
});

import {
  loadSession,
  saveSession,
  setLanguage,
  resetScenario,
  TelegramSessionLoadError,
} from "./session.server";
import {
  rememberTelegramSessionLanguage,
  runWithTelegramUpdateExecution,
} from "./update-execution.server";

const fencedLease = {
  updateId: 200,
  leaseToken: "00000000-0000-4000-8000-000000000200",
  processingFence: 3,
  leaseExpiresAt: "2099-01-01T00:00:00.000Z",
};

beforeEach(() => {
  // Reset to neutral "success / no row" defaults before every test.
  mockState.maybeSingleResult = { data: null, error: null };
  mockState.upsertResult = { error: null };
  mockState.rpcResult = { data: null, error: null };
  mockState.calls.from = [];
  mockState.calls.select = [];
  mockState.calls.eq = [];
  mockState.calls.maybeSingle = 0;
  mockState.calls.upsert = [];
  mockState.calls.rpc = [];
  // Keep test output clean: the module logs on read/write failures by design.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadSession", () => {
  it("returns the ru default when no row exists (R1.4)", async () => {
    mockState.maybeSingleResult = { data: null, error: null };

    const session = await loadSession(123);

    expect(session).toMatchObject({
      telegramUserId: 123,
      lang: "ru",
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
    });
    // Queried the right table, keyed by telegram_user_id.
    expect(mockState.calls.from[0]).toEqual(["telegram_sessions"]);
    expect(mockState.calls.eq[0]).toEqual(["telegram_user_id", 123]);
    expect(mockState.calls.maybeSingle).toBe(1);
  });

  it("maps a snake_case DB row to a camelCase Session", async () => {
    mockState.maybeSingleResult = {
      data: {
        telegram_user_id: 555,
        lang: "uz",
        scenario: "report_value",
        scenario_step: 2,
        scenario_data: { value: "+998901112233", description: "scam" },
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    };

    const session = await loadSession(555);

    expect(session).toEqual({
      telegramUserId: 555,
      lang: "uz",
      scenario: "report_value",
      scenarioStep: 2,
      scenarioData: { value: "+998901112233", description: "scam" },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("coerces invalid lang/scenario and null scenario_data to defaults", async () => {
    mockState.maybeSingleResult = {
      data: {
        telegram_user_id: 7,
        lang: "fr", // not a supported Lang
        scenario: "totally_unknown", // not a supported Scenario
        scenario_step: 0,
        scenario_data: null,
        updated_at: "2026-02-02T00:00:00.000Z",
      },
      error: null,
    };

    const session = await loadSession(7);

    expect(session.lang).toBe("ru");
    expect(session.scenario).toBe("none");
    expect(session.scenarioData).toEqual({});
  });

  it("falls back to the default when the read returns an error", async () => {
    mockState.maybeSingleResult = { data: null, error: { message: "boom" } };

    const session = await loadSession(99);

    expect(session).toMatchObject({ telegramUserId: 99, lang: "ru", scenario: "none" });
  });

  it("fails closed and marks storage unavailable when a webhook session read fails", async () => {
    mockState.maybeSingleResult = {
      data: null,
      error: { message: "SECRET database read detail" },
    };

    await expect(runWithTelegramUpdateExecution(100, () => loadSession(99))).rejects.toBeInstanceOf(
      TelegramSessionLoadError,
    );
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("SECRET");
  });

  it("loads through the fenced RPC when the update owns a lease", async () => {
    mockState.rpcResult = {
      data: {
        lease_valid: true,
        session: {
          telegram_user_id: 99,
          lang: "en",
          scenario: "none",
          scenario_step: 0,
          scenario_data: {},
          updated_at: "2026-07-11T00:00:00.000Z",
        },
      },
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(200, () => loadSession(99), {
      lease: fencedLease,
    });

    expect(execution.value.lang).toBe("en");
    expect(mockState.calls.from).toHaveLength(0);
    expect(mockState.calls.rpc[0]).toEqual([
      "load_telegram_session_fenced",
      {
        p_telegram_user_id: 99,
        p_update_id: 200,
        p_lease_token: fencedLease.leaseToken,
        p_processing_fence: 3,
        p_leader_token: null,
        p_leader_fence: null,
      },
    ]);
  });
});

describe("saveSession", () => {
  it("upserts by telegram_user_id and returns { ok: true } on success (R15.2)", async () => {
    mockState.upsertResult = { error: null };

    const result = await saveSession(42, { scenario: "report_desc", scenarioStep: 1 });

    expect(result).toEqual({ ok: true });

    const [row, options] = mockState.calls.upsert[0];
    expect(row).toMatchObject({
      telegram_user_id: 42,
      scenario: "report_desc",
      scenario_step: 1,
    });
    // updated_at is always set by the writer.
    expect(row).toHaveProperty("updated_at");
    // Conflict target is the primary key.
    expect(options).toEqual({ onConflict: "telegram_user_id" });
  });

  it("returns { ok: false } when the write fails", async () => {
    mockState.upsertResult = { error: { message: "write failed" } };

    const result = await saveSession(42, { scenarioStep: 3 });

    expect(result).toEqual({ ok: false, reason: "storage" });
  });

  it("uses the monotonic RPC inside a webhook update execution", async () => {
    mockState.rpcResult = {
      data: [{ applied: true, current_update_id: 101 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(101, () =>
      saveSession(42, { scenario: "report_desc", scenarioStep: 1 }),
    );

    expect(execution).toEqual({
      value: { ok: true },
      sessionStorageFailed: false,
      sessionFailureWarningRequired: false,
    });
    expect(mockState.calls.rpc).toEqual([
      [
        "save_telegram_session_sequenced",
        {
          p_telegram_user_id: 42,
          p_update_id: 101,
          p_patch: { scenario: "report_desc", scenario_step: 1 },
        },
      ],
    ]);
    expect(mockState.calls.upsert).toHaveLength(0);
  });

  it("persists a first-contact language hint with the first partial webhook save", async () => {
    mockState.maybeSingleResult = { data: null, error: null };
    mockState.rpcResult = {
      data: [{ applied: true, current_update_id: 102 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(102, async () => {
      const session = await loadSession(42, "uz");
      expect(session.lang).toBe("uz");
      return saveSession(42, { scenario: "await_check" });
    });

    expect(execution.sessionStorageFailed).toBe(false);
    expect(mockState.calls.rpc.at(-1)).toEqual([
      "save_telegram_session_sequenced",
      {
        p_telegram_user_id: 42,
        p_update_id: 102,
        p_patch: { lang: "uz", scenario: "await_check" },
      },
    ]);
  });

  it("uses a language-only fenced claim without mutating scenario context", async () => {
    mockState.rpcResult = {
      data: [{ lease_valid: true, applied: true, current_update_id: 200 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(
      200,
      async () => {
        rememberTelegramSessionLanguage("uz");
        return saveSession(42, {});
      },
      { lease: fencedLease },
    );

    expect(execution).toEqual({
      value: { ok: true },
      sessionStorageFailed: false,
      sessionFailureWarningRequired: false,
    });
    expect(mockState.calls.rpc[0]).toEqual([
      "save_telegram_session_fenced",
      {
        p_telegram_user_id: 42,
        p_update_id: 200,
        p_patch: { lang: "uz" },
        p_lease_token: fencedLease.leaseToken,
        p_processing_fence: 3,
        p_leader_token: null,
        p_leader_fence: null,
      },
    ]);
  });

  it("rejects a stale update without marking storage unavailable", async () => {
    mockState.rpcResult = {
      data: [{ applied: false, current_update_id: 102 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(101, () =>
      saveSession(42, { scenarioStep: 1 }),
    );

    expect(execution).toEqual({
      value: { ok: false, reason: "stale" },
      sessionStorageFailed: false,
      sessionFailureWarningRequired: false,
    });
  });

  it("marks a sequenced storage failure without logging the database message", async () => {
    mockState.rpcResult = {
      data: null,
      error: { message: "SECRET database detail" },
    };

    const execution = await runWithTelegramUpdateExecution(101, () =>
      saveSession(42, { scenarioStep: 1 }),
    );

    expect(execution).toEqual({
      value: { ok: false, reason: "storage" },
      sessionStorageFailed: true,
      sessionFailureWarningRequired: true,
    });
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("SECRET");
  });

  it("rejects a session write when the fenced lease is stale", async () => {
    mockState.rpcResult = {
      data: [{ lease_valid: false, applied: false, current_update_id: 200 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(
      200,
      () => saveSession(42, { scenarioStep: 1 }),
      { lease: fencedLease },
    );

    expect(execution).toEqual({
      value: { ok: false, reason: "stale" },
      sessionStorageFailed: false,
      sessionFailureWarningRequired: false,
    });
    expect(mockState.calls.rpc[0]?.[0]).toBe("save_telegram_session_fenced");
  });

  it("keeps an operator-only post-delivery write failure out of the user warning path", async () => {
    mockState.rpcResult = {
      data: null,
      error: { message: "SECRET database detail" },
    };

    const execution = await runWithTelegramUpdateExecution(
      200,
      () =>
        saveSession(
          42,
          { scenarioData: { lastCheck: undefined } },
          { failureVisibility: "operator_only" },
        ),
      { lease: fencedLease },
    );

    expect(execution).toEqual({
      value: { ok: false, reason: "storage" },
      sessionStorageFailed: true,
      sessionFailureWarningRequired: false,
    });
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).not.toContain("SECRET");
  });

  it("treats a malformed fenced result as storage failure", async () => {
    mockState.rpcResult = {
      data: [{ applied: true, current_update_id: 200 }],
      error: null,
    };

    const execution = await runWithTelegramUpdateExecution(200, () => saveSession(42, {}), {
      lease: fencedLease,
    });

    expect(execution).toEqual({
      value: { ok: false, reason: "storage" },
      sessionStorageFailed: true,
      sessionFailureWarningRequired: true,
    });
  });
});

describe("setLanguage", () => {
  it("returns { ok: true } and writes the new lang on success (R2.2)", async () => {
    mockState.upsertResult = { error: null };

    const result = await setLanguage(1001, "uz");

    expect(result).toEqual({ ok: true });
    const [row] = mockState.calls.upsert[0];
    expect(row).toMatchObject({ telegram_user_id: 1001, lang: "uz" });
  });

  it("returns { ok: false } on write error and does NOT change the language (R2.3)", async () => {
    // Stored language before the attempted change is ru.
    mockState.maybeSingleResult = {
      data: {
        telegram_user_id: 1002,
        lang: "ru",
        scenario: "none",
        scenario_step: 0,
        scenario_data: {},
        updated_at: "2026-03-03T00:00:00.000Z",
      },
      error: null,
    };
    // The write fails, so the upsert is rejected and the row is untouched.
    mockState.upsertResult = { error: { message: "write failed" } };

    const result = await setLanguage(1002, "uz");

    expect(result).toEqual({ ok: false, reason: "storage" });

    // The persisted language remains ru — the failed write changed nothing.
    const reloaded = await loadSession(1002);
    expect(reloaded.lang).toBe("ru");
  });
});

describe("resetScenario", () => {
  it("clears the scenario back to none/0/{} (R15.5)", async () => {
    mockState.upsertResult = { error: null };

    await resetScenario(2002);

    const [row] = mockState.calls.upsert[0];
    expect(row).toMatchObject({
      telegram_user_id: 2002,
      scenario: "none",
      scenario_step: 0,
      scenario_data: {},
    });
    // Language is intentionally left untouched.
    expect(row).not.toHaveProperty("lang");
  });
});
