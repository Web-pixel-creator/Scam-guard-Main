import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LastCheckSnapshot, Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<{ input: string; type?: string }>,
  saveSessionCalls: [] as Array<{ userId: number; patch: unknown }>,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: { input: string; type?: string }) => {
    hoisted.runCheckCalls.push(params);
    return Promise.resolve({
      type: params.type ?? "url",
      display: params.input,
      level: "high_risk",
      score: 80,
      reasons: ["phishing_url"],
      explanation: "Fresh risk check.",
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    });
  },
  analyzeImageCore: () => Promise.resolve(null),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return Promise.resolve({ ok: true });
  },
  sendChatAction: () => Promise.resolve(),
  getFile: () => Promise.resolve(null),
  downloadFileAsDataUrl: () => Promise.resolve(null),
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: (userId: number, patch: unknown) => {
    hoisted.saveSessionCalls.push({ userId, patch });
    return Promise.resolve({ ok: true });
  },
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: () => Promise.resolve(null),
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));

vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: (_input: string, result: unknown) => Promise.resolve(result),
}));

vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: (_input: string, result: unknown) => Promise.resolve(result),
}));

import { handleCheck } from "@/lib/telegram/handlers/check";
import { LIVE_PHRASE_CASES } from "@/lib/telegram/live-phrase-cases";

function sessionWithData(scenarioData: Session["scenarioData"] = {}): Session {
  return {
    telegramUserId: 42,
    lang: "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData,
    updatedAt: new Date().toISOString(),
  };
}

function sessionWith(lastCheck?: LastCheckSnapshot): Session {
  return sessionWithData(lastCheck ? { lastCheck } : {});
}

function snapshot(overrides: Partial<LastCheckSnapshot> = {}): LastCheckSnapshot {
  return {
    level: "safe",
    type: "text",
    context: "qr_menu",
    at: new Date().toISOString(),
    ...overrides,
  };
}

