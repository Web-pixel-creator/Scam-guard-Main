// Permanent offline-only persona simulation, shard A (P-01 pensioner and
// P-02 rushed commuter). It drives the repository's real webhook/router/
// handler/rules pipeline while keeping every external boundary deny-closed.
// Telegram, Supabase, AI, reputation and all network boundaries are mocked or
// deny-closed. Synthetic inputs below are human-voice fixtures, never real
// user content.

import process from "node:process";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const HARNESS_ENV = Object.freeze({
  OPENAI_API_KEY: "",
  OPENAI_TTS_API_KEY: "",
  GEMINI_TTS_API_KEY: "",
  SUPABASE_URL: "https://persona-sim-a.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "persona-sim-a-synthetic-service-key",
});
const ORIGINAL_ENV = new Map(
  Object.keys(HARNESS_ENV).map((key) => [key, process.env[key]] as const),
);

function installHarnessEnvironment(): void {
  for (const [key, value] of Object.entries(HARNESS_ENV)) process.env[key] = value;
}

function restoreHarnessEnvironment(): void {
  for (const [key, value] of ORIGINAL_ENV) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const h = vi.hoisted(() => ({
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  inline: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sessions: new Map<number, Record<string, unknown>>(),
  runChecks: [] as Array<Record<string, unknown>>,
  mockDbCalls: [] as string[],
  externalFetchAttempts: 0,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(options);
      return { ok: true as const, messageId: 910_000 + h.sent.length };
    },
    editMessageText: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(options);
      return { ok: true as const };
    },
    answerInlineQuery: async (options: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      h.inline.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
    answerCallbackQuery: async () => ({ ok: true as const }),
    sendAudioFile: async () => ({ ok: true as const }),
    getChatInfo: async () => ({ kind: "unavailable" as const }),
    getFile: async () => null,
    downloadFileAsDataUrl: async () => null,
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  type Builder = Record<string, (...args: unknown[]) => unknown>;
  function builder(table: string): Builder {
    const b: Builder = {};
    for (const name of ["select", "eq", "gte", "gt", "in", "limit", "order", "not", "is"]) {
      b[name] = () => b;
    }
    b.maybeSingle = async () => ({ data: null, error: null });
    b.single = async () => ({ data: null, error: null });
    b.insert = async () => {
      h.mockDbCalls.push(`${table}:insert`);
      return { data: null, error: null };
    };
    b.upsert = async () => {
      h.mockDbCalls.push(`${table}:upsert`);
      return { data: null, error: null };
    };
    b.update = () => {
      h.mockDbCalls.push(`${table}:update`);
      return b;
    };
    b.delete = () => {
      h.mockDbCalls.push(`${table}:delete`);
      return b;
    };
    return b;
  }

  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        h.mockDbCalls.push(`rpc:${name}`);
        if (name === "begin_telegram_update") {
          return {
            data: [
              {
                decision: "acquired",
                processing_fence: 1,
                retry_after_sec: 0,
                lease_expires_at: "2099-01-01T00:00:00.000Z",
                attempt_count: 1,
              },
            ],
            error: null,
          };
        }
        if (name === "complete_telegram_update" || name === "mark_telegram_update_failure") {
          return { data: true, error: null };
        }
        if (name === "claim_rate_limit") {
          return {
            data: [{ allowed: true, remaining: 99, retry_after_sec: 0, current_count: 1 }],
            error: null,
          };
        }
        if (name === "load_telegram_session_fenced") {
          const userId = Number(args.p_telegram_user_id);
          return {
            data: { lease_valid: true, session: h.sessions.get(userId) ?? null },
            error: null,
          };
        }
        if (name === "save_telegram_session_sequenced" || name === "save_telegram_session_fenced") {
          const userId = Number(args.p_telegram_user_id);
          h.sessions.set(userId, {
            ...(h.sessions.get(userId) ?? {}),
            ...((args.p_patch as Record<string, unknown> | undefined) ?? {}),
          });
          return { data: [{ applied: true, lease_valid: true }], error: null };
        }
        return { data: null, error: null };
      },
    },
  };
});

vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    runCheck: async (options: Record<string, unknown>) => {
      h.runChecks.push(options);
      return actual.runCheck({
        ...(options as unknown as Parameters<typeof actual.runCheck>[0]),
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
      });
    },
    analyzeImageCore: async () => null,
    transcribeVoiceCore: async () => ({ text: "" }),
  };
});

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: async () => null,
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));
vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: async (_input: string, result: unknown) => result,
}));
vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: async (_input: string, result: unknown) => result,
}));
vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: async () => ({ ok: false as const, reason: "not_linked" as const }),
  getFamilyShieldStatus: async () => ({ kind: "none" as const }),
}));
vi.mock("@/lib/report.functions", () => ({
  submitReport: async () => ({ ok: true as const }),
  prepareReportIdentifier: async (value: string) => ({
    type: "text",
    hash: `synthetic:${value.length}`,
    display: "[synthetic text]",
    incidentOnly: false,
  }),
  prepareIncidentOnlyReportTarget: async (value: string) => ({
    type: "text",
    hash: `synthetic-incident:${value.length}`,
    display: "[synthetic incident]",
    incidentOnly: true,
  }),
  submitPreparedReportCore: async () => ({ ok: true as const }),
  reportRateLimitKeyForTelegram: (userId: number) => `synthetic:${userId}`,
}));

