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
  nextError: null as null | Error,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: vi.fn(async (params: Record<string, unknown>) => {
    hoisted.runCheckCalls.push(params);
    if (hoisted.nextError) throw hoisted.nextError;
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
    hoisted.nextError = null;
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

  it("shows retry seconds for rate-limited inline checks", async () => {
    hoisted.nextError = Object.assign(new Error("rate_limited"), {
      status: 429,
      retryAfter: 17,
    });

    await handleInlineQuery("проверить номер", { userId: 42, session }, "iq-rate");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe("rate-limited");
    expect(article.title).toBe("Слишком много проверок");
    expect(article.description).toContain("17 сек");
    expect(article.input_message_content.message_text).toContain("17 сек");
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
    expect(article.title).toBe("Номер: жалоб не найдено");
    expect(article.description).toContain("Это не гарантия безопасности");
    expect(article.description).toContain("код, карту, перевод, APK или QR");
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
    expect(article.title).toBe("Telegram: нужен контекст");
    expect(article.description).toContain("Username сам не доказывает риск");
    expect(article.description).toContain("текст просьбы");
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
    expect(article.description).toContain("Есть подтверждённые жалобы Ishonch Guard");
    expect(article.description).toContain("Не отправляйте код, карту или деньги");
    expect(article.input_message_content.message_text).toContain(
      "Источник: подтверждённые модераторами жалобы Ishonch Guard",
    );
    expect(article.input_message_content.message_text).toContain("3 подтверждённых жалоб");
    expect(article.input_message_content.message_text).toContain("Уверенность: средняя");
    expect(article.input_message_content.message_text).toContain("непроверенные жалобы");
    expect(article.input_message_content.message_text).toContain("данные оператора");
    expect(article.input_message_content.message_text).not.toContain("998901234567");
  });

  it("turns low-signal free text into an actionable inline prompt", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "Мне пишет мошенник",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("Мне пишет мошенник", { userId: 42, session }, "iq-text");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe("check-unknown-general-scam-concern");
    expect(article.title).toBe("Подозреваете обман: пришлите просьбу");
    expect(article.description).toContain("Вы правильно остановились");
    expect(article.input_message_content.message_text).toContain(
      "Что проверяли: Мне пишет мошенник",
    );
  });

  it("turns bare link requests into a send-the-url inline prompt", async () => {
    hoisted.nextResult = {
      type: "text",
      display: "у меня просят перейти по ссылке",
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery("у меня просят перейти по ссылке", { userId: 42, session }, "iq-link");

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe("check-unknown-link-request");
    expect(article.title).toBe("Ссылка: сначала проверим");
    expect(article.description).toContain("Пока не открывайте");
    expect(article.description).toContain("саму ссылку");
    expect(article.input_message_content.message_text).toContain(
      "Что проверяли: у меня просят перейти по ссылке",
    );
  });

  it("does not override concrete URL checks with the bare-link fallback", async () => {
    hoisted.nextResult = {
      type: "url",
      display: "https://example.test/pay",
      level: "unknown",
      score: 0,
      reasons: ["hosted_app_platform"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(
      "просят перейти по ссылке https://example.test/pay",
      { userId: 42, session },
      "iq-url",
    );

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
    };
    expect(article.id).toBe("check-unknown");
    expect(article.title).toBe("Нужно больше контекста");
    expect(article.description).not.toContain("Пока не открывайте");
  });

  it.each([
    {
      text: "мне скинули ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "пришел код и просят его сказать",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "я только что передал код из СМС",
      id: "check-unknown-sent-code",
      title: "Код уже отправлен: действуйте срочно",
    },
    {
      text: "просят подтвердить операцию",
      id: "check-unknown-confirm-request",
      title: "Подтверждение: осторожно",
    },
    {
      text: "просят данные карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "просят перевести деньги",
      id: "check-unknown-transfer-request",
      title: "Перевод: нужна причина",
    },
    {
      text: "мне сказали сделать перевод на карту",
      id: "check-unknown-transfer-request",
      title: "Перевод: нужна причина",
    },
    {
      text: "просят установить приложение для защиты",
      id: "check-unknown-app-request",
      title: "Приложение: не устанавливайте",
    },
    {
      text: "мне звонят из банка",
      id: "check-unknown-bank-call",
      title: "Звонок из банка: перезвоните сами",
    },
    {
      text: "мне звонит директор билайна",
      id: "check-unknown-operator-call",
      title: "Оператор связи: перезвоните сами",
    },
    {
      text: "мне звонят с другой страны\nПросто звонок с другой страны, брать трубку?",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "просят фото паспорта",
      id: "check-unknown-personal-data",
      title: "Документы: не отправляйте фото",
    },
    {
      text: "нужно оплатить доставку",
      id: "check-unknown-delivery-payment",
      title: "Доставка: проверьте ссылку",
    },
    {
      text: "я выиграл приз, просят оплатить налог",
      id: "check-unknown-prize-fee",
      title: "Приз: не платите сбор",
    },
    {
      text: "просят войти в OneID и сказать SMS код",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "оператор просит код для замены SIM карты",
      id: "check-unknown-sim-swap",
      title: "SIM/оператор: осторожно",
    },
    {
      text: "мне пишет сын попал в аварию срочно перевести деньги",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "моей бабушке звонил мошенник\nОн просил срочно прислать деньги на помощь",
      id: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
    },
    {
      text: "мне звонят из Нигерии",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "звонят с номера +98 из Ирана",
      id: "check-unknown-foreign-call",
      title: "Иностранный звонок: не продолжайте под давлением",
    },
    {
      text: "мне пишут от имени Telegram с галочкой",
      id: "check-unknown-telegram-takeover",
      title: "Telegram: не входите по ссылке",
    },
    {
      text: "официальный Telegram просит пройти проверку иначе аккаунт удалят",
      id: "check-unknown-telegram-takeover",
      title: "Telegram: не входите по ссылке",
    },
    {
      text: "мне прислали APK я ухожу из этого мира",
      id: "check-unknown-malicious-file",
      title: "Файл/вирус: не открывайте",
    },
    {
      text: "оповещение безопасности Apple iOS повреждена на 72 установить программу",
      id: "check-unknown-apple-security",
      title: "Apple/iOS: не устанавливайте «защиту»",
    },
    {
      text: "звонят из водоканала про счетчик просят паспорт",
      id: "check-unknown-utility-impersonation",
      title: "Коммунальная служба: перезвоните сами",
    },
    {
      text: "пенсионный фонд обещает повысить пенсию просит код",
      id: "check-unknown-pension-benefit",
      title: "Пенсия/выплата: не называйте данные",
    },
    {
      text: "незнакомец просит телефон на минуту позвонить",
      id: "check-unknown-phone-borrowing",
      title: "Просят телефон: не отдавайте unlocked",
    },
    {
      text: "деньги пришли по ошибке просят вернуть на другой счет",
      id: "check-unknown-money-mule",
      title: "Чужие деньги: не переводите дальше",
    },
    {
      text: "покупают голос Open Budget и просят SMS код",
      id: "check-unknown-open-budget",
      title: "Open Budget/голос: код не отдавайте",
    },
    {
      text: "врач DMED просит SMS код",
      id: "check-unknown-medical-code",
      title: "Врач/DMED: код не диктуйте",
    },
    {
      text: "ребенку предлагают бесплатные бонусы в игре просят код",
      id: "check-unknown-child-game-bonus",
      title: "Игровые бонусы: не вводите код",
    },
    {
      text: "звонят и молчат чтобы записать голос",
      id: "check-unknown-silent-call",
      title: "Молчаливый звонок: сбросьте",
    },
    {
      text: "инспектор МИБ требует наличные за списание долга",
      id: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
    },
    {
      text: "предлагают работу но просят оплатить обучение",
      id: "check-unknown-job-offer",
      title: "Работа: не платите взнос",
    },
    {
      text: "просят инвестировать в TON wallet с гарантированной прибылью",
      id: "check-unknown-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "новый знакомый говорит любит и просит деньги на билет",
      id: "check-unknown-romance-money",
      title: "Отношения: деньги не отправляйте",
    },
    {
      text: "мне пишет какой то незнакомый человек",
      id: "check-unknown-unknown-contact",
      title: "Незнакомец: нужен текст просьбы",
    },
    {
      text: "мне пишет одноклассник, но я не уверен что это он",
      id: "check-unknown-identity-uncertain",
      title: "Личность не ясна: перезвоните",
    },
    {
      text: "меня приглашают в канал для заработка",
      id: "check-unknown-earning-channel",
      title: "Канал заработка: осторожно",
    },
    {
      text: "агентство обещает визу в Корею но просит предоплату",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "турфирма просит оплатить хадж заранее",
      id: "check-unknown-travel-migration-prepayment",
      title: "Виза/тур: не платите заранее",
    },
    {
      text: "у меня просят ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "как мне связаться с банком?",
      id: "check-unknown-bank-contact",
      title: "Связаться с банком: только официальный номер",
    },
    {
      text: "агентство Хотели в Soliq войти",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "Хотели в Soliq войти",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "мне звонили из солик",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "мне звонят из Солик и просят данные",
      id: "check-unknown-gov-service",
      title: "OneID/госуслуги: не вводите код",
    },
    {
      text: "меня пытаются обмануть",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "звонил мошенник",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "меня просят проголосовать на канале и перейти по ссылке",
      id: "check-unknown-voting-link",
      title: "Голосование/канал: сначала проверим",
    },
    {
      text: "мне пишет незнакомый человек\nОн хочет смс код",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "незнакомец кинул ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "мне пишет незнакомец, он скинул линк",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "спросили cvv",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "спрашивает реквизиты карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "код подтверждения надо переслать в чат",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "kodni ayt deyapti",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "sms kodni aytishim kerakmi?",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "I got a code should I tell him?",
      id: "check-unknown-code-request",
      title: "Код: никому не называйте",
    },
    {
      text: "men kodni yubordim endi nima qilay",
      id: "check-unknown-sent-code",
      title: "Код уже отправлен: действуйте срочно",
    },
    {
      text: "что мне делать дальше?",
      id: "check-unknown-next-step",
      title: "Что делать: остановитесь и пришлите просьбу",
    },
    {
      text: "можно ли ему отвечать?",
      id: "check-unknown-reply-safety",
      title: "Ответ: не раскрывайте данные",
    },
    {
      text: "это безопасно или мошенники?",
      id: "check-unknown-safety-question",
      title: "Безопасно ли: проверим по фактам",
    },
    {
      text: "мне пишут в телеграме",
      id: "check-unknown-safety-question",
      title: "Безопасно ли: проверим по фактам",
    },
    {
      text: "мне пишет нотариус и требует оплатить штраф",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "меня зовут вступить в какой то канал",
      id: "check-unknown-chat-invite",
      title: "Канал/чат: сначала проверим",
    },
    {
      text: "мне звонят и торопят",
      id: "check-unknown-unknown-call",
      title: "Неизвестный звонок: лучше перезвонить",
    },
    {
      text: "мне звонят и угрожают",
      id: "check-unknown-unknown-call",
      title: "Неизвестный звонок: лучше перезвонить",
    },
    {
      text: "someone is calling me",
      id: "check-unknown-unknown-call",
      title: "Неизвестный звонок: лучше перезвонить",
    },
    {
      text: "мне звонит фейковый майор",
      id: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
    },
    {
      text: "мне пишет криптоинвестор",
      id: "check-unknown-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "мне пишет кто-то и шлёт ссылку",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "мне пишет и шлёт файл",
      id: "check-unknown-malicious-file",
      title: "Файл/вирус: не открывайте",
    },
    {
      text: "у меня плохое предчувствие",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "как проверить номер",
      id: "check-unknown-safety-question",
      title: "Безопасно ли: проверим по фактам",
    },
    {
      text: "какой номер полиции",
      id: "check-unknown-general-scam-concern",
      title: "Подозреваете обман: пришлите просьбу",
    },
    {
      text: "я уже перевёл деньги",
      id: "check-unknown-sent-money",
      title: "Деньги уже переведены: срочно в банк",
    },
    {
      text: "как вернуть деньги после мошенника",
      id: "check-unknown-sent-money",
      title: "Деньги уже переведены: срочно в банк",
    },
    {
      text: "я уже дал номер карты",
      id: "check-unknown-card-request",
      title: "Карта: не отправляйте данные",
    },
    {
      text: "я уже перешёл по ссылке",
      id: "check-unknown-link-request",
      title: "Ссылка: сначала проверим",
    },
    {
      text: "привет",
      id: "check-unknown-next-step",
      title: "Что делать: остановитесь и пришлите просьбу",
    },
    {
      text: "спасибо",
      id: "check-unknown-next-step",
      title: "Что делать: остановитесь и пришлите просьбу",
    },
    {
      text: "а вы кто",
      id: "check-unknown-next-step",
      title: "Что делать: остановитесь и пришлите просьбу",
    },
  ])("maps everyday inline phrase '$text' to a useful preview", async ({ text, id, title }) => {
    hoisted.nextResult = {
      type: "text",
      display: text,
      level: "unknown",
      score: 0,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    };

    await handleInlineQuery(text, { userId: 42, session }, `iq-${id}`);

    const article = hoisted.answerCalls[0].results[0] as {
      id: string;
      title: string;
      description: string;
      input_message_content: { message_text: string };
    };
    expect(article.id).toBe(id);
    expect(article.title).toBe(title);
    expect(article.description).not.toContain("Вставьте полное сообщение");
    expect(article.input_message_content.message_text).toContain(title);
    expect(article.input_message_content.message_text).not.toContain("Недостаточно данных");
    expect(article.input_message_content.message_text).not.toContain(
      "Одного значения мало для уверенного вывода",
    );
  });

  it.each([
    {
      text: "просят инвестировать в TON wallet с гарантированной прибылью",
      id: "check-suspicious-investment-offer",
      title: "Инвестиции/крипта: осторожно",
    },
    {
      text: "я только что передал код из СМС",
      id: "check-suspicious-sent-code",
      title: "Код уже отправлен: действуйте срочно",
    },
  ])(
    "keeps suspicious risk level but uses a specific inline preview for '$text'",
    async ({ text, id, title }) => {
      hoisted.nextResult = {
        type: "text",
        display: text,
        level: "suspicious",
        score: 20,
        reasons: ["pressure_urgency"],
        explanation: null,
        knownReports: 0,
        verifiedContact: null,
        brandEvidence: [],
      };

      await handleInlineQuery(text, { userId: 42, session }, `iq-${id}`);

      const article = hoisted.answerCalls[0].results[0] as {
        id: string;
        title: string;
        description: string;
        input_message_content: { message_text: string };
      };
      expect(article.id).toBe(id);
      expect(article.title).toBe(title);
      expect(article.description).toContain("Есть подозрительные признаки");
      expect(article.input_message_content.message_text).toContain("Требуется осторожность");
      expect(article.input_message_content.message_text).toContain(title);
      expect(article.input_message_content.message_text).not.toContain("Одного значения мало");
    },
  );
});
