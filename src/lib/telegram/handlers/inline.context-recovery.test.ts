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
    updatedAt: "2026-07-15T00:00:00.000Z",
  };
}

function markdownV2ToPlainText(value: string): string {
  const escapable = new Set("_*[]()~`>#+-=|{}.!\\");
  return value.replace(/\\(.)/gu, (match, escaped: string) =>
    escapable.has(escaped) ? escaped : match,
  );
}

async function runInline(lang: Lang, query: string): Promise<InlineQueryResultArticle> {
  sequence += 1;
  const userId = 7_150_000 + sequence;
  const inlineQueryId = `context-recovery-${sequence}`;
  const answerCount = h.answerCalls.length;

  await handleInlineQuery(
    query,
    { userId, languageCode: lang, session: sessionFor(lang, userId) },
    inlineQueryId,
  );

  expect(h.answerCalls).toHaveLength(answerCount + 1);
  const answer = h.answerCalls.at(-1)!;
  expect(answer).toMatchObject({ inlineQueryId, cacheTime: 10, isPersonal: true });
  expect(answer.results).toHaveLength(1);
  const article = answer.results[0] as InlineQueryResultArticle;
  expect(Array.from(article.description ?? "").length).toBeLessThanOrEqual(120);
  expect(article.description ?? "").not.toMatch(/\b(?:или|и|либо|or|and|yoki|va)…$/iu);
  return article;
}

function visibleMessage(article: InlineQueryResultArticle): string {
  return markdownV2ToPlainText(article.input_message_content.message_text);
}

function expectSemanticFreshId(article: InlineQueryResultArticle, semanticIntent: string): void {
  expect(article.id).toMatch(
    new RegExp(`^check-(?:unknown|suspicious)-${semanticIntent}-[A-Za-z0-9_-]{6,}$`, "u"),
  );
  expect(article.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/u);
}

function expectLatestTail(article: InlineQueryResultArticle, tail: string): void {
  expect(visibleMessage(article)).toContain(tail);
}

