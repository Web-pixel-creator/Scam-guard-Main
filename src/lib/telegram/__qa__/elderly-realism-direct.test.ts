// Elderly-realism QA run — direct chat path (2026-07-16).
//
// Drives the REAL pipeline end to end: dispatchUpdate → router (meta-intent /
// follow-up precedence) → real handlers → real runCheck (rules-first, no AI)
// → real formatting. Only the transport boundaries are faked: Telegram API,
// Supabase and session storage. No network access is possible.
//
// This is primarily an observational harness: every turn's reply is recorded
// into a JSON report for human review. A small set of previously verified P0
// handoff gaps also has strict semantic assertions so they cannot silently
// return to a generic verdict.

import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Session } from "@/lib/telegram/session.server";

const h = vi.hoisted(() => ({
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown; edited?: boolean }>,
  runChecks: [] as Array<{ type: string; level: string; score: number; reasons: string[] }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  fetchAttempts: 0,
  imageMeta: { filePath: "photos/qa.png", fileSize: 4096 } as {
    filePath: string;
    fileSize: number;
  } | null,
  imageDataUrl: null as string | null,
}));

// ── Fake Supabase: no data, rate limits always allowed, mutations recorded ──
vi.mock("@/integrations/supabase/client.server", () => {
  type FakeBuilder = Record<string, unknown>;
  function builder(table: string): FakeBuilder {
    const value: FakeBuilder = {};
    for (const m of ["select", "eq", "gte", "gt", "in", "limit", "order", "not", "is"]) {
      value[m] = () => value;
    }
    value.maybeSingle = async () => ({ data: null, error: null });
    value.single = async () => ({ data: null, error: null });
    value.insert = async () => {
      h.dbMutations.push({ table, operation: "insert" });
      return { error: null };
    };
    value.upsert = async () => {
      h.dbMutations.push({ table, operation: "upsert" });
      return { error: null };
    };
    value.update = () => {
      h.dbMutations.push({ table, operation: "update" });
      return value;
    };
    value.delete = () => {
      h.dbMutations.push({ table, operation: "delete" });
      return value;
    };
    return value;
  }
  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string) => {
        if (name === "claim_rate_limit") {
          return {
            data: [{ allowed: true, remaining: 99, retry_after_sec: 0, current_count: 1 }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    },
  };
});

// ── Telegram API: capture outbound, never touch the network ─────────────────
vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(opts);
      return { ok: true };
    },
    editMessageText: async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push({ ...opts, edited: true });
      return { ok: true };
    },
    sendAudioFile: async () => ({ ok: true }),
    sendChatAction: async () => {},
    answerCallbackQuery: async () => {},
    answerInlineQuery: async () => ({ ok: true as const }),
    getChatInfo: async () => ({ kind: "unavailable" as const }),
    getFile: async () => h.imageMeta,
    downloadFileAsDataUrl: async () => h.imageDataUrl,
  };
});

// ── Session storage: deterministic in-memory store ──────────────────────────
vi.mock("@/lib/telegram/session.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/session.server")>();
  const store = new Map<number, Session>();

  function fallback(telegramUserId: number, langHint?: string): Session {
    return {
      telegramUserId,
      lang: actual.langFromTelegramCode(langHint) ?? "ru",
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ...actual,
    loadSession: async (telegramUserId: number, langHint?: string) => {
      const existing = store.get(telegramUserId);
      if (existing) return { ...existing, scenarioData: { ...existing.scenarioData } };
      const created = fallback(telegramUserId, langHint);
      store.set(telegramUserId, created);
      return { ...created, scenarioData: { ...created.scenarioData } };
    },
    saveSession: async (
      telegramUserId: number,
      patch: Partial<Omit<Session, "telegramUserId">>,
    ) => {
      const existing = store.get(telegramUserId) ?? fallback(telegramUserId);
      store.set(telegramUserId, {
        ...existing,
        ...(patch.lang !== undefined ? { lang: patch.lang } : {}),
        ...(patch.scenario !== undefined ? { scenario: patch.scenario } : {}),
        ...(patch.scenarioStep !== undefined ? { scenarioStep: patch.scenarioStep } : {}),
        ...(patch.scenarioData !== undefined ? { scenarioData: patch.scenarioData } : {}),
        updatedAt: new Date().toISOString(),
      });
      return { ok: true as const };
    },
    resetScenario: async (telegramUserId: number) => {
      const existing = store.get(telegramUserId);
      if (existing) {
        store.set(telegramUserId, {
          ...existing,
          scenario: "none",
          scenarioStep: 0,
          scenarioData: {},
        });
      }
    },
  };
});

