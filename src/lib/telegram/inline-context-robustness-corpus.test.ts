import process from "node:process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  rpcCalls: [] as string[],
  runCheckCalls: [] as Array<Record<string, unknown>>,
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
      h.answerCalls.push(options);
      return { ok: true as const };
    },
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
        h.rpcCalls.push(name);
        if (name === "claim_rate_limit") {
          return {
            data: [
              {
                allowed: true,
                remaining: 99,
                retry_after_sec: 0,
                current_count: 1,
              },
            ],
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
      return actual.runCheck(options as unknown as Parameters<typeof actual.runCheck>[0]);
    },
  };
});

import type { Lang } from "@/lib/i18n";
import { validateMarkdownV2 } from "@/lib/telegram/__tests__/markdown-v2-validator";
import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import {
  INLINE_CONTEXT_EXPECTED_CASE_COUNT,
  INLINE_CONTEXT_LANGUAGE_COUNT,
  INLINE_CONTEXT_MUTATION_COUNT,
  INLINE_CONTEXT_ROBUSTNESS_CORPUS,
  INLINE_CONTEXT_SAFE_CONTROLS,
  INLINE_CONTEXT_SEED_COUNT,
  type InlineContextRobustnessCase,
} from "@/lib/telegram/inline-context-robustness-corpus";
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
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

