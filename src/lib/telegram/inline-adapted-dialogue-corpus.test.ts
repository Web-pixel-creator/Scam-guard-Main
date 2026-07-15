import process from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  dbReads: [] as string[],
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
      select: () => {
        h.dbReads.push(table);
        return value;
      },
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

import { classifyMetaIntent, getMetaIntentResponse } from "@/lib/meta-intent";
import { evaluateText } from "@/lib/risk/rules";
import { validateMarkdownV2 } from "@/lib/telegram/__tests__/markdown-v2-validator";
import {
  INLINE_ADAPTED_DIALOGUE_CORPUS,
  INLINE_ADAPTED_DIALOGUE_STATS,
  INLINE_ADAPTED_QUERY_LIMIT,
  type InlineAdaptedDialogueCase,
} from "@/lib/telegram/inline-adapted-dialogue-corpus";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
import type { Session } from "@/lib/telegram/session.server";

const EXPECTED_CONTINUE_BUTTON = {
  ru: "Открыть Ishonch Guard",
  uz: "Ishonch Guardni ochish",
  en: "Open Ishonch Guard",
} as const;

const EXPECTED_HIGH_RISK_ACTION_PREFIX = {
  ru: "Безопасный шаг:",
  uz: "Xavfsiz qadam:",
  en: "Safe step:",
} as const;

const FALSE_PREVIOUS_CHECK_CLAIM =
  /(?:я\s+(?:уже\s+)?(?:проверил|перепроверил)\s+(?:прошл|предыдущ)|i\s+(?:already\s+)?(?:checked|rechecked)\s+(?:the\s+)?previous|oldingi\s+(?:xabar|natija).{0,30}(?:tekshirdim|qayta\s+tekshirdim))/iu;
const USER_FACING_JARGON =
  /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing\s+table|deterministic|детерминирован\w*|deterministik)\b/iu;

function sessionFor(testCase: InlineAdaptedDialogueCase, userId: number): Session {
  return {
    telegramUserId: userId,
    lang: testCase.lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: "2026-07-14T00:00:00.000Z",
  };
}

