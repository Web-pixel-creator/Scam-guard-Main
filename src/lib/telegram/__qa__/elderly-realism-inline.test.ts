// Elderly-realism QA run — Inline path (2026-07-16).
//
// Drives the REAL handleInlineQuery (real check-core, rules-only) with
// realistic elderly/mixed-language queries. Telegram and Supabase are faked;
// the network is disabled. Replies are recorded into a JSON report for
// human review; in-test assertions cover only universal invariants
// (exactly one answer per query, no DB mutations, no network).

import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answers: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  fetchAttempts: 0,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    answerInlineQuery: async (options: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      h.answers.push(options);
      return { ok: true as const };
    },
  };
});

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

import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import type { Session } from "@/lib/telegram/session.server";
import {
  ELDERLY_INLINE_CORPUS,
  type ElderlyInlineQaRow,
} from "@/lib/telegram/__qa__/elderly-realism-corpus";

interface InlineRecord {
  id: string;
  family: string;
  sessionLang: string;
  clientLang: string;
  expectLang: string;
  expectation: string;
  query: string;
  title: string;
  description: string;
  message: string;
  buttons: string[];
  error?: string;
}

const report: InlineRecord[] = [];
const REPORT_DIR =
  process.env.ELDERLY_QA_REPORT_DIR ?? path.join(process.cwd(), "output", "elderly-qa");

function sessionFor(lang: ElderlyInlineQaRow["sessionLang"], userId: number): Session {
  return {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

function buttonLabels(article: InlineQueryResultArticle): string[] {
  const keyboard = (article as { reply_markup?: { inline_keyboard?: unknown } }).reply_markup
    ?.inline_keyboard;
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

describe("elderly-realism QA — inline", () => {
  let sequence = 0;

  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-elderly-inline-qa.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-elderly-inline-qa-service-key";
    delete process.env.OPENAI_API_KEY;
    vi.stubGlobal("fetch", async () => {
      h.fetchAttempts += 1;
      throw new Error("elderly inline QA harness: network disabled");
    });
  });

  beforeEach(() => {
    h.answers.length = 0;
    h.dbMutations.length = 0;
  });

  afterAll(() => {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, "inline-report.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), rows: report }, null, 1),
      "utf8",
    );
    vi.unstubAllGlobals();
  });

  it.each(ELDERLY_INLINE_CORPUS as ElderlyInlineQaRow[])("$id", async (row) => {
    sequence += 1;
    const userId = 94_000_000 + sequence;
    const inlineQueryId = `elderly-inline-${sequence}`;

    let error: string | undefined;
    try {
      await handleInlineQuery(
        row.query,
        { userId, languageCode: row.clientLang, session: sessionFor(row.sessionLang, userId) },
        inlineQueryId,
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    expect(h.answers, `${row.id}: expected exactly one inline answer`).toHaveLength(1);
    expect(h.dbMutations, `${row.id}: inline must be non-persistent`).toEqual([]);
    const answer = h.answers[0];
    expect(answer.results, row.id).toHaveLength(1);
    const article = answer.results[0] as InlineQueryResultArticle;

    report.push({
      id: row.id,
      family: row.family,
      sessionLang: row.sessionLang,
      clientLang: row.clientLang,
      expectLang: row.expectLang,
      expectation: row.expectation,
      query: row.query,
      title: article.title,
      description: article.description ?? "",
      message: markdownV2ToPlainText(article.input_message_content.message_text),
      buttons: buttonLabels(article),
      ...(error ? { error } : {}),
    });
  });
});
