import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<Record<string, unknown>>,
  sessionWrites: [] as Array<{ userId: number; patch: unknown }>,
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
      h.answerCalls.push(options);
      return { ok: true as const };
    },
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sentMessages.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
    getFile: async () => null,
    downloadFileAsDataUrl: async () => null,
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
        rateLimitProfile: "telegram_inline_preview",
      });
    },
  };
});

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: async (userId: number, patch: unknown) => {
    h.sessionWrites.push({ userId, patch });
    return { ok: true as const };
  },
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

type CompletedActionKind = "code" | "money";

interface CompletedActionCase {
  query: string;
  lang: Lang;
  kind: CompletedActionKind;
}

const COMPLETED_ACTION_CASES: CompletedActionCase[] = [
  { query: "я им скинула цифры из сообщения", lang: "ru", kind: "code" },
  { query: "я уже сообщил одноразовый пароль", lang: "ru", kind: "code" },
  { query: "я скинул им деньги", lang: "ru", kind: "money" },
  { query: "raqamni tashlab yubordim", lang: "uz", kind: "code" },
  { query: "pulni jo'natvordim", lang: "uz", kind: "money" },
  { query: "They have my verification code now", lang: "en", kind: "code" },
  { query: "I read out the one-time password", lang: "en", kind: "code" },
  { query: "I wired them the money", lang: "en", kind: "money" },
  { query: "The money has already gone to them", lang: "en", kind: "money" },
];

const DIRECT_TOPIC: Record<Lang, Record<CompletedActionKind, RegExp>> = {
  ru: {
    code: /позвоните в банк.{0,120}заблокируйте карту/isu,
    money: /позвоните в банк.{0,80}заморозить перевод/isu,
  },
  uz: {
    code: /bankka qo'ng'iroq.{0,120}kartani bloklang/isu,
    money: /bankka qo'ng'iroq.{0,100}o'tkazmani muzlatishni/isu,
  },
  en: {
    code: /call your bank.{0,120}block the card/isu,
    money: /call your bank.{0,100}freeze the transfer/isu,
  },
};

const INLINE_TOPIC: Record<Lang, Record<CompletedActionKind, RegExp>> = {
  ru: { code: /код уже отправлен/iu, money: /деньги уже переведены/iu },
  uz: { code: /kod yuborilgan/iu, money: /pul yuborilgan/iu },
  en: { code: /code already sent/iu, money: /money already sent/iu },
};

const WRONG_LANGUAGE: Record<Lang, RegExp> = {
  ru: /(?:bankka qo'ng'iroq qiling|call your bank)/iu,
  uz: /(?:позвоните в банк|call your bank)/iu,
  en: /(?:позвоните в банк|bankka qo'ng'iroq qiling)/iu,
};

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