import type { PersonaSurfaceCase } from "@/lib/telegram/__qa__/persona-sim-harness";
import {
  assertPersonaSegment,
  expandSeed,
  normalizeSurface,
} from "@/lib/telegram/__qa__/persona-sim-harness";
import { PERSONA_A_SEEDS } from "@/lib/telegram/__qa__/persona-seeds-a";

function checkSurfaceIntegrity(
  cases: ReadonlyArray<PersonaSurfaceCase>,
  expectedTotal: number,
): void {
  expect(cases).toHaveLength(expectedTotal);
  expect(new Set(cases.map((person) => person.id)).size).toBe(expectedTotal);
  expect(
    new Set(cases.map((person) => `${person.lang}\0${person.mode}\0${person.query}`)).size,
  ).toBe(expectedTotal);
}

interface Captured {
  visible: string;
  topicVisible: string;
  messages: number;
  articleId: string;
}

let handleTelegramWebhook!: (request: Request) => Promise<Response>;
let resetDedupe!: () => void;
let resetQueues!: () => void;
let updateId = 13_000_000;
let fetchBeforeSuite: typeof globalThis.fetch | undefined;
let fetchGuardInstalled = false;

function installDenyClosedFetchGuard(): void {
  fetchBeforeSuite = globalThis.fetch;
  globalThis.fetch = (async () => {
    h.externalFetchAttempts += 1;
    throw new Error("persona-sim-a harness denied an external network call");
  }) as typeof fetch;
  fetchGuardInstalled = true;
}

function restoreFetchAfterSuite(): void {
  if (!fetchGuardInstalled) return;
  if (fetchBeforeSuite === undefined) delete (globalThis as { fetch?: typeof fetch }).fetch;
  else globalThis.fetch = fetchBeforeSuite;
  fetchBeforeSuite = undefined;
  fetchGuardInstalled = false;
}

function withoutExactQueryEcho(value: string, queries: readonly string[]): string {
  let visible = normalizeSurface(value);
  for (const query of queries) {
    const normalizedQuery = normalizeSurface(query);
    if (normalizedQuery) visible = visible.replaceAll(normalizedQuery, " ");
  }
  return visible.replace(/\s+/gu, " ").trim();
}

async function postUpdate(body: Record<string, unknown>): Promise<void> {
  const response = await handleTelegramWebhook(
    new Request("https://persona-sim-a.invalid/api/telegram/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret",
      },
      body: JSON.stringify({ update_id: (updateId += 1), ...body }),
    }),
  );
  if (response.status !== 200) throw new Error(`webhook status ${response.status}`);
}

async function runDirect(person: PersonaSurfaceCase, userId: number): Promise<Captured> {
  const start = h.sent.length;
  await postUpdate({
    message: {
      message_id: updateId,
      date: 1_790_000_000,
      text: person.query,
      chat: { id: userId, type: "private" },
      from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
    },
  });
  const messages = h.sent.slice(start).filter((call) => call.chatId === userId);
  const visible = messages.map((call) => call.text).join("\n");
  return {
    visible,
    topicVisible: messages
      .map((call) => withoutExactQueryEcho(call.text, [person.query]))
      .join("\n"),
    messages: messages.length,
    articleId: "",
  };
}

async function runInline(person: PersonaSurfaceCase, userId: number): Promise<Captured> {
  const inlineQueryId = `persona-a-${userId}`;
  const start = h.inline.length;
  await postUpdate({
    inline_query: {
      id: inlineQueryId,
      from: { id: userId, language_code: person.profileLang, first_name: "Synthetic" },
      query: person.query,
      offset: "",
    },
  });
  const calls = h.inline.slice(start).filter((call) => call.inlineQueryId === inlineQueryId);
  if (calls.length !== 1) throw new Error(`expected one inline answer, got ${calls.length}`);
  const call = calls[0];
  if (call.results.length !== 1)
    throw new Error(`expected one inline result, got ${call.results.length}`);
  const article = call.results[0] as {
    id?: string;
    title?: string;
    description?: string;
    input_message_content?: { message_text?: string };
  };
  const topicVisible = `${article.title ?? ""}\n${article.description ?? ""}`;
  return {
    visible: `${topicVisible}\n${article.input_message_content?.message_text ?? ""}`,
    topicVisible,
    messages: 1,
    articleId: article.id ?? "",
  };
}