describe("Inline screenshot context recovery", () => {
  beforeAll(() => {
    process.env.SUPABASE_URL = "https://offline-inline-context.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "offline-inline-context-service-key";
    fetchGuard = vi.fn(() => {
      throw new Error("Inline context recovery tests must not access the network or an API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  beforeEach(() => {
    h.answerCalls.length = 0;
    h.dbMutations.length = 0;
    h.dbReads.length = 0;
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

  it.each([
    {
      lang: "ru" as const,
      first: "Меня приглашают в канал для заработка",
      tail: "Получается, меня разводят?",
      title: "Канал заработка: осторожно",
      action: "Не платите заранее",
    },
    {
      lang: "uz" as const,
      first: "Meni daromad uchun kanalga taklif qilishyapti",
      tail: "Bu firibgarlikmi?",
      title: "Daromad kanali: ehtiyot bo'ling",
      action: "Oldindan to'lamang",
    },
    {
      lang: "en" as const,
      first: "They invite me to an earning channel",
      tail: "Is this a scam?",
      title: "Earning channel: be careful",
      action: "Do not prepay",
    },
  ])(
    "keeps the earning-channel intent when a $lang second line asks whether it is a scam",
    async ({ lang, first, tail, title, action }) => {
      const base = await runInline(lang, first);
      const extended = await runInline(lang, `${first}\n${tail}`);

      expectSemanticFreshId(base, "earning-channel");
      expectSemanticFreshId(extended, "earning-channel");
      expect(extended.id).not.toBe(base.id);
      expect(extended.title).toBe(title);
      expect(extended.description).toContain(action);
      expectLatestTail(extended, tail);
    },
  );

  it.each([
    {
      lang: "ru" as const,
      query: "Что мне делать дальше?\nЯ отправил фото своего паспорта",
      title: "Паспорт уже отправлен: снизьте риск",
      tail: "Я отправил фото своего паспорта",
      action: "Сохраните переписку",
    },
    {
      lang: "uz" as const,
      query: "Nima qilay?\nMen pasportim suratini yubordim",
      title: "Pasport yuborilgan: xavfni kamaytiring",
      tail: "Men pasportim suratini yubordim",
      action: "Yozishmani saqlang",
    },
    {
      lang: "en" as const,
      query: "What should I do next?\nI sent a photo of my passport",
      title: "Passport already sent: reduce the risk",
      tail: "I sent a photo of my passport",
      action: "Save the chat",
    },
  ])(
    "routes already-sent passport text to $lang aftercare instead of prevention",
    async ({ lang, query, title, tail, action }) => {
      const article = await runInline(lang, query);

      expectSemanticFreshId(article, "personal-data-aftercare");
      expect(article.title).toBe(title);
      expect(visibleMessage(article)).toContain(action);
      expectLatestTail(article, tail);
      expect(visibleMessage(article)).not.toContain("Пока ничего не отправляйте");
      expect(visibleMessage(article)).not.toContain("Do not send anything yet");
    },
  );

  it.each([
    {
      lang: "ru" as const,
      first: "Это безопасно или мошенники?",
      tail: "Я из РУВД, вас подозревают в мошенничестве",
      title: "Госорган/инспектор: проверьте официально",
      action: "Проверяйте по официальному номеру",
    },
    {
      lang: "uz" as const,
      first: "Bu xavfsizmi yoki firibgarlikmi?",
      tail: "Men IIBdanman, siz firibgarlikda gumon qilinyapsiz",
      title: "Davlat organi/inspektor: rasmiy tekshiring",
      action: "rasmiy",
    },
    {
      lang: "en" as const,
      first: "Is this safe or a scam?",
      tail: "I am from the police; you are suspected of fraud",
      title: "Government/inspector: verify officially",
      action: "official number",
    },
  ])(
    "lets a $lang authority-impersonation tail override a generic safety question",
    async ({ lang, first, tail, title, action }) => {
      const generic = await runInline(lang, first);
      const article = await runInline(lang, `${first}\n${tail}`);

      expectSemanticFreshId(article, "official-impersonation");
      expect(article.id).not.toBe(generic.id);
      expect(article.title).toBe(title);
      expect(visibleMessage(article)).toContain(action);
      expectLatestTail(article, tail);
    },
  );

  it("keeps voting-link guidance when the second line asks how to spot a substituted link", async () => {
    const first = "Меня просят проголосовать на канале и перейти по ссылке";
    const tail = "Как мне узнать, что ссылка подставная?";
    const base = await runInline("ru", first);
    const article = await runInline("ru", `${first}\n${tail}`);

    expectSemanticFreshId(base, "voting-link");
    expectSemanticFreshId(article, "voting-link");
    expect(article.id).not.toBe(base.id);
    expect(article.title).toBe("Голосование/канал: сначала проверим");
    expect(article.description).toContain("Не переходите по ссылке");
    expectLatestTail(article, tail);
  });

  it("uses the tax-link tail instead of repeating the generic scam card", async () => {
    const first = "Меня пытаются обмануть";
    const tail = "Просят оплатить налог и прислали ссылку";
    const generic = await runInline("ru", first);
    const article = await runInline("ru", `${first}\n${tail}`);

    expectSemanticFreshId(article, "link-request");
    expect(article.id).not.toBe(generic.id);
    expect(article.title).toBe("Ссылка: сначала проверим");
    expect(article.description).toContain("Не открывайте");
    expectLatestTail(article, tail);
  });

  it("keeps the code action and refreshes the card when a trust question is appended", async () => {
    const first = "Пришел код и просят его сказать";
    const tail = "Не доверять ему?";
    const base = await runInline("ru", first);
    const repeatedBase = await runInline("ru", first);
    const article = await runInline("ru", `${first}\n${tail}`);

    expectSemanticFreshId(base, "code-request");
    expect(repeatedBase.id).toBe(base.id);
    expectSemanticFreshId(article, "code-request");
    expect(article.id).not.toBe(base.id);
    expect(article.title).toBe("Код: никому не называйте");
    expect(article.description).toContain("SMS");
    expectLatestTail(article, tail);
  });

  it("keeps official-bank guidance and includes the newly added chat-number question", async () => {
    const first = "Как мне связаться с банком?";
    const tail = "А если я взял номер из чата?";
    const base = await runInline("ru", first);
    const article = await runInline("ru", `${first}\n${tail}`);

    expectSemanticFreshId(base, "bank-contact");
    expectSemanticFreshId(article, "bank-contact");
    expect(article.id).not.toBe(base.id);
    expect(article.title).toBe("Связаться с банком: только официальный номер");
    expect(article.description).toContain("Не используйте номер из чата");
    expectLatestTail(article, tail);
  });

  it("lets an SMS-code tail override the low-signal unknown-contact card", async () => {
    const first = "Мне пишет незнакомый человек";
    const tail = "Он хочет СМС-код";
    const generic = await runInline("ru", first);
    const article = await runInline("ru", `${first}\n${tail}`);

    expectSemanticFreshId(article, "code-request");
    expect(article.id).not.toBe(generic.id);
    expect(article.title).toBe("Код: никому не называйте");
    expectLatestTail(article, tail);
  });

  it("does not treat the literal '+ newline +' marker as a real newline or hide its danger", async () => {
    const prefix = "Мне пишет незнакомый человек";
    const tail = "Он хочет СМС-код";
    const realNewline = await runInline("ru", `${prefix}\n${tail}`);
    const literalMarker = await runInline("ru", `${prefix} + newline + ${tail}`);

    expectSemanticFreshId(realNewline, "code-request");
    expectSemanticFreshId(literalMarker, "code-request");
    expect(literalMarker.id).not.toBe(realNewline.id);
    expect(literalMarker.title).toBe("Код: никому не называйте");
    expect(visibleMessage(literalMarker)).toContain("+ newline +");
    expectLatestTail(literalMarker, tail);
  });
});