function mismatchedProfileLanguage(lang: Lang): Lang {
  return lang === "ru" ? "en" : "ru";
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

beforeEach(() => {
  h.answerCalls.length = 0;
  h.sentMessages.length = 0;
  h.runCheckCalls.length = 0;
  h.sessionWrites.length = 0;
  h.dbMutations.length = 0;
  fetchGuard = vi.fn(() => {
    throw new Error("completed-action route regression must stay offline");
  });
  vi.stubGlobal("fetch", fetchGuard);
});

afterEach(() => {
  expect(fetchGuard).not.toHaveBeenCalled();
  expect(h.dbMutations).toEqual([]);
  vi.unstubAllGlobals();
});

describe("completed-action Direct and Inline route regression", () => {
  it.each(COMPLETED_ACTION_CASES)(
    "Direct $lang/$kind routes urgent aftercare: $query",
    async ({ query, lang, kind }) => {
      sequence += 1;
      const userId = 9_710_000 + sequence;
      const profileLang = mismatchedProfileLanguage(lang);

      await handleCheck(query, {
        chatId: 9_810_000 + sequence,
        userId,
        session: sessionFor(profileLang, userId),
      });

      expect(h.sentMessages).toHaveLength(1);
      const directVisible = markdownV2ToPlainText(h.sentMessages[0]!.text);
      expect(directVisible).toMatch(DIRECT_TOPIC[lang][kind]);
      expect(directVisible).not.toMatch(WRONG_LANGUAGE[lang]);
      expect(h.sessionWrites).toHaveLength(1);
      expect(h.answerCalls).toEqual([]);
      expect(h.runCheckCalls).toEqual([]);
    },
  );

  it.each(COMPLETED_ACTION_CASES)(
    "Inline $lang/$kind preserves aftercare in preview and inserted result: $query",
    async ({ query, lang, kind }) => {
      sequence += 1;
      const userId = 9_810_000 + sequence;
      const profileLang = mismatchedProfileLanguage(lang);

      await handleInlineQuery(
        query,
        {
          userId,
          languageCode: profileLang,
          session: sessionFor(profileLang, userId),
        },
        `completed-action-inline-${sequence}`,
      );

      expect(h.answerCalls).toHaveLength(1);
      expect(h.answerCalls[0]).toMatchObject({
        inlineQueryId: `completed-action-inline-${sequence}`,
        cacheTime: 10,
        isPersonal: true,
      });
      expect(h.answerCalls[0]!.results).toHaveLength(1);
      const article = h.answerCalls[0]!.results[0] as InlineQueryResultArticle;
      const insertedVisible = inlineVisible(article);
      expect(article.id).toMatch(kind === "code" ? /sent-code/iu : /sent-money/iu);
      expect(insertedVisible).toMatch(INLINE_TOPIC[lang][kind]);
      expect(insertedVisible).not.toMatch(WRONG_LANGUAGE[lang]);
      expect(h.sentMessages).toEqual([]);
      expect(h.sessionWrites).toEqual([]);

      for (const options of h.runCheckCalls) {
        expect(options).toMatchObject({ channel: "telegram" });
      }
    },
  );

  it.each([
    {
      query: "я им скинула цифры из сообщения. SMS code: 731904",
      lang: "ru" as const,
      secret: "731904",
    },
    {
      query: "raqamni tashlab yubordim. OTP: 482901",
      lang: "uz" as const,
      secret: "482901",
    },
    {
      query: 'I read out the one-time password. password: "Correct-Horse-Battery-Staple"',
      lang: "en" as const,
      secret: "Correct-Horse-Battery-Staple",
    },
  ])("$lang masks a pasted secret in both route outputs", async ({ query, lang, secret }) => {
    sequence += 1;
    const userId = 9_910_000 + sequence;
    const profileLang = mismatchedProfileLanguage(lang);

    await handleCheck(query, {
      chatId: 9_920_000 + sequence,
      userId,
      session: sessionFor(profileLang, userId),
    });
    expect(h.sentMessages).toHaveLength(1);
    expect(markdownV2ToPlainText(h.sentMessages[0]!.text)).not.toContain(secret);
    expect(h.sessionWrites).toHaveLength(1);
    const directContext = JSON.stringify(h.sessionWrites[0]!.patch);
    expect(directContext).toContain('"lastSensitiveSecret"');
    expect(directContext).toContain(`"lang":"${lang}"`);
    expect(directContext).not.toContain(secret);
    h.sessionWrites.length = 0;

    await handleInlineQuery(
      query,
      {
        userId,
        languageCode: profileLang,
        session: sessionFor(profileLang, userId),
      },
      `completed-action-secret-inline-${sequence}`,
    );
    expect(h.answerCalls).toHaveLength(1);
    const article = h.answerCalls[0]!.results[0] as InlineQueryResultArticle;
    expect(article.id).toMatch(/private-(?:code|password)/u);
    expect(inlineVisible(article)).not.toContain(secret);
    expect(h.runCheckCalls).toEqual([]);
    expect(h.sessionWrites).toEqual([]);
  });

  it.each([
    "I read about one-time password security.",
    "I told my son how a one-time password works.",
    "I said a one-time password is safer.",
    "I said not to share the one-time password.",
    "I said I never shared the one-time password.",
    "Я сообщил банку о проблеме с одноразовым паролем.",
    "Я сказал, что одноразовый пароль безопаснее.",
    "Я сообщил другу, как работает одноразовый пароль.",
    "Я сказал не сообщать одноразовый пароль.",
    "Я сказал, что никогда не сообщал одноразовый пароль.",
    "I wired the money to my landlord.",
    "I wired them the money for rent.",
    "The money has gone to them as planned for the rent.",
    "The money has already gone to them as planned for the rent.",
    "They know my login number but not my password.",
    "They have my SMS number, which is just my phone number.",
    "He knows our verification number from the public ticket.",
    "They know my login code name, not a code.",
    "Kod haqida aytdim.",
    "Men dasturlash kodi haqida aytdim.",
    "SMS haqida aytdim.",
    "Telefon raqamni tashlab yubordim.",
    "Kod xavfsizligi haqida jo'natdim.",
    "Я им скинул код проекта.",
    "Я им скинул код на GitHub.",
    "Я им скинул цифры отчёта.",
    "Я ему скинул SMS-инструкцию.",
    "Я скинул ему карту проезда.",
    "Я скинул им перевод статьи.",
    "Я скинула ей баланс отчёта.",
    "Я скинул им сумму расчёта.",
    "Я скинул ему деньги за обед.",
    "Ular meni hozir shoshirib, yaqinlarimga qo'ng'iroq qilmaslikni aytishyapti",
  ])("does not turn a benign or third-party statement into aftercare: %s", async (query) => {
    sequence += 1;
    const userId = 9_930_000 + sequence;

    await handleCheck(query, {
      chatId: 9_940_000 + sequence,
      userId,
      session: sessionFor("en", userId),
    });
    expect(h.sentMessages.length).toBeGreaterThan(0);
    expect(
      h.sentMessages.map((message) => markdownV2ToPlainText(message.text)).join("\n"),
    ).not.toMatch(
      /(?:call your bank.{0,120}(?:block the card|freeze the transfer)|позвоните в банк.{0,120}(?:заблокируйте карту|заморозить перевод)|qo'ng'iroqni tugating|завершите звонок|end the call)/isu,
    );

    await handleInlineQuery(
      query,
      { userId, languageCode: "en", session: sessionFor("en", userId) },
      `completed-action-negative-inline-${sequence}`,
    );
    expect(h.answerCalls).toHaveLength(1);
    const article = h.answerCalls[0]!.results[0] as InlineQueryResultArticle;
    expect(article.id).not.toMatch(/sent-(?:code|money)/u);
  });
});