function normalizeVisible(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru").replace(/\s+/gu, " ").trim();
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const EXPECTED_FOLLOW_UP_TITLES: Record<
  Lang,
  { bankChatNumber: string; scamConfirmationSuffix: string; nextActionSuffix: string }
> = {
  ru: {
    bankChatNumber: "По номеру из чата не звоните",
    scamConfirmationSuffix: "похоже на схему обмана",
    nextActionSuffix: "что делать сейчас",
  },
  uz: {
    bankChatNumber: "Chatdagi raqamga qo'ng'iroq qilmang",
    scamConfirmationSuffix: "firib belgilariga o'xshaydi",
    nextActionSuffix: "hozir nima qilish kerak",
  },
  en: {
    bankChatNumber: "Do not call the number from the chat",
    scamConfirmationSuffix: "it resembles a scam pattern",
    nextActionSuffix: "what to do now",
  },
};

const CORE_AS_LAST_LINE_MUTATIONS = new Set([
  "polite-newline",
  "generic-before",
  "neutral-before-newline",
  "crlf",
  "blank-line",
  "neutral-generic-danger",
  "generic-before-after",
  "full-dialogue",
]);

const EXPECTED_NEXT_ACTION_TEXT: Record<Lang, string> = {
  ru: "Приостановите контакт",
  uz: "Aloqani vaqtincha to'xtating",
  en: "Pause contact",
};

function expectedVisibleTitle(testCase: InlineContextRobustnessCase): string {
  const followUps = EXPECTED_FOLLOW_UP_TITLES[testCase.lang];
  if (testCase.seed === "bank_contact" && CORE_AS_LAST_LINE_MUTATIONS.has(testCase.mutation)) {
    return followUps.bankChatNumber;
  }
  if (testCase.seed === "next_step" && CORE_AS_LAST_LINE_MUTATIONS.has(testCase.mutation)) {
    return `${testCase.title} — ${followUps.nextActionSuffix}`;
  }
  if (testCase.mutation === "generic-after") {
    return `${testCase.title} — ${followUps.scamConfirmationSuffix}`;
  }
  return testCase.title;
}

function expectedVisibleAction(testCase: InlineContextRobustnessCase): string {
  if (testCase.seed === "next_step" && CORE_AS_LAST_LINE_MUTATIONS.has(testCase.mutation)) {
    return EXPECTED_NEXT_ACTION_TEXT[testCase.lang];
  }
  return testCase.action;
}

async function runInline(
  lang: Lang,
  query: string,
): Promise<{ answer: (typeof h.answerCalls)[number]; article: InlineQueryResultArticle }> {
  sequence += 1;
  const userId = 8_150_000 + sequence;
  const inlineQueryId = `context-robustness-${sequence}`;

  await handleInlineQuery(
    query,
    { userId, languageCode: lang, session: sessionFor(lang, userId) },
    inlineQueryId,
  );

  expect(h.answerCalls).toHaveLength(1);
  const answer = h.answerCalls[0];
  expect(answer).toMatchObject({ inlineQueryId, cacheTime: 10, isPersonal: true });
  expect(answer.results).toHaveLength(1);
  return { answer, article: answer.results[0] as InlineQueryResultArticle };
}

function expectScopedSemanticId(article: InlineQueryResultArticle, semanticId: string): void {
  expect(article.id).toMatch(new RegExp(`^${regexEscape(semanticId)}-[A-Za-z0-9_-]{16}$`, "u"));
  expect(article.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/u);
}

function expectWellFormedArticle(article: InlineQueryResultArticle): void {
  expect(article.type).toBe("article");
  expect(article.title.length).toBeLessThanOrEqual(256);
  expect(article.description?.length ?? 0).toBeLessThanOrEqual(120);
  expect(article.input_message_content.parse_mode).toBe("MarkdownV2");
  expect(article.input_message_content.disable_web_page_preview).toBe(true);
  expect(article.input_message_content.message_text.length).toBeLessThanOrEqual(4096);
  expect(validateMarkdownV2(article.input_message_content.message_text)).toMatchObject({
    valid: true,
    errors: [],
  });
  expect(article.reply_markup?.inline_keyboard?.[0]?.[0]?.url).toBe("https://t.me/scamguard_bot");
  expect(JSON.stringify(article)).not.toContain("undefined");
}

describe("Inline 1,152-case context robustness corpus", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-inline-context-corpus.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-inline-context-corpus-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("Inline context corpus must not access a network or external API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  beforeEach(() => {
    h.answerCalls.length = 0;
    h.dbMutations.length = 0;
    h.rpcCalls.length = 0;
    h.runCheckCalls.length = 0;
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    expect(h.dbMutations).toEqual([]);
    for (const options of h.runCheckCalls) {
      expect(options).toMatchObject({
        channel: "telegram",
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
        rateLimitProfile: "telegram_inline_preview",
      });
    }
  });

  afterAll(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.unstubAllGlobals();
  });

  it("has the exact reproducible 16 x 3 x 24 shape with unique bounded queries", () => {
    expect(INLINE_CONTEXT_SEED_COUNT).toBe(16);
    expect(INLINE_CONTEXT_LANGUAGE_COUNT).toBe(3);
    expect(INLINE_CONTEXT_MUTATION_COUNT).toBe(24);
    expect(INLINE_CONTEXT_EXPECTED_CASE_COUNT).toBe(1152);
    expect(INLINE_CONTEXT_ROBUSTNESS_CORPUS).toHaveLength(1152);

    const ids = INLINE_CONTEXT_ROBUSTNESS_CORPUS.map(({ id }) => id);
    const localizedQueries = INLINE_CONTEXT_ROBUSTNESS_CORPUS.map(
      ({ lang, query }) => `${lang}\0${query}`,
    );
    expect(new Set(ids).size).toBe(1152);
    expect(new Set(localizedQueries).size).toBe(1152);

    for (const testCase of INLINE_CONTEXT_ROBUSTNESS_CORPUS) {
      expect(testCase.query.trim().length, testCase.id).toBeGreaterThan(0);
      expect([...testCase.query.trim()].length, testCase.id).toBeLessThanOrEqual(256);
    }
  });

  it.each(INLINE_CONTEXT_ROBUSTNESS_CORPUS)(
    "$id keeps the precise semantic family and the concrete tail",
    async (testCase: InlineContextRobustnessCase) => {
      const { article } = await runInline(testCase.lang, testCase.query);
      const plainMessage = markdownV2ToPlainText(article.input_message_content.message_text);
      const visible = [article.title, article.description ?? "", plainMessage].join("\n");

      expectScopedSemanticId(article, testCase.semanticId);
      expectWellFormedArticle(article);
      expect(article.title).toBe(expectedVisibleTitle(testCase));
      expect(article.description).toContain(expectedVisibleAction(testCase));
      expect(normalizeVisible(plainMessage)).toContain(normalizeVisible(testCase.preserve));
      expect(visible).not.toMatch(
        /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing\s+table|deterministic)\b/iu,
      );
    },
  );

  it.each(INLINE_CONTEXT_SAFE_CONTROLS)(
    "$id does not invent completed-document aftercare or authority impersonation",
    async ({ lang, query, forbiddenSemanticIds }) => {
      const { article } = await runInline(lang, query);
      expectWellFormedArticle(article);
      for (const semanticId of forbiddenSemanticIds) {
        expect(article.id).not.toMatch(new RegExp(`^${regexEscape(semanticId)}-`, "u"));
      }
    },
  );

  it.each([
    {
      id: "ru-otp",
      lang: "ru" as const,
      query: "Пришел OTP 638205, незнакомец просит назвать этот код",
      secret: "638205",
      preserved: "незнакомец просит назвать",
    },
    {
      id: "ru-pin",
      lang: "ru" as const,
      query: "Незнакомец просит отправить PIN 4821 из банковского приложения",
      secret: "4821",
      preserved: "незнакомец просит отправить",
    },
    {
      id: "uz-otp",
      lang: "uz" as const,
      query: "OTP 731904 keldi, notanish odam kodni aytishimni so'rayapti",
      secret: "731904",
      preserved: "notanish odam kodni aytishimni",
    },
    {
      id: "uz-pin",
      lang: "uz" as const,
      query: "Notanish odam bank ilovasidagi PIN 5937 ni yuborishimni so'rayapti",
      secret: "5937",
      preserved: "yuborishimni so'rayapti",
    },
    {
      id: "en-otp",
      lang: "en" as const,
      query: "OTP 926418 arrived and a stranger asks me to share the code",
      secret: "926418",
      preserved: "a stranger asks me to share",
    },
    {
      id: "en-cvv",
      lang: "en" as const,
      query: "A stranger asks me to send card CVV 614 from the banking app",
      secret: "614",
      preserved: "A stranger asks me to send",
    },
  ])("$id masks a real credential while preserving the dangerous request", async (testCase) => {
    const { article } = await runInline(testCase.lang, testCase.query);
    const visible = [
      article.title,
      article.description ?? "",
      markdownV2ToPlainText(article.input_message_content.message_text),
    ].join("\n");

    expectWellFormedArticle(article);
    expect(visible).not.toContain(testCase.secret);
    expect(normalizeVisible(visible)).toContain(normalizeVisible(testCase.preserved));
  });

  it("keeps scoped IDs deterministic for the same query and distinct after a new tail", async () => {
    const baseQuery = "Меня приглашают в канал для заработка";
    const extendedQuery = `${baseQuery}\nПолучается, меня разводят?`;
    const first = await runInline("ru", baseQuery);

    h.answerCalls.length = 0;
    const repeated = await runInline("ru", baseQuery);
    h.answerCalls.length = 0;
    const extended = await runInline("ru", extendedQuery);

    expect(first.article.id).toBe(repeated.article.id);
    expect(extended.article.id).not.toBe(first.article.id);
    expectScopedSemanticId(first.article, "check-unknown-earning-channel");
    expectScopedSemanticId(extended.article, "check-unknown-earning-channel");
  });
});
