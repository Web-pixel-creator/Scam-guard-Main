import process from "node:process";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answers: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<Record<string, unknown>>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
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
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sentMessages.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  type FakeBuilder = {
    select: () => FakeBuilder;
    eq: () => FakeBuilder;
    gte: () => FakeBuilder;
    gt: () => FakeBuilder;
    in: () => FakeBuilder;
    limit: () => FakeBuilder;
    order: () => FakeBuilder;
    maybeSingle: () => Promise<{ data: null; error: null }>;
    single: () => Promise<{ data: null; error: null }>;
    insert: () => Promise<{ error: null }>;
    upsert: () => Promise<{ error: null }>;
    update: () => FakeBuilder;
    delete: () => FakeBuilder;
  };

  function builder(table: string): FakeBuilder {
    const value: FakeBuilder = {
      select: () => value,
      eq: () => value,
      gte: () => value,
      gt: () => value,
      in: () => value,
      limit: () => value,
      order: () => value,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      insert: async () => {
        h.dbMutations.push({ table, operation: "insert" });
        return { error: null };
      },
      upsert: async () => {
        h.dbMutations.push({ table, operation: "upsert" });
        return { error: null };
      },
      update: () => {
        h.dbMutations.push({ table, operation: "update" });
        return value;
      },
      delete: () => {
        h.dbMutations.push({ table, operation: "delete" });
        return value;
      },
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

vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    runCheck: async (options: Record<string, unknown>) => {
      h.runCheckCalls.push(options);
      return actual.runCheck({
        ...(options as unknown as Parameters<typeof actual.runCheck>[0]),
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
      });
    },
  };
});

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: async () => ({ ok: true as const }),
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: async () => ({ ok: false as const, reason: "not_linked" as const }),
}));

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

import type { Lang } from "@/lib/i18n";
import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
import { handleCheck } from "@/lib/telegram/handlers/check";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import type { Session } from "@/lib/telegram/session.server";

const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let fetchGuard: ReturnType<typeof vi.fn>;
let sequence = 0;

function sessionFor(lang: Lang, userId: number): Session {
  return {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2026-08-13T00:00:00.000Z",
  };
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

function inlineVisible(article: InlineQueryResultArticle): string {
  return [
    article.title,
    article.description ?? "",
    markdownV2ToPlainText(article.input_message_content.message_text),
  ].join("\n");
}

async function runInline(query: string, fallback: Lang): Promise<InlineQueryResultArticle> {
  sequence += 1;
  const userId = 8_130_000 + sequence;
  const inlineQueryId = `normalization-anchor-${sequence}`;

  await handleInlineQuery(
    query,
    { userId, languageCode: fallback, session: sessionFor(fallback, userId) },
    inlineQueryId,
  );

  expect(h.answers).toHaveLength(1);
  expect(h.answers[0]).toMatchObject({ inlineQueryId, cacheTime: 10, isPersonal: true });
  expect(h.answers[0].results).toHaveLength(1);
  return h.answers[0].results[0] as InlineQueryResultArticle;
}

async function runDirect(query: string, fallback: Lang): Promise<string> {
  sequence += 1;
  const userId = 8_230_000 + sequence;
  await handleCheck(query, {
    chatId: 8_330_000 + sequence,
    userId,
    session: sessionFor(fallback, userId),
  });

  expect(h.sentMessages.length).toBeGreaterThan(0);
  return h.sentMessages.map(({ text }) => markdownV2ToPlainText(text)).join("\n");
}

describe("Direct and Inline bounded normalization anchors", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-normalization-routes.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-normalization-routes-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("normalization route regressions must not access network or AI");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  beforeEach(() => {
    h.answers.length = 0;
    h.sentMessages.length = 0;
    h.runCheckCalls.length = 0;
    h.dbMutations.length = 0;
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    expect(h.dbMutations).toEqual([]);
  });

  afterAll(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.unstubAllGlobals();
  });

  it("keeps a mixed-confusable English code request in English on both routes", async () => {
    const query = "They ask me to send cоdе from SMS";
    const article = await runInline(query, "ru");
    const direct = await runDirect(query, "ru");

    expect(article.title).toBe("Code: do not share it with anyone");
    expect(inlineVisible(article)).toMatch(/(?:do not|never).{0,30}(?:share|send|tell)/iu);
    expect(direct).toMatch(/(?:do not|never).{0,30}(?:share|send|tell)/iu);
    expect(`${inlineVisible(article)}\n${direct}`).not.toMatch(/[а-яё]{2,}/iu);
  });

  it("redacts a confusable English SMS-code label before either route can echo it", async () => {
    const query = "SМS cоdе: 731904";
    const article = await runInline(query, "en");
    const direct = await runDirect(query, "en");
    const visible = `${JSON.stringify(article)}\n${direct}`;

    expect(article.title).toBe("Code hidden: do not share it");
    expect(direct).toContain("Code hidden: do not share it");
    expect(visible).not.toContain("731904");
    expect(h.runCheckCalls).toEqual([]);
  });

  it("routes spaced Russian code and SMS anchors as Russian on both routes", async () => {
    const query = "Пришлите к 0 д из с м с";
    const article = await runInline(query, "en");
    const direct = await runDirect(query, "en");

    const visible = `${inlineVisible(article)}\n${direct}`;
    expect(visible).toMatch(/(?:sms|код)/iu);
    expect(visible).toMatch(/(?:никому|не сообщ|не называ|не дикт)/iu);
    expect(visible).not.toMatch(/(?:not enough data|more context needed)/iu);
    expect(h.runCheckCalls.map(({ input }) => input)).toEqual([query, query]);
  });

  it.each([
    ["raqamni tashlab yubordim", /(?:kod|raqam|blok|parol|tez|darhol)/iu],
    ["pulni jo'natvordim", /(?:bank|pul|o'tkaz|karta|darhol|tez)/iu],
  ] as const)(
    "keeps Uzbek completed-action wording in Uzbek on both routes: %s",
    async (query, safety) => {
      const article = await runInline(query, "ru");
      const direct = await runDirect(query, "ru");
      const visible = `${inlineVisible(article)}\n${direct}`;

      expect(visible).toMatch(safety);
      expect(visible).not.toMatch(/(?:недостаточно данных|сообщите код|переведите деньги)/iu);
    },
  );

  it.each([
    "The product model C0DE-2024 is listed in the manual",
    "Check identifier user_s3nd_c0d3 and model S3ND-C0D3-731904",
    "The model is S3ND C0D3",
    "Identifier S3ND C0D3",
    "Reference value: S3ND C0D3",
    "The source code label is S3ND C0D3",
  ])("does not turn a bounded model or identifier into a code-request route: %s", async (query) => {
    const article = await runInline(query, "ru");
    await runDirect(query, "ru");

    expect(article.id).not.toBe("private-code");
    expect(article.title).not.toBe("Code: do not share it with anyone");
    expect(h.runCheckCalls).toHaveLength(2);
    expect(h.runCheckCalls.map(({ input }) => input)).toEqual([query, query]);
  });
});