// ── Enrichment layers: pass-through / not linked (no Bot API, no DB) ────────
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

// ── Real check-core, calls recorded ──────────────────────────────────────────
vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    runCheck: async (options: Parameters<typeof actual.runCheck>[0]) => {
      const result = await actual.runCheck(options);
      h.runChecks.push({
        type: result.type,
        level: result.level,
        score: result.score,
        reasons: [...result.reasons],
      });
      return result;
    },
  };
});

import { installTelegramHandlers } from "@/lib/telegram/handlers";
import { dispatchUpdate, type TelegramUpdate } from "@/lib/telegram/router";
import {
  ELDERLY_DIRECT_CORPUS,
  type ElderlyQaRow,
  type QaLang,
} from "@/lib/telegram/__qa__/elderly-realism-corpus";

interface TurnRecord {
  turn: number;
  input: string;
  runChecks: typeof h.runChecks;
  messages: Array<{ text: string; buttons: string[]; edited: boolean }>;
}

interface RowRecord {
  id: string;
  family: string;
  persona: string;
  clientLang: QaLang;
  expectLang: QaLang;
  expectation: string;
  turns: TurnRecord[];
  error?: string;
}

const report: RowRecord[] = [];
const REPORT_DIR =
  process.env.ELDERLY_QA_REPORT_DIR ?? path.join(process.cwd(), "output", "elderly-qa");

let updateId = 700_000;
let messageId = 1;

function textUpdate(userId: number, clientLang: QaLang, text: string): TelegramUpdate {
  updateId += 1;
  messageId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      date: 1_760_000_000,
      text,
      chat: { id: userId, type: "private" },
      from: { id: userId, language_code: clientLang, first_name: "QA" },
    },
  } as TelegramUpdate;
}

function keyboardLabels(keyboard: unknown): string[] {
  if (!Array.isArray(keyboard)) return [];
  const labels: string[] = [];
  for (const row of keyboard) {
    if (!Array.isArray(row)) continue;
    for (const btn of row) {
      if (btn && typeof btn === "object" && typeof (btn as { text?: unknown }).text === "string") {
        labels.push((btn as { text: string }).text);
      }
    }
  }
  return labels;
}

function drainTurn(turn: number, input: string): TurnRecord {
  const record: TurnRecord = {
    turn,
    input,
    runChecks: h.runChecks.splice(0, h.runChecks.length),
    messages: h.sent.splice(0, h.sent.length).map((m) => ({
      text: m.text,
      buttons: keyboardLabels(m.keyboard),
      edited: Boolean(m.edited),
    })),
  };
  return record;
}

function visibleTurnText(turn: TurnRecord): string {
  return turn.messages.map((message) => message.text).join("\n");
}

function assertHandoffRegression(rowId: string, turnNo: number, turn: TurnRecord): void {
  const visible = visibleTurnText(turn);
  if (rowId === "uz-cyr-relative-01" && turnNo === 1) {
    expect(turn.runChecks).toHaveLength(0);
    expect(visible).toContain("shaxsini tasdiqlang");
  }
  if (rowId === "uz-cyr-victim-tg-01" && turnNo === 1) {
    expect(turn.runChecks).toHaveLength(0);
    expect(visible).toContain("Sozlamalar → Qurilmalar");
    expect(visible).toContain("notanish seanslarni tugating");
  }
  if ((rowId === "ru-relative-01" && turnNo === 2) || (rowId === "ru-invest-01" && turnNo === 3)) {
    expect(turn.runChecks).toHaveLength(0);
    expect(visible).toContain("деньги уже отправлены");
    expect(visible).toContain("заморозить перевод");
  }
  if (rowId === "ru-invest-01" && turnNo === 2) {
    expect(turn.runChecks).toHaveLength(0);
    expect(visible).toContain("Инвестиции/крипта");
    expect(visible).not.toContain("не вижу, к какой именно проверке");
  }
  if (rowId === "ru-apk-01" && (turnNo === 2 || turnNo === 3)) {
    expect(turn.runChecks).toHaveLength(0);
    expect(visible).toContain("авиарежим");
    expect(visible).toContain("удалите его");
  }
  if (rowId === "ru-neutral-phone-01" && turnNo === 1) {
    expect(turn.runChecks).toHaveLength(1);
    expect(turn.runChecks[0]).toMatchObject({ type: "phone" });
    expect(visible).toContain("Паспорт номера");
  }
}