const PEOPLE_A: PersonaSurfaceCase[] = PERSONA_A_SEEDS.flatMap((seed, index) =>
  expandSeed(seed, index),
);

describe("persona simulation shard A: P-01 pensioner and P-02 rushed commuter", () => {
  beforeAll(async () => {
    h.externalFetchAttempts = 0;
    installDenyClosedFetchGuard();
    try {
      installHarnessEnvironment();
      const webhook = await import("@/lib/telegram/webhook.server");
      handleTelegramWebhook = webhook.handleTelegramWebhook;
      resetDedupe = webhook.__resetTelegramWebhookDedupeForTests;
      const queues = await import("@/lib/telegram/update-serialization.server");
      resetQueues = queues.__resetTelegramUserUpdateQueuesForTests;
      expect(
        h.externalFetchAttempts,
        "zero external network calls during webhook module initialization",
      ).toBe(0);
    } catch (error) {
      restoreHarnessEnvironment();
      restoreFetchAfterSuite();
      throw error;
    }
  }, 30_000);

  afterAll(() => {
    try {
      restoreHarnessEnvironment();
    } finally {
      restoreFetchAfterSuite();
    }
  });

  beforeEach(() => {
    h.sent.length = 0;
    h.inline.length = 0;
    h.sessions.clear();
    h.runChecks.length = 0;
    h.mockDbCalls.length = 0;
    h.externalFetchAttempts = 0;
    resetDedupe();
    resetQueues();
  });

  it("runs every P-01/P-02 surface through the real pipeline with zero external sinks", async () => {
    checkSurfaceIntegrity(PEOPLE_A, PEOPLE_A.length);
    // Balance is proportional so documented gap removals cannot silently
    // skew the suite; the absolute floor keeps the shard's scale promise.
    expect(PEOPLE_A.length, "shard scale floor").toBeGreaterThan(700);
    expect(
      PEOPLE_A.filter((person) => person.persona === "P-01").every(
        (person) => person.profileLang !== person.lang,
      ),
      "P-01 profile language differs from query language on every surface",
    ).toBe(true);
    expect(
      PEOPLE_A.filter((person) => person.persona === "P-02").every(
        (person) => person.profileLang === person.lang,
      ),
      "P-02 profile language matches the query language (fragment fallback path)",
    ).toBe(true);
    for (const lang of ["ru", "uz", "en"] as const) {
      const inLang = PEOPLE_A.filter((person) => person.lang === lang);
      expect(inLang.length / PEOPLE_A.length, `${lang} share`).toBeGreaterThan(0.28);
      for (const mode of ["direct", "inline"] as const) {
        expect(
          inLang.filter((person) => person.mode === mode).length / inLang.length,
          `${lang}/${mode} share`,
        ).toBeGreaterThan(0.4);
      }
    }

    const results: Array<{
      key: string;
      passed: boolean;
      error?: string;
    }> = [];
    const matrix: Record<string, { passed: number; failed: number; total: number }> = {};
    const record = (keys: readonly string[], passed: boolean): void => {
      for (const key of keys) {
        matrix[key] ??= { passed: 0, failed: 0, total: 0 };
        matrix[key].total += 1;
        if (passed) matrix[key].passed += 1;
        else matrix[key].failed += 1;
      }
    };

    for (let index = 0; index < PEOPLE_A.length; index += 1) {
      const person = PEOPLE_A[index];
      const userId = 97_000_001 + index;
      let captured: Captured | undefined;
      try {
        captured =
          person.mode === "direct"
            ? await runDirect(person, userId)
            : await runInline(person, userId);
        assertPersonaSegment(person, captured.visible, captured.topicVisible);
        expect(h.externalFetchAttempts).toBe(0);
        record(
          [
            `persona:${person.persona}`,
            `family:${person.family}`,
            `mode:${person.mode}`,
            `lang:${person.lang}`,
            `kind:${person.kind}`,
          ],
          true,
        );
        results.push({ key: person.id, passed: true });
      } catch (error) {
        record(
          [
            `persona:${person.persona}`,
            `family:${person.family}`,
            `mode:${person.mode}`,
            `lang:${person.lang}`,
            `kind:${person.kind}`,
          ],
          false,
        );
        results.push({
          key: person.id,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const failed = results.filter((result) => !result.passed);
    console.log(`PERSONA_A_SURFACE_MATRIX=${JSON.stringify(matrix)}`);
    const failingSeeds = [
      ...new Set(failed.map((result) => result.key.replace(/-(direct|inline)-[a-z]+-\d+$/, ""))),
    ].sort();
    console.log(`PERSONA_A_FAILING_SEEDS=${JSON.stringify(failingSeeds)}`);
    expect(h.externalFetchAttempts).toBe(0);
    expect(failed, `${failed.length} persona surfaces failed`).toHaveLength(0);
    expect(h.externalFetchAttempts).toBe(0);
    expect(failed, `${failed.length} persona surfaces failed`).toHaveLength(0);
  }, 240_000);
});