function articleFromLastCall(testCase: InlineAdaptedDialogueCase): InlineQueryResultArticle {
  const call = h.answerCalls.at(-1);
  expect(call, testCase.id).toBeDefined();
  expect(call?.results, testCase.id).toHaveLength(1);
  return call!.results[0] as InlineQueryResultArticle;
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

const FAILURE_OR_NON_ANSWER_IDS = new Set(["help", "error", "rate-limited", "too-long"]);

describe("adapted 1,000-dialogue Inline perimeter", () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let fetchGuard: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    h.answerCalls.length = 0;
    h.dbMutations.length = 0;
    h.dbReads.length = 0;
    h.rpcCalls.length = 0;
    h.runCheckCalls.length = 0;
    process.env.SUPABASE_URL = "https://offline-inline-corpus.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-inline-corpus-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("offline Inline corpus must not access a network or external API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterAll(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.unstubAllGlobals();
  });

  it("exports exact reproducible source counts and represents every original dialogue", () => {
    expect(INLINE_ADAPTED_DIALOGUE_STATS).toMatchObject({
      totalCases: 3805,
      sourceCounts: {
        raw_turn: 2500,
        contextual_followup: 930,
        mixed_clause: 363,
        credential_boundary: 12,
      },
    });
    expect(INLINE_ADAPTED_DIALOGUE_STATS.uniqueQueries).toBeGreaterThanOrEqual(1000);

    const ids = INLINE_ADAPTED_DIALOGUE_CORPUS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(INLINE_ADAPTED_DIALOGUE_CORPUS.length);
    const representedDialogues = new Set(
      INLINE_ADAPTED_DIALOGUE_CORPUS.filter(({ source }) => source === "raw_turn").map(
        ({ dialogueId }) => dialogueId,
      ),
    );
    expect(representedDialogues.size).toBe(1000);

    for (const testCase of INLINE_ADAPTED_DIALOGUE_CORPUS) {
      expect(testCase.query.trim().length, testCase.id).toBeGreaterThan(0);
      expect(testCase.query.length, testCase.id).toBeLessThanOrEqual(INLINE_ADAPTED_QUERY_LIMIT);
    }
  });

  it("preserves risk reasons, safe controls and canonical meta intent before rendering", () => {
    for (const testCase of INLINE_ADAPTED_DIALOGUE_CORPUS) {
      const reasons = evaluateText(testCase.query);
      for (const reason of testCase.requiredReasons) {
        expect(reasons, `${testCase.id}: ${testCase.query}`).toContain(reason);
      }
      for (const reason of testCase.forbiddenReasons) {
        expect(reasons, `${testCase.id}: ${testCase.query}`).not.toContain(reason);
      }
      if (testCase.expectedKind === "meta") {
        expect(classifyMetaIntent(testCase.query), testCase.id).toBe(testCase.expectedMetaIntent);
      }
    }
  });

  it("localizes acknowledgement and identity small talk without calling the checker", async () => {
    const cases = [
      {
        id: "ru-thanks",
        lang: "ru",
        query: "Ясно, спасибо",
        articleId: "small-talk-thanks",
        title: "Пожалуйста",
      },
      {
        id: "uz-thanks",
        lang: "uz",
        query: "Raxmat",
        articleId: "small-talk-thanks",
        title: "Arzimaydi",
      },
      {
        id: "en-thanks",
        lang: "en",
        query: "Thx",
        articleId: "small-talk-thanks",
        title: "You are welcome",
      },
      {
        id: "ru-identity",
        lang: "ru",
        query: "Кто ты такой?",
        articleId: "small-talk-identity",
        title: "Я — Ishonch Guard",
      },
      {
        id: "uz-identity",
        lang: "uz",
        query: "Siz kims?",
        articleId: "small-talk-identity",
        title: "Men — Ishonch Guard",
      },
      {
        id: "en-identity",
        lang: "en",
        query: "Who r u?",
        articleId: "small-talk-identity",
        title: "I am Ishonch Guard",
      },
      {
        id: "ru-thanks-natural",
        lang: "ru",
        query: "Большое спасибо!",
        articleId: "small-talk-thanks",
        title: "Пожалуйста",
      },
      {
        id: "uz-thanks-natural",
        lang: "uz",
        query: "Rahmat sizga!",
        articleId: "small-talk-thanks",
        title: "Arzimaydi",
      },
      {
        id: "en-thanks-natural",
        lang: "en",
        query: "Thank you so much!",
        articleId: "small-talk-thanks",
        title: "You are welcome",
      },
      {
        id: "ru-identity-natural",
        lang: "ru",
        query: "Что ты за бот?",
        articleId: "small-talk-identity",
        title: "Я — Ishonch Guard",
      },
      {
        id: "uz-identity-natural",
        lang: "uz",
        query: "Sen kimsan o'zi?",
        articleId: "small-talk-identity",
        title: "Men — Ishonch Guard",
      },
      {
        id: "en-identity-natural",
        lang: "en",
        query: "What bot is this?",
        articleId: "small-talk-identity",
        title: "I am Ishonch Guard",
      },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const runCheckBefore = h.runCheckCalls.length;
      const answerBefore = h.answerCalls.length;
      const userId = 1_800_000 + index;
      await handleInlineQuery(
        testCase.query,
        {
          userId,
          languageCode: testCase.lang,
          session: {
            telegramUserId: userId,
            lang: testCase.lang,
            scenario: "none",
            scenarioStep: 0,
            scenarioData: {},
            updatedAt: "2026-07-14T00:00:00.000Z",
          },
        },
        `offline-small-talk-${index + 1}`,
      );

      expect(h.answerCalls.length, testCase.id).toBe(answerBefore + 1);
      expect(h.runCheckCalls.length, testCase.id).toBe(runCheckBefore);
      const article = h.answerCalls.at(-1)!.results[0] as InlineQueryResultArticle;
      expect(article.id, testCase.id).toBe(testCase.articleId);
      expect(article.title, testCase.id).toBe(testCase.title);
      expect(article.reply_markup?.inline_keyboard?.[0]?.[0]?.text, testCase.id).toBe(
        EXPECTED_CONTINUE_BUTTON[testCase.lang],
      );
    }
  });

  it("does not let a small-talk prefix suppress a dangerous tail", async () => {
    const cases = [
      { lang: "ru", query: "Спасибо, но меня просят назвать OTP 638205", secret: "638205" },
      { lang: "uz", query: "Rahmat, lekin mendan OTP 638205 so'rashyapti", secret: "638205" },
      { lang: "en", query: "Thank you, but they ask for OTP 638205", secret: "638205" },
      { lang: "ru", query: "Ты кто? Мне сказали назвать PIN 4821", secret: "4821" },
      { lang: "uz", query: "Siz kimsiz? Ular PIN 4821 ni so'rashyapti", secret: "4821" },
      { lang: "en", query: "Who are you? They ask for CVV 614", secret: "614" },
    ] as const;

    for (const [index, testCase] of cases.entries()) {
      const userId = 1_900_000 + index;
      await handleInlineQuery(
        testCase.query,
        {
          userId,
          languageCode: testCase.lang,
          session: {
            telegramUserId: userId,
            lang: testCase.lang,
            scenario: "none",
            scenarioStep: 0,
            scenarioData: {},
            updatedAt: "2026-07-14T00:00:00.000Z",
          },
        },
        `offline-danger-tail-${index + 1}`,
      );

      const article = h.answerCalls.at(-1)!.results[0] as InlineQueryResultArticle;
      expect(article.id, testCase.query).not.toMatch(/^(?:small-talk-|meta-|help$)/u);
      expect(FAILURE_OR_NON_ANSWER_IDS, testCase.query).not.toContain(article.id);
      expect(article.id, testCase.query).not.toBe("check-safe");
      expect(
        markdownV2ToPlainText(article.input_message_content.message_text),
        testCase.query,
      ).not.toContain(testCase.secret);
    }
  });

  it("renders all 3,805 cases through the real Inline handler with zero external sinks", async () => {
    const answersBeforeCorpus = h.answerCalls.length;
    for (const [index, testCase] of INLINE_ADAPTED_DIALOGUE_CORPUS.entries()) {
      const before = h.answerCalls.length;
      const userId = 2_000_000 + index;
      const inlineQueryId = `offline-inline-${index + 1}`;

      await handleInlineQuery(
        testCase.query,
        { userId, session: sessionFor(testCase, userId), languageCode: testCase.lang },
        inlineQueryId,
      );

      expect(h.answerCalls.length, testCase.id).toBe(before + 1);
      const call = h.answerCalls.at(-1)!;
      expect(call.inlineQueryId, testCase.id).toBe(inlineQueryId);
      expect(call.cacheTime, testCase.id).toBe(10);
      expect(call.isPersonal, testCase.id).toBe(true);

      const article = articleFromLastCall(testCase);
      expect(article.type, testCase.id).toBe("article");
      expect(article.id.trim().length, testCase.id).toBeGreaterThan(0);
      expect(article.title.trim().length, testCase.id).toBeGreaterThan(0);
      expect(article.title.length, testCase.id).toBeLessThanOrEqual(256);
      expect(article.description?.length ?? 0, testCase.id).toBeLessThanOrEqual(120);
      expect(article.input_message_content.message_text.trim().length, testCase.id).toBeGreaterThan(
        0,
      );
      expect(article.input_message_content.message_text.length, testCase.id).toBeLessThanOrEqual(
        4096,
      );
      expect(article.input_message_content.parse_mode, testCase.id).toBe("MarkdownV2");
      expect(article.input_message_content.disable_web_page_preview, testCase.id).toBe(true);
      expect(
        validateMarkdownV2(article.input_message_content.message_text),
        testCase.id,
      ).toMatchObject({ valid: true, errors: [] });

      const button = article.reply_markup?.inline_keyboard?.[0]?.[0];
      expect(button?.text, testCase.id).toBe(EXPECTED_CONTINUE_BUTTON[testCase.lang]);
      expect(button?.url, testCase.id).toBe("https://t.me/scamguard_bot");

      const serialized = JSON.stringify(article);
      expect(serialized, testCase.id).not.toContain("undefined");
      expect(serialized, testCase.id).not.toMatch(USER_FACING_JARGON);
      expect(FAILURE_OR_NON_ANSWER_IDS, testCase.id).not.toContain(article.id);
      const plainMessage = markdownV2ToPlainText(article.input_message_content.message_text);
      const visiblePlainText = [
        article.title,
        article.description ?? "",
        plainMessage,
        button?.text ?? "",
      ].join("\n");
      for (const secret of testCase.forbiddenOutput) {
        expect(visiblePlainText, `${testCase.id}: leaked ${secret}`).not.toContain(secret);
      }
      for (const fragment of testCase.forbiddenVisibleFragments) {
        expect(visiblePlainText, `${testCase.id}: leaked fragment ${fragment}`).not.toContain(
          fragment,
        );
      }

      if (article.id === "check-high_risk") {
        const actionPrefix = EXPECTED_HIGH_RISK_ACTION_PREFIX[testCase.lang];
        const actionLine = plainMessage.split("\n")[1] ?? "";
        expect(actionLine, testCase.id).toMatch(new RegExp(`^${actionPrefix}\\s+`, "u"));
        const action = actionLine.slice(actionPrefix.length).trim();
        expect(action.length, testCase.id).toBeGreaterThan(0);
        expect(article.description?.startsWith(action), testCase.id).toBe(true);
      }

      if (
        testCase.expectedKind === "risk" ||
        testCase.expectedKind === "mixed_danger" ||
        testCase.expectedKind === "credential_boundary"
      ) {
        expect(article.id, testCase.id).not.toBe("check-safe");
        expect(article.id, testCase.id).not.toMatch(/^(?:small-talk-|meta-)/u);
        expect(article.title, testCase.id).not.toMatch(/^(?:🟢\s*)?(?:Безопасно|Xavfsiz|Safe)$/iu);
      }

      if (testCase.expectedKind === "mixed_safe_control") {
        expect(article.id, testCase.id).toMatch(/^check-(?:safe|unknown)(?:-|$)/u);
        expect(article.id, testCase.id).not.toMatch(/^check-(?:suspicious|danger)(?:-|$)/u);
      }

      if (testCase.expectedKind === "meta") {
        expect(article.id, testCase.id).toBe(
          `meta-${testCase.expectedMetaIntent!.replaceAll("_", "-")}`,
        );
        const response = getMetaIntentResponse(testCase.expectedMetaIntent!, testCase.lang);
        expect(response.trim().length, testCase.id).toBeGreaterThan(20);
      }

      if (testCase.expectedKind === "stateless_followup") {
        expect(serialized, testCase.id).not.toMatch(FALSE_PREVIOUS_CHECK_CLAIM);
        if (testCase.expectedFollowUpAction === "acknowledgement") {
          expect(article.id, testCase.id).toBe("small-talk-thanks");
        }
        if (testCase.expectedFollowUpAction === "identity") {
          expect(article.id, testCase.id).toBe("small-talk-identity");
        }
      }
    }

    expect(h.answerCalls.length - answersBeforeCorpus).toBe(
      INLINE_ADAPTED_DIALOGUE_STATS.totalCases,
    );
    expect(fetchGuard).not.toHaveBeenCalled();
    expect(h.dbMutations).toEqual([]);
    expect(h.rpcCalls.length).toBeGreaterThan(0);
    expect(new Set(h.rpcCalls)).toEqual(new Set(["claim_rate_limit"]));
    expect(h.runCheckCalls.length).toBeGreaterThan(0);
    for (const options of h.runCheckCalls) {
      expect(options).toMatchObject({
        channel: "telegram",
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
      });
    }
  }, 30_000);
});