describe("elderly-realism QA — direct chat", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-elderly-qa.invalid";
    process.env.SUPABASE_PUBLISHABLE_KEY = "offline-elderly-qa-publishable";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-elderly-qa-service-key";
    // Deterministic mode: no AI provider → rules-only verdicts, degraded OCR/STT.
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_API_KEY;
    delete process.env.GEMINI_TTS_API_KEY;
    vi.stubGlobal("fetch", async () => {
      h.fetchAttempts += 1;
      throw new Error("elderly QA harness: network disabled");
    });
    installTelegramHandlers();
  });

  beforeEach(() => {
    h.sent.length = 0;
    h.runChecks.length = 0;
    h.dbMutations.length = 0;
  });

  afterAll(() => {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, "direct-report.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), rows: report }, null, 1),
      "utf8",
    );
    vi.unstubAllGlobals();
  });

  let rowIndex = 0;

  it.each(ELDERLY_DIRECT_CORPUS as ElderlyQaRow[])("$id", async (row) => {
    rowIndex += 1;
    const userId = 91_000_000 + rowIndex;
    const record: RowRecord = {
      id: row.id,
      family: row.family,
      persona: row.persona,
      clientLang: row.clientLang,
      expectLang: row.expectLang,
      expectation: row.expectation,
      turns: [],
    };

    for (let turnNo = 0; turnNo < row.turns.length; turnNo += 1) {
      const input = row.turns[turnNo];
      try {
        await dispatchUpdate(textUpdate(userId, row.clientLang, input));
      } catch (error) {
        record.error = `turn ${turnNo + 1}: ${error instanceof Error ? error.message : String(error)}`;
      }
      const turnRecord = drainTurn(turnNo + 1, input);
      record.turns.push(turnRecord);
      // Universal invariant: the bot must never leave a message unanswered.
      expect(
        turnRecord.messages.length,
        `${row.id} turn ${turnNo + 1} produced no reply`,
      ).toBeGreaterThan(0);
      assertHandoffRegression(row.id, turnNo + 1, turnRecord);
    }

    report.push(record);
  });

  it("simulates a screenshot sent instead of text (no-AI degradation, RU/UZ/EN)", async () => {
    // 1x1 transparent PNG — decodes as an image with no QR and no OCR.
    h.imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    for (const clientLang of ["ru", "uz", "en"] as const) {
      rowIndex += 1;
      const userId = 92_000_000 + rowIndex;
      updateId += 1;
      messageId += 1;
      const update = {
        update_id: updateId,
        message: {
          message_id: messageId,
          date: 1_760_000_000,
          chat: { id: userId, type: "private" },
          from: { id: userId, language_code: clientLang, first_name: "QA" },
          photo: [{ file_id: "qa-photo-small", file_unique_id: "u1", width: 90, height: 90 }],
        },
      } as unknown as TelegramUpdate;

      await dispatchUpdate(update);
      const turnRecord = drainTurn(1, `[screenshot:${clientLang}]`);
      expect(turnRecord.messages.length, `screenshot ${clientLang}`).toBeGreaterThan(0);
      report.push({
        id: `screenshot-no-ai-${clientLang}`,
        family: "screenshot_instead_of_text",
        persona: "ru-elderly-typos",
        clientLang,
        expectLang: clientLang,
        expectation: "clarify",
        turns: [turnRecord],
      });
    }
  });

  it("simulates a voice note when STT is unavailable (RU/UZ/EN)", async () => {
    for (const clientLang of ["ru", "uz", "en"] as const) {
      rowIndex += 1;
      const userId = 93_000_000 + rowIndex;
      updateId += 1;
      messageId += 1;
      const update = {
        update_id: updateId,
        message: {
          message_id: messageId,
          date: 1_760_000_000,
          chat: { id: userId, type: "private" },
          from: { id: userId, language_code: clientLang, first_name: "QA" },
          voice: {
            file_id: "qa-voice",
            file_unique_id: "v1",
            duration: 12,
            mime_type: "audio/ogg",
            file_size: 48_000,
          },
        },
      } as unknown as TelegramUpdate;

      await dispatchUpdate(update);
      const turnRecord = drainTurn(1, `[voice-no-stt:${clientLang}]`);
      expect(turnRecord.messages.length, `voice ${clientLang}`).toBeGreaterThan(0);
      report.push({
        id: `voice-no-stt-${clientLang}`,
        family: "voice_stt_unavailable",
        persona: "voice-stt",
        clientLang,
        expectLang: clientLang,
        expectation: "clarify",
        turns: [turnRecord],
      });
    }
  });
});