describe("handleCheck follow-up routing", () => {
  beforeEach(() => {
    hoisted.sentMessages.length = 0;
    hoisted.runCheckCalls.length = 0;
    hoisted.saveSessionCalls.length = 0;
  });

  it("answers confidence follow-ups from the last result instead of running a new check", async () => {
    await handleCheck("Точно?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "qr_menu", level: "safe" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Не могу гарантировать на 100%");
    expect(hoisted.sentMessages[0].text).toContain("QR");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers specific why follow-ups about the last result instead of running a new check", async () => {
    await handleCheck("Почему домен подозрительный?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "generic", level: "suspicious" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Коротко");
    expect(hoisted.sentMessages[0].text).toContain("подозрительные признаки");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers next-step follow-ups after high-risk results", async () => {
    await handleCheck("Что еще посоветуешь?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "generic", level: "high_risk" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Следующий безопасный шаг");
    expect(hoisted.sentMessages[0].text).toContain("Остановите разговор");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers bank-number follow-ups with official callback guidance", async () => {
    await handleCheck("Дай мне номер банка", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "phone", type: "phone", level: "unknown" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Официальный обратный звонок");
    expect(hoisted.sentMessages[0].text).toContain("1340");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers AI-origin questions about the last visual check instead of running a new check", async () => {
    await handleCheck("Похоже, меню сделано с помощью ИИ?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "qr_menu", type: "text", level: "safe" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("может быть шаблонный или AI");
    expect(hoisted.sentMessages[0].text).toContain("не доказывает мошенничество");
    expect(hoisted.sentMessages[0].text).toContain("какой адрес откроется по QR");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers acknowledgement after an emergency step instead of showing an insufficient-data card", async () => {
    await handleCheck("Хорошо сделаю", {
      chatId: 100,
      userId: 42,
      session: sessionWithData({
        lastPanicId: 8,
        lastPanicAt: new Date().toISOString(),
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Я рядом");
    expect(hoisted.sentMessages[0].text).toContain("по одному безопасному шагу");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("lets a new victim situation override stale emergency follow-up context", async () => {
    await handleCheck("мне пишет родственник но странным образом", {
      chatId: 100,
      userId: 42,
      session: sessionWithData({
        lastPanicId: 2,
        lastPanicAt: new Date().toISOString(),
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("не уверены");
    expect(hoisted.sentMessages[0].text).not.toContain("После установки подозрительного APK");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("lets a voting scam override stale live-call emergency context", async () => {
    await handleCheck("одноклассник просит проголосовать по ссылке за лучшую маму", {
      chatId: 100,
      userId: 42,
      session: sessionWithData({
        lastPanicId: 6,
        lastPanicAt: new Date().toISOString(),
        lastLiveCallContext: "government",
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Telegram-аккаунт");
    expect(hoisted.sentMessages[0].text).toContain("голосование");
    expect(hoisted.sentMessages[0].text).not.toContain("Позовите человека");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("routes operator contract/code phrases before stale emergency follow-ups", async () => {
    await handleCheck("сотрудник Uztelecom говорит договор истекает и просит продиктовать код", {
      chatId: 100,
      userId: 42,
      session: sessionWithData({
        lastPanicId: 6,
        lastPanicAt: new Date().toISOString(),
        lastLiveCallContext: "government",
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("оператора связи");
    expect(hoisted.sentMessages[0].text).toContain("Uztelecom");
    expect(hoisted.sentMessages[0].text).not.toContain("налоговая, госорган или полиция");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("routes third-party relative money calls as trusted-person verification, not generic live-call SOS", async () => {
    await handleCheck("моей бабушке звонил мошенник он просил срочно прислать деньги на помощь", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Если «друг» или близкий");
    expect(hoisted.sentMessages[0].text).toContain("подтвердите личность");
    expect(hoisted.sentMessages[0].text).not.toContain("ЗАВЕРШИТЕ ЗВОНОК");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers ambiguous confirmation requests after a phone check without running a new check", async () => {
    await handleCheck("Попросил подтверждение", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "phone", type: "phone", level: "unknown" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Подтверждение");
    expect(hoisted.sentMessages[0].text).toContain("SMS-код");
    expect(hoisted.sentMessages[0].text).toContain("не подтверждайте");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("routes first-person already-transferred text to the money-transfer SOS", async () => {
    await handleCheck("я уже перевёл деньги мошенникам, помогите", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).toContain('"lastPanicId":3');
  });

  it("routes first-person already-sent-code text to the SMS-code SOS", async () => {
    await handleCheck("что если я уже назвал им код из смс?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).toContain('"lastPanicId":1');
  });

  it("keeps scammer OTP instructions on the normal risk pipeline instead of SOS", async () => {
    await handleCheck("Salom, bu kodni kiriting please: 1234", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("kodni kiriting");
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).not.toContain('"lastPanicId"');
  });

  it("keeps forwarded already-happened text on the normal risk pipeline", async () => {
    await handleCheck(
      "я уже перевёл деньги мошенникам, помогите",
      {
        chatId: 100,
        userId: 42,
        session: sessionWith(),
      },
      { kind: "channel", title: "QA", username: "qa_channel" },
    );

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.saveSessionCalls).toHaveLength(1);
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).not.toContain('"lastPanicId"');
  });

  it("keeps quoted third-party already-happened text on the normal risk pipeline", async () => {
    await handleCheck("мошенник написал: я уже перевёл деньги", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.saveSessionCalls).toHaveLength(1);
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).not.toContain('"lastPanicId"');
  });

  it("still sends a real artifact to the risk pipeline", async () => {
    await handleCheck("Точно? https://kapitalbank.uz.evil.com/login", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot()),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("https://kapitalbank.uz.evil.com/login");
  });

  it("answers victim-framed SMS code follow-ups without a cold risk card", async () => {
    await handleCheck("Ular SMS kod so'radi, nima qilay?", {
      chatId: 100,
      userId: 42,
      session: { ...sessionWith(snapshot({ context: "phone", level: "unknown" })), lang: "uz" },
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Kodni hech kimga aytmang");
  });

  it("answers English victim-framed verification-code follow-ups without a cold risk card", async () => {
    await handleCheck("They asked for a verification code, what should I do?", {
      chatId: 100,
      userId: 42,
      session: {
        ...sessionWith(snapshot({ context: "telegram_profile", level: "unknown" })),
        lang: "en",
      },
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Do not tell anyone the code");
  });

  it("adds Guardian Angel guidance and stores only safe metadata after high-risk checks", async () => {
    await handleCheck("https://kapitalbank.uz.evil.com/login", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.sentMessages).toHaveLength(2);
    expect(hoisted.sentMessages[1].text).toContain("Я рядом");
    expect(hoisted.sentMessages[1].text).toContain("безопасного конца");
    expect(hoisted.sentMessages[1].text).toContain("один безопасный шаг");
    const callbacks = (hoisted.sentMessages[1].keyboard as { callback_data?: string }[][])
      .flat()
      .map((button) => button.callback_data);
    expect(callbacks).toContain("guardian:next");
    expect(callbacks).toContain("family:notify");

    expect(hoisted.saveSessionCalls).toHaveLength(1);
    const saved = JSON.stringify(hoisted.saveSessionCalls[0].patch);
    expect(saved).toContain('"guardian"');
    expect(saved).toContain('"high_risk"');
    expect(saved).not.toContain("kapitalbank.uz.evil.com");
    expect(saved).not.toContain("Fresh risk check");
  });

  it("answers orphan helper phrases without a fake insufficient-data card", async () => {
    await handleCheck("дай номер банка", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Официальный обратный звонок");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers bot identity questions without running a fake risk check", async () => {
    await handleCheck("а вы кто?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Ishonch Guard");
    expect(hoisted.sentMessages[0].text).toContain("не читаю ваши чаты");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it.each(LIVE_PHRASE_CASES.map((item) => [item.area, item.text, item] as const))(
    "routes live phrase matrix row '%s' / '%s'",
    async (_area, _text, item) => {
      await handleCheck(item.text, {
        chatId: 100,
        userId: 42,
        session: { ...sessionWith(), lang: item.lang ?? "ru" },
      });

      if (item.expected.kind === "victim_intent" || item.expected.kind === "handler_reply") {
        expect(hoisted.runCheckCalls).toHaveLength(0);
        expect(hoisted.sentMessages).toHaveLength(1);
        expect(hoisted.sentMessages[0].text).toContain(item.expected.replyIncludes);
        expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
        return;
      }

      if (item.expected.kind === "panic") {
        expect(hoisted.runCheckCalls).toHaveLength(0);
        expect(hoisted.sentMessages).toHaveLength(1);
        expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).toContain(
          `"lastPanicId":${item.expected.panicId}`,
        );
        return;
      }

      expect(hoisted.runCheckCalls).toHaveLength(1);
      expect(hoisted.runCheckCalls[0].input).toBe(item.text);
      expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).not.toContain('"lastPanicId"');
    },
  );

  it("routes Cyrillic Beeline live-call phrases to operator-specific SOS copy", async () => {
    await handleCheck("мне звонит директор билайна", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("настоящий оператор связи");
    expect(hoisted.sentMessages[0].text).not.toContain("настоящий банк");
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).toContain(
      '"lastLiveCallContext":"operator"',
    );
  });

  it("answers legacy live victim phrase before runCheck", async () => {
    await handleCheck("мне пишут в телеграме", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("вам пишут в Telegram");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("still sends direct scam content through the risk pipeline", async () => {
    await handleCheck(
      "Служба безопасности банка. Ваш счёт заблокирован. Перейдите на https://bank-check.example/login и введите код.",
      {
        chatId: 100,
        userId: 42,
        session: sessionWith(),
      },
    );

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("bank-check.example");
  });
});
