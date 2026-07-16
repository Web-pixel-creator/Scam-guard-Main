import process from "node:process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answers: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
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
      h.answers.push(options);
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
import type { InlineQueryResultArticle } from "@/lib/telegram/api.server";
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
    updatedAt: "2026-07-16T00:00:00.000Z",
  };
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

async function runInline(
  query: string,
  options: { sessionLang?: Lang; languageCode?: string } = {},
): Promise<InlineQueryResultArticle> {
  sequence += 1;
  const userId = 7_160_000 + sequence;
  const inlineQueryId = `latest-inline-regression-${sequence}`;
  const answerCount = h.answers.length;
  const sessionLang = options.sessionLang ?? "ru";

  await handleInlineQuery(
    query,
    {
      userId,
      languageCode: options.languageCode ?? sessionLang,
      session: sessionFor(sessionLang, userId),
    },
    inlineQueryId,
  );

  expect(h.answers).toHaveLength(answerCount + 1);
  const answer = h.answers.at(-1)!;
  expect(answer).toMatchObject({ inlineQueryId, cacheTime: 10, isPersonal: true });
  expect(answer.results).toHaveLength(1);
  return answer.results[0] as InlineQueryResultArticle;
}

function visibleMessage(article: InlineQueryResultArticle): string {
  return markdownV2ToPlainText(article.input_message_content.message_text);
}

function allVisibleText(article: InlineQueryResultArticle): string {
  return `${article.title}\n${article.description ?? ""}\n${visibleMessage(article)}`;
}

