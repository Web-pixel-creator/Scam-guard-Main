import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  runCheckCalls: [] as Array<Record<string, unknown>>,
  answerCalls: [] as Array<{
    inlineQueryId: string;
    results: unknown[];
    cacheTime?: number;
    isPersonal?: boolean;
  }>,
  nextResult: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: vi.fn(async (params: Record<string, unknown>) => {
    hoisted.runCheckCalls.push(params);
    return (
      hoisted.nextResult ?? {
        type: "telegram",
        display: "@lu•••mo",
        level: "suspicious",
        score: 25,
        reasons: ["suspicious_invite_link"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      }
    );
  }),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  answerInlineQuery: vi.fn(
    async (opts: {
      inlineQueryId: string;
      results: unknown[];
      cacheTime?: number;
      isPersonal?: boolean;
    }) => {
      hoisted.answerCalls.push(opts);
      return { ok: true };
    },
  ),
  escapeMarkdownV2: (value: string) => value,
}));

import { handleInlineQuery } from "@/lib/telegram/handlers/inline";

const session: Session = {
  telegramUserId: 42,
  lang: "ru",
  scenario: "none",
  scenarioStep: 0,
  scenarioData: {},
  updatedAt: new Date(0).toISOString(),
};

describe("handleInlineQuery", () => {
  beforeEach(() => {
    hoisted.runCheckCalls.length = 0;
    hoisted.answerCalls.length = 0;
    hoisted.nextResult = null;
  });

  it("returns a help article for an empty inline query", async () => {
    await handleInlineQuery("   ", { userId: 42, session }, "iq-help");

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.answerCalls).toHaveLength(1);
    expect(hoisted.answerCalls[0]).toMatchObject({
      inlineQueryId: "iq-help",
      cacheTime: 2,
      isPersonal: true,
    });
    expect(hoisted.answerCalls[0].results[0]).toMatchObject({
      type: "article",
      id: "help",
    });
  });

  it("runs a non-persistent rules-only check for a non-empty query", async () => {
    await handleInlineQuery("https://t.me/+abcdef", { userId: 42, session }, "iq-check");

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({
      input: "https://t.me/+abcdef",
      lang: "ru",
      rateLimitKey: "tg:inline:42",
      channel: "telegram",
      skipAi: true,
      persist: false,
    });
    expect(hoisted.answerCalls).toHaveLength(1);
    const article = hoisted.answerCalls[0].results[0] as {
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.title).toContain("Требуется осторожность");
    expect(article.description).toContain("invite");
    expect(article.input_message_content.message_text).toContain("@scamguard_bot");
  });

  it("leads with safe action for a high-risk inline result", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "код из SMS",
      level: "high_risk",
      score: 60,
      reasons: ["asks_for_sms_code"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("скажите код из SMS", { userId: 42, session }, "iq-high");

    const article = hoisted.answerCalls[0].results[0] as {
      title: string;
      input_message_content: { message_text: string };
    };
    expect(article.title).toContain("Высокий риск");
    expect(article.input_message_content.message_text).toContain("Не отправляйте SMS-код");
  });

  it("renders low-signal phone inline checks as a number passport", async () => {
    hoisted.nextResult = {
      type: "phone",
      display: "+998 90 *** ** 67",
      level: "unknown",
      score: 0,
      reasons: ["valid_uz_phone"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
      phoneIntelligence: {
        digits: "998901234567",
        normalized: "+998901234567",
        kind: "uz_mobile",
        isValidFormat: true,
        isUzbekistan: true,
        country: {
          iso: "UZ",
          callingCode: "998",
          name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
        },
        uzPrefix: "90",
        uzOperator: {
          ru: "Beeline по префиксу 90",
          uz: "90 prefiksi bo'yicha Beeline",
          en: "Beeline by prefix 90",
        },
        officialDirectoryStatus: "not_found",
      },
    };

    await handleInlineQuery("+998901234567", { userId: 42, session }, "iq-phone");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe("passport-phone");
    expect(article.title).toBe("Паспорт номера");
    expect(article.description).toContain("Контекст, а не вердикт");
    expect(article.input_message_content.message_text).toContain("Номер: Узбекистан (+998)");
    expect(article.input_message_content.message_text).toContain("Beeline по префиксу 90");
    expect(article.input_message_content.message_text).toContain(
      "Подтверждённых модерированных жалоб в Ishonch Guard не найдено.",
    );
    expect(article.input_message_content.message_text).toContain("не гарантия безопасности");
    expect(article.input_message_content.message_text).toContain("непроверенные жалобы");
    expect(article.input_message_content.message_text).toContain("Напишите, что попросили");
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
  });

  it("renders low-signal Telegram username inline checks as a Telegram passport", async () => {
    hoisted.nextResult = {
      type: "telegram",
      display: "@lu•••mo",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("@lucky_promo", { userId: 42, session }, "iq-telegram");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe("passport-telegram");
    expect(article.title).toBe("Telegram-паспорт");
    expect(article.description).toContain("Контекст");
    expect(article.input_message_content.message_text).toContain(
      "Можно оценить только публично видимые признаки",
    );
    expect(article.input_message_content.message_text).toContain(
      "Bot API не показывает возраст аккаунта",
    );
    expect(article.input_message_content.message_text).toContain(
      "Username сам по себе не доказывает",
    );
    expect(article.input_message_content.message_text).toContain("Пришлите текст сообщения");
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
  });

  it("keeps phone reputation source and scope visible in inline passport checks", async () => {
    hoisted.nextResult = {
      type: "phone",
      display: "+998 90 *** ** 67",
      level: "unknown",
      score: 0,
      reasons: ["valid_uz_phone"],
      explanation: null,
      knownReports: 3,
      verifiedContact: null,
      brandEvidence: [],
      phoneIntelligence: {
        digits: "998901234567",
        normalized: "+998901234567",
        kind: "uz_mobile",
        isValidFormat: true,
        isUzbekistan: true,
        country: {
          iso: "UZ",
          callingCode: "998",
          name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
        },
        uzPrefix: "90",
        uzOperator: {
          ru: "Beeline по префиксу 90",
          uz: "90 prefiksi bo'yicha Beeline",
          en: "Beeline by prefix 90",
        },
        officialDirectoryStatus: "not_found",
      },
      phoneReputation: {
        source: "ishonch_guard_moderated_reports",
        confirmedReportCount: 3,
        confidence: "medium",
        riskLevel: "suspicious",
        publicScope: "confirmed_moderated_reports_only",
      },
    };

    await handleInlineQuery("+998901234567", { userId: 42, session }, "iq-phone-reputation");

    const article = hoisted.answerCalls[0].results[0] as {
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.description).toContain("подтверждённые модераторами жалобы");
    expect(article.input_message_content.message_text).toContain(
      "Источник: подтверждённые модераторами жалобы Ishonch Guard",
    );
    expect(article.input_message_content.message_text).toContain("3 подтверждённых жалоб");
    expect(article.input_message_content.message_text).toContain("Уверенность: средняя");
    expect(article.input_message_content.message_text).toContain("непроверенные жалобы");
    expect(article.input_message_content.message_text).toContain("данные оператора");
    expect(article.input_message_content.message_text).not.toContain("998901234567");
  });
});