describe("Inline regressions from the 2026-07-16 Telegram Desktop screenshots", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-latest-inline.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-latest-inline-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("Latest Inline regression tests must not access the network or an API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  beforeEach(() => {
    h.answers.length = 0;
    h.dbMutations.length = 0;
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
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
    vi.unstubAllGlobals();
  });

  it("uses strong Uzbek query content instead of a stale Russian session language", async () => {
    const article = await runInline("Bank operatsiyasini bekor qilish uchun SMS kodni ayting", {
      sessionLang: "ru",
      languageCode: "ru",
    });

    expect(article.title).toBe("Kod: hech kimga aytmang");
    expect(allVisibleText(article)).toMatch(/(?:kodni|kod|aytmang|bermang)/iu);
    expect(allVisibleText(article)).not.toMatch(/(?:никому|назовите|сообщайте|пришлите)/iu);
  });

  it.each(["Менга кодни айтинг", "СМС кодни айтинг деб ёзишяпти", "Kod beraymi?"])(
    "answers short or Cyrillic Uzbek in Uzbek despite a Russian session: %s",
    async (query) => {
      const article = await runInline(query, { sessionLang: "ru", languageCode: "ru" });

      expect(allVisibleText(article)).toMatch(/(?:kod|aytmang|bermang|yubormang)/iu);
      expect(allVisibleText(article)).not.toMatch(/(?:никому|сообщайте|назовите|пришлите)/iu);
    },
  );

  it("answers a short English safety question in English despite a Russian session", async () => {
    const article = await runInline("Tell OTP?", { sessionLang: "ru", languageCode: "ru" });

    expect(allVisibleText(article)).toMatch(/(?:code|otp|do not|never|share|tell)/iu);
    expect(allVisibleText(article)).not.toMatch(/(?:никому|сообщайте|назовите|пришлите)/iu);
  });

  it("uses strong English query content instead of a stale Russian session language", async () => {
    const article = await runInline(
      "A bank agent says I must tell them the SMS code to cancel a transaction",
      { sessionLang: "ru", languageCode: "ru" },
    );

    expect(article.title).toBe("Code: do not share it with anyone");
    expect(allVisibleText(article)).toMatch(/(?:do not|never).{0,30}(?:share|tell|read out)/iu);
    expect(allVisibleText(article)).not.toMatch(/(?:никому|назовите|сообщайте|пришлите)/iu);
  });

  it("keeps the trust question and detailed third line in a multiline OTP scenario", async () => {
    const detail =
      "Здравствуйте, я из компании GoldenHouse, вы выиграли квартиру, подтвердите код на телефоне";
    const article = await runInline(
      `Пришел код и просят его сказать\nМожно ли ему доверять?\n${detail}`,
    );
    const visible = allVisibleText(article);

    expect(article.title).toMatch(/(?:нет|не довер|не сообщ)/iu);
    expect(visible).toContain("GoldenHouse");
    expect(visible).toMatch(/(?:выигрыш|квартир|приз).{0,80}(?:код|подтверд)/iu);
    expect(visible).not.toMatch(
      /(?:если это не весь текст|добавьте (?:его|полный текст)|пришлите полный текст)/iu,
    );
  });

  it("changes next-action guidance in the body, not only in the title", async () => {
    const base = await runInline("Пришел код и просят его сказать");
    const nextAction = await runInline("Пришел код и просят его сказать\nЧто мне делать дальше?");

    expect(nextAction.title).not.toBe(base.title);
    expect(nextAction.description).not.toBe(base.description);
    expect(nextAction.description).toMatch(
      /(?:заверш|прекрат|положите трубку|заблок|перезвон|не отвеч|не сообщ)/iu,
    );
  });

  it("does not claim that an actual third-line URL is absent", async () => {
    const article = await runInline(
      [
        "Меня пытаются обмануть",
        "Просят оплатить налог и прислали ссылку",
        "https://www.flaticon.com/search?word=sold&color=black&shape=fill",
      ].join("\n"),
    );
    const visible = allVisibleText(article);

    expect(visible).not.toMatch(
      /(?:адреса (?:здесь|в запросе) нет|без самого URL|URL отсутствует|добавьте (?:URL|адрес|ссылку))/iu,
    );
    expect(visible).toMatch(/(?:flaticon\.com|адрес найден|домен|видим)/iu);
  });

  it("does not ask for a Telegram username again when one is already present", async () => {
    const article = await runInline("Меня зовут вступить в какой-то канал\n@lucky_promo_qa");
    const visible = allVisibleText(article);

    expect(visible).not.toMatch(/пришлите (?:приглашение|username|юзернейм|ссылку)/iu);
    expect(visible).toMatch(/(?:@lucky_promo_qa|username|имя пользователя|канал)/iu);
  });

  it("gives password-specific privacy guidance without echoing the password or OTP", async () => {
    const password = "Correct-Horse-Battery-Staple";
    const otp = "123456";
    const article = await runInline(`${otp}: password: "${password}"`);
    const serialized = JSON.stringify(article);
    const visible = allVisibleText(article);

    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(otp);
    expect(visible).toMatch(/(?:парол|password)/iu);
    expect(visible).toMatch(/(?:не сообщ|не встав|смен|change|do not share|do not paste)/iu);
    expect(visible).not.toMatch(/(?:нужно больше контекста|more context needed)/iu);
  });

  it("gives recovery-phrase-specific privacy guidance without echoing seed words", async () => {
    const recoveryPhrase =
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon";
    const article = await runInline(`seed phrase: ${recoveryPhrase}`);
    const serialized = JSON.stringify(article);
    const visible = allVisibleText(article);

    for (const marker of ["apple", "dragon", "harbor", "lemon"]) {
      expect(serialized).not.toContain(marker);
    }
    expect(visible).toMatch(/(?:seed|recovery|фраз.{0,20}восстанов|сид-фраз)/iu);
    expect(visible).toMatch(/(?:никому|не сообщ|новый кошел|do not share|new wallet)/iu);
    expect(visible).not.toMatch(/(?:нужно больше контекста|more context needed)/iu);
  });

  it.each([
    "Пришел SМS-кoд и прoсят егo скaзать",
    "Пришел S\u200BMS-к\u200Bод и просят его сказать",
  ])("normalizes mixed-script and zero-width code-request variants: %s", async (query) => {
    const article = await runInline(query);
    const visible = allVisibleText(article);

    expect(article.title).toMatch(/(?:код|sms)/iu);
    expect(visible).toMatch(/(?:никому|не сообщ|не называ|не дикт)/iu);
  });

  it.each([
    ['pаssword: "Correct-Horse-Battery-Staple"', "Correct-Horse-Battery-Staple"],
    ['pаsswоrd: "Correct-Horse-Battery-Staple"', "Correct-Horse-Battery-Staple"],
    ['пaрoль: "Correct-Horse-Battery-Staple"', "Correct-Horse-Battery-Staple"],
    [
      "se\u200Bed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "seеd phrаse: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    ["S\u2066MS code: 731904", "731904"],
    ["SМS cоde: 731904", "731904"],
  ])("does not leak a secret behind a confusable or invisible label: %s", async (query, secret) => {
    const article = await runInline(query);
    const serialized = JSON.stringify(article);

    expect(serialized).not.toContain(secret);
    expect(allVisibleText(article)).toMatch(/(?:парол|password|код|code|seed|recovery|сид-фраз)/iu);
  });
});
