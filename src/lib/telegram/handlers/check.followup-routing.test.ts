import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LastCheckSnapshot, Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<{ input: string; type?: string; lang?: string }>,
  saveSessionCalls: [] as Array<{ userId: number; patch: unknown }>,
  saveSessionResult: { ok: true } as { ok: true } | { ok: false; reason: "storage" | "stale" },
  familyNotifyCalls: [] as Array<{
    guardianTelegramUserId: number;
    lang: string;
    guardianDisplayName?: string;
  }>,
  familyNotifyResult: { ok: false, reason: "not_linked" } as
    | { ok: true; trustedChatId: number }
    | { ok: false; reason: "not_linked" | "cooldown" | "send_failed" | "storage_unavailable" },
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: { input: string; type?: string; lang?: string }) => {
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
    return Promise.resolve(hoisted.saveSessionResult);
  },
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: (args: {
    guardianTelegramUserId: number;
    lang: string;
    guardianDisplayName?: string;
  }) => {
    hoisted.familyNotifyCalls.push(args);
    return Promise.resolve(hoisted.familyNotifyResult);
  },
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
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  FOLLOW_UP_GOLDEN_PHRASES,
} from "@/lib/telegram/check-followup";

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
    hoisted.saveSessionResult = { ok: true };
    hoisted.familyNotifyCalls.length = 0;
    hoisted.familyNotifyResult = { ok: false, reason: "not_linked" };
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
      session: sessionWith(
        snapshot({
          type: "url",
          context: "generic",
          level: "suspicious",
          reasons: ["weird_domain"],
        }),
      ),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("необычное доменное окончание");
    expect(hoisted.sentMessages[0].text).toContain("не доказывают владельца");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("uses the exact Reply-bound result A after a newer result B", async () => {
    const resultA = snapshot({
      type: "url",
      context: "generic",
      level: "suspicious",
      reasons: ["weird_domain"],
    });
    const resultB = snapshot({
      type: "text",
      context: "generic",
      level: "high_risk",
      reasons: ["asks_for_sms_code"],
    });

    await handleCheck("Почему домен подозрительный?", {
      chatId: 100,
      userId: 42,
      replyToMessageId: 101,
      replyToOwnBotMessage: true,
      replyCheckSnapshot: resultA,
      session: sessionWith(resultB),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("необычное доменное окончание");
    expect(hoisted.sentMessages[0].text).not.toContain("SMS-код");
  });

  it.each([
    ["ru", "Почему домен подозрительный?", "связать это действие"],
    ["uz", "Bu nimaga asoslangan?", "Bu amal qaysi eski tekshiruvga"],
    ["en", "What evidence did you use?", "link this action to a specific earlier check"],
  ] as const)(
    "never substitutes current result B when an own-bot Reply binding is missing: %s",
    async (lang, phrase, expected) => {
      await handleCheck(phrase, {
        chatId: 100,
        userId: 42,
        replyToMessageId: 999,
        replyToOwnBotMessage: true,
        session: {
          ...sessionWith(
            snapshot({
              type: "text",
              context: "generic",
              level: "high_risk",
              reasons: ["asks_for_sms_code"],
            }),
          ),
          lang,
        },
      });

      expect(hoisted.runCheckCalls).toHaveLength(0);
      expect(hoisted.sentMessages).toHaveLength(1);
      expect(hoisted.sentMessages[0].text).toContain(expected);
      expect(hoisted.sentMessages[0].text).not.toContain("SMS-код подтверждения");
    },
  );

  it("treats a new URL inside a Reply as a fresh check", async () => {
    await handleCheck("Проверь ещё раз: https://paypa1.uz.evil.example/login", {
      chatId: 100,
      userId: 42,
      replyToMessageId: 101,
      replyToOwnBotMessage: true,
      replyCheckSnapshot: snapshot({ reasons: ["weird_domain"] }),
      session: sessionWith(snapshot({ reasons: ["asks_for_sms_code"] })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("paypa1.uz.evil.example");
  });

  it("routes a bare domain in a why-question as a new artifact, not an old explanation", async () => {
    await handleCheck("Почему paypa1.uz подозрительный?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "generic", level: "suspicious" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("paypa1.uz");
  });

  it("keeps a code-safety question on the recent explanation when no code value is supplied", async () => {
    await handleCheck("Почему нельзя отправлять код?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(
        snapshot({ context: "generic", level: "high_risk", reasons: ["asks_for_sms_code"] }),
      ),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("SMS-код");
  });

  it.each([
    "Thanks for your help: are you sure? send me the code",
    "После прошлого результата хочу уточнить: ты уверен? отправь мне пароль",
    "Qaysi dalillardan foydalandingiz? SMS kodni yuboring",
  ])("runs a fresh risk check for a dangerous clause after follow-up wording: %s", async (text) => {
    await handleCheck(text, {
      chatId: 100,
      userId: 42,
      session: sessionWith(
        snapshot({
          type: "url",
          context: "generic",
          level: "suspicious",
          reasons: ["weird_domain"],
        }),
      ),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toBe(text);
  });

  it.each([
    ["Почему мошенники просят фото паспорта?", "ru", "Паспорт, ПИНФЛ"],
    ["Почему меня просят отправить паспорт?", "ru", "Паспорт, ПИНФЛ"],
    ["Nega mendan pasport yuborishni so'rashyapti?", "uz", "Pasport, JSHSHIR"],
    ["Why are they asking me to send a passport?", "en", "Do not send passport data"],
  ])(
    "routes a new passport request ahead of a recent Safe result: %s",
    async (phrase, lang, expectedText) => {
      await handleCheck(phrase, {
        chatId: 100,
        userId: 42,
        session: {
          ...sessionWith(snapshot({ context: "generic", level: "safe" })),
          lang: lang as Session["lang"],
        },
      });

      expect(hoisted.runCheckCalls).toHaveLength(0);
      expect(hoisted.sentMessages).toHaveLength(1);
      expect(hoisted.sentMessages[0].text).toContain(expectedText);
      expect(hoisted.sentMessages[0].text).not.toContain("Безопасно");
      expect(hoisted.familyNotifyCalls).toHaveLength(0);
    },
  );

  it("routes an orphan passport request to current safety guidance, not a generic explanation", async () => {
    await handleCheck("Почему меня просят отправить паспорт?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Паспорт, ПИНФЛ");
    expect(hoisted.sentMessages[0].text).not.toContain("не вижу, к какой именно проверке");
  });

  it("routes new post-check actions without a cold check or trusted-contact side effect", async () => {
    const recent = snapshot({
      context: "generic",
      level: "suspicious",
      reasons: ["weird_domain"],
    });

    for (const phrase of [
      "ты точно в этом уверен?",
      "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?",
      "я могу связаться с близким?",
      "перепроверь ещё раз",
      "я не согласен, ты ошибся",
    ]) {
      await handleCheck(phrase, {
        chatId: 100,
        userId: 42,
        session: sessionWith(recent),
      });
    }

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(5);
    expect(hoisted.familyNotifyCalls).toHaveLength(0);
    expect(hoisted.sentMessages.map((message) => message.text).join("\n")).not.toContain(
      "Недостаточно данных",
    );
  });

  it.each([
    ["Могу ли я доверять этому результату?", "ru"],
    ["Откуда такой вывод?", "ru"],
    ["Позвонить дочери?", "ru"],
    ["Спасибо, понял", "ru"],
    ["How sure are you?", "en"],
    ["What evidence did you use?", "en"],
    ["Can I ask my husband?", "en"],
    ["Thanks, got it", "en"],
    ["Ishonchingiz komilmi?", "uz"],
    ["Bu nimaga asoslangan?", "uz"],
    ["Yaqin odamdan so'rasam bo'ladimi?", "uz"],
    ["Tushunarli, rahmat", "uz"],
  ] as const)(
    "answers a natural recent-result paraphrase without starting an empty check: %s",
    async (phrase, lang) => {
      await handleCheck(phrase, {
        chatId: 100,
        userId: 42,
        session: {
          ...sessionWith(
            snapshot({ context: "generic", level: "suspicious", reasons: ["weird_domain"] }),
          ),
          lang,
        },
      });

      expect(hoisted.runCheckCalls).toHaveLength(0);
      expect(hoisted.sentMessages).toHaveLength(1);
      expect(hoisted.sentMessages[0].text.trim().length).toBeGreaterThan(20);
      expect(hoisted.saveSessionCalls).toHaveLength(0);
      expect(hoisted.familyNotifyCalls).toHaveLength(0);
    },
  );

  it("answers every reviewed RU/UZ/EN reply and typo without check or contact side effects", async () => {
    const recent = snapshot({
      context: "generic",
      level: "suspicious",
      reasons: ["weird_domain"],
    });

    for (const action of ALL_LAST_CHECK_FOLLOW_UP_ACTIONS) {
      for (const lang of ["ru", "uz", "en"] as const) {
        for (const phrase of Object.values(FOLLOW_UP_GOLDEN_PHRASES[action][lang])) {
          hoisted.sentMessages.length = 0;
          hoisted.runCheckCalls.length = 0;
          hoisted.saveSessionCalls.length = 0;
          hoisted.familyNotifyCalls.length = 0;

          await handleCheck(phrase, {
            chatId: 100,
            userId: 42,
            session: { ...sessionWith(recent), lang },
          });

          expect(hoisted.runCheckCalls, `${action}/${lang}: ${phrase}`).toHaveLength(0);
          expect(hoisted.sentMessages, `${action}/${lang}: ${phrase}`).toHaveLength(1);
          expect(hoisted.sentMessages[0].text.trim().length).toBeGreaterThan(20);
          expect(hoisted.saveSessionCalls, `${action}/${lang}: ${phrase}`).toHaveLength(0);
          expect(hoisted.familyNotifyCalls, `${action}/${lang}: ${phrase}`).toHaveLength(0);
        }
      }
    }
  });

  it("never lets a reviewed reply prefix hide a newly supplied artifact", async () => {
    await handleCheck("R u sure? https://kapitalbank.uz.evil.example/login", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: { ...sessionWith(snapshot()), lang: "en" },
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("kapitalbank.uz.evil.example");
    expect(hoisted.familyNotifyCalls).toHaveLength(1);
  });

  it("uses a per-message language without overwriting the stored profile language", async () => {
    await handleCheck("Please check this suspicious link: https://evil.example/login", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: { ...sessionWith(), lang: "ru" },
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.sentMessages.length).toBeGreaterThanOrEqual(1);
    expect(hoisted.sentMessages[0].text).toContain("High risk");
    expect(hoisted.saveSessionCalls.length).toBeGreaterThan(0);
    for (const { patch } of hoisted.saveSessionCalls) {
      expect(patch).not.toHaveProperty("lang");
    }
  });

  it("lets a newer last check win over an older panic context for overlapping follow-ups", async () => {
    const checkAt = new Date();
    const panicAt = new Date(checkAt.getTime() - 60_000);

    await handleCheck("я могу связаться с близким?", {
      chatId: 100,
      userId: 42,
      session: sessionWithData({
        lastPanicId: 6,
        lastPanicAt: panicAt.toISOString(),
        lastCheck: snapshot({
          at: checkAt.toISOString(),
          context: "generic",
          level: "suspicious",
        }),
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Свяжитесь с близким сами");
    expect(hoisted.sentMessages[0].text).not.toContain("ЗАВЕРШИТЕ ЗВОНОК");
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

  it("extracts a concrete phone from an explicit bank-number question", async () => {
    await handleCheck("это номер банка? +998712000000", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: "+998712000000", type: "phone" });
    expect(hoisted.sentMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts a verified short code from an Uzbek Cyrillic bank question", async () => {
    await handleCheck("Ишонч телефони қайси банкники 1344ми", {
      chatId: 100,
      userId: 42,
      session: { ...sessionWith(), lang: "uz" },
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: "1344" });
    expect(hoisted.runCheckCalls[0].type).toBeUndefined();
    expect(hoisted.sentMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts a verified short code and auto-detects Uzbek from a short trust-phone question", async () => {
    await handleCheck("Ишонч телефони 1344ми", {
      chatId: 100,
      userId: 43,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ input: "1344", lang: "uz" });
    expect(hoisted.sentMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("keeps a pension recalculation request above the generic confirmation helper", async () => {
    await handleCheck("пришло смс что пенсию пересчитают и надо подтвердить карту по ссылке", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toMatch(/(?:пенсион|пенси|субсиди)/iu);
    expect(hoisted.sentMessages[0].text).not.toContain("«Подтверждение» часто означает");
  });

  it("answers an explicit English SMS-code request before the generic scam helper", async () => {
    await handleCheck(
      "someone called saying they are from my bank and asked for the sms code is it a scam",
      {
        chatId: 100,
        userId: 42,
        session: { ...sessionWith(), lang: "en" },
      },
    );

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toMatch(/do not (?:tell|share).{0,30}code/iu);
    expect(hoisted.sentMessages[0].text).not.toContain("tell me what they ask");
  });

  it("stores only coarse recent victim context after transfer guidance", async () => {
    await handleCheck("внучек попал в аварию и просит срочно перевести деньги", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.saveSessionCalls).toHaveLength(1);
    const patch = hoisted.saveSessionCalls[0].patch as {
      scenarioData: {
        lastVictimIntent: Record<string, unknown>;
        chatScope: Record<string, unknown>;
      };
    };
    expect(patch.scenarioData.lastVictimIntent).toMatchObject({
      kind: "friend_money",
      askedContext: "transfer",
    });
    expect(patch.scenarioData.lastVictimIntent).not.toHaveProperty("text");
    expect(patch.scenarioData.lastVictimIntent).not.toHaveProperty("amount");
    expect(patch.scenarioData.chatScope).toEqual({ chatId: 100, chatType: "private" });
  });

  it("replaces stale live-call context with a new code topic before short follow-ups", async () => {
    await handleCheck("У меня просят код из SMS", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: sessionWithData({
        lastPanicId: 6,
        lastPanicAt: new Date().toISOString(),
        lastLiveCallContext: "government",
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.saveSessionCalls).toHaveLength(1);
    const firstPatch = hoisted.saveSessionCalls[0].patch as {
      scenarioData: Session["scenarioData"];
    };
    expect(firstPatch.scenarioData.lastVictimIntent).toMatchObject({
      kind: "code_request",
      askedContext: "code",
    });
    expect(firstPatch.scenarioData).not.toHaveProperty("lastPanicId");
    expect(firstPatch.scenarioData).not.toHaveProperty("lastPanicAt");
    expect(firstPatch.scenarioData).not.toHaveProperty("lastLiveCallContext");

    hoisted.sentMessages.length = 0;
    hoisted.runCheckCalls.length = 0;
    hoisted.saveSessionCalls.length = 0;

    await handleCheck("Что делать дальше?", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: sessionWithData(firstPatch.scenarioData),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Код");
    expect(hoisted.sentMessages[0].text).not.toContain("ЗАВЕРШИТЕ ЗВОНОК");
    expect(hoisted.sentMessages[0].text).not.toContain("Хорошо, звонок завершён");
  });

  it.each([
    ["Почему это опасно?", "SMS-код"],
    ["Можно показать это сыну?", "близкому человеку"],
  ] as const)("keeps '%s' on recent code guidance", async (question, expected) => {
    await handleCheck(question, {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: sessionWithData({
        lastVictimIntent: {
          kind: "code_request",
          askedContext: "code",
          at: new Date().toISOString(),
        },
        chatScope: { chatId: 100, chatType: "private" },
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain(expected);
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("routes a short already-paid reply through recent victim context without a cold check", async () => {
    await handleCheck("я уже перевела 2 миллиона", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      session: sessionWithData({
        lastVictimIntent: {
          kind: "friend_money",
          askedContext: "transfer",
          at: new Date().toISOString(),
        },
        chatScope: { chatId: 100, chatType: "private" },
      }),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("деньги уже отправлены");
    expect(hoisted.sentMessages[0].text).toContain("заморозить перевод");
    expect(hoisted.sentMessages[0].text).toContain("102");
  });

  it("routes install/removal replies through recent APK victim context", async () => {
    const scenarioData: Session["scenarioData"] = {
      lastVictimIntent: {
        kind: "apk_request",
        askedContext: "apk",
        at: new Date().toISOString(),
      },
      chatScope: { chatId: 100, chatType: "private" },
    };

    for (const phrase of ["я уже установила", "как удалить"]) {
      hoisted.sentMessages.length = 0;
      hoisted.runCheckCalls.length = 0;
      hoisted.saveSessionCalls.length = 0;
      await handleCheck(phrase, {
        chatId: 100,
        userId: 42,
        chatType: "private",
        session: sessionWithData(scenarioData),
      });
      expect(hoisted.runCheckCalls, phrase).toHaveLength(0);
      expect(hoisted.sentMessages[0].text, phrase).toContain("авиарежим");
      expect(hoisted.sentMessages[0].text, phrase).toContain("удалите");
    }
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

  it("answers channel-admin prefaces as context requests instead of running a cold check", async () => {
    await handleCheck("мне пишет администратор канала", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("пишут в Telegram");
    expect(hoisted.sentMessages[0].text).toContain("Пришлите текст сообщения");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("keeps channel-admin SMS-code requests on immediate code guidance", async () => {
    await handleCheck("мне пишет администратор канала он просит прислать ему смс код", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Код никому не называйте");
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

  it("routes a relative's completed transfer to bank-first aftercare", async () => {
    await handleCheck(
      "муж перевел 5 миллионов сум мошенникам вчера вечером что делать куда звонить",
      {
        chatId: 100,
        userId: 42,
        session: sessionWith(),
      },
    );

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("заморозить перевод");
    expect(hoisted.sentMessages[0].text).toContain("102");
    expect(hoisted.sentMessages[0].text).not.toContain("Пришлите ссылку");
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

  it("keeps a pasted OTP out of the checker and returns private guidance", async () => {
    await handleCheck("Salom, bu kodni kiriting please: 1234", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Kod yashirildi");
    expect(hoisted.sentMessages[0].text).not.toContain("1234");
    expect(hoisted.saveSessionCalls).toEqual([]);
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

  it.each(["storage", "stale"] as const)(
    "does not publish a result when the session write is %s",
    async (reason) => {
      hoisted.saveSessionResult = { ok: false, reason };

      await handleCheck(`https://evil.example/${reason}`, {
        chatId: 100,
        userId: 42,
        chatType: "private",
        session: sessionWith(),
      });

      expect(hoisted.runCheckCalls).toHaveLength(1);
      expect(hoisted.saveSessionCalls).toHaveLength(1);
      expect(hoisted.sentMessages).toHaveLength(0);
      expect(hoisted.familyNotifyCalls).toHaveLength(0);
    },
  );

  it("auto-notifies a linked trusted contact after a private high-risk check", async () => {
    hoisted.familyNotifyResult = { ok: true, trustedChatId: 700 };

    await handleCheck("https://kapitalbank.uz.evil.com/login", {
      chatId: 100,
      userId: 42,
      chatType: "private",
      displayName: "Akmal",
      session: sessionWith(),
    });

    expect(hoisted.familyNotifyCalls).toEqual([
      {
        guardianTelegramUserId: 42,
        lang: "ru",
        guardianDisplayName: "Akmal",
        cooldownMs: 30 * 60 * 1000,
      },
    ]);
    expect(JSON.stringify(hoisted.familyNotifyCalls[0])).not.toContain("kapitalbank.uz.evil.com");
  });

  it("does not auto-notify trusted contacts from group checks", async () => {
    hoisted.familyNotifyResult = { ok: true, trustedChatId: 700 };

    await handleCheck("https://kapitalbank.uz.evil.com/login", {
      chatId: -100,
      userId: 42,
      chatType: "group",
      displayName: "Akmal",
      session: sessionWith(),
    });

    expect(hoisted.familyNotifyCalls).toHaveLength(0);
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

  it.each([
    ["Меня просят оплатить обучение на работу как новичку", "ru", "Не платите заранее"],
    ["Mendan yangi ish uchun o'qish pulini to'lashni so'rashyapti", "uz", "Oldindan vakansiya"],
    ["They ask me to pay for training as a newcomer to the job", "en", "Do not pay"],
    ["Они снова просят оплатить обучение перед работой", "ru", "Не платите заранее"],
    ["Ular yana ish uchun o'qish pulini to'lashni so'rashyapti", "uz", "Oldindan vakansiya"],
    ["They keep asking me to pay the training fee before the job", "en", "Do not pay"],
  ] as const)(
    "routes job-entry payment guidance without running a risk check: %s",
    async (text, lang, actionLead) => {
      await handleCheck(text, {
        chatId: 100,
        userId: 42,
        session: { ...sessionWith(), lang },
      });

      expect(hoisted.runCheckCalls).toHaveLength(0);
      expect(hoisted.sentMessages).toHaveLength(1);
      expect(hoisted.sentMessages[0].text.startsWith(actionLead)).toBe(true);
      expect(hoisted.sentMessages[0].text).not.toMatch(
        /(?:Срочный перевод|xavfsiz hisob|safe accounts)/u,
      );
    },
  );

  it.each([
    [
      "Сотрудник полиции требует срочно перевести деньги на «безопасный счёт», иначе заведёт дело.",
      "ru",
      "Полиция не требует",
    ],
    [
      "Незнакомец угрожает разослать мои личные фотографии, если я не переведу деньги.",
      "ru",
      "личных фотографий",
    ],
    [
      "Kredit olishdan oldin sug‘urta va rasmiylashtirish uchun oldindan pul to‘lashimni so‘rashmoqda.",
      "uz",
      "oldindan to'lov",
    ],
    [
      "Сбор на лечение просит срочно перевести деньги на личную карту.",
      "ru",
      "сбора пожертвований",
    ],
    [
      "My online boyfriend says he is stranded and urgently needs money for a flight ticket.",
      "en",
      "romantic contact",
    ],
    [
      "Telegram qo‘llab-quvvatlash xodimi akkauntni tekshirish uchun parolimni yuborishimni so‘radi.",
      "uz",
      "parol",
    ],
    [
      "I was invited to a Telegram earning channel that promises guaranteed daily income after a deposit.",
      "en",
      "channel or bot",
    ],
    [
      "Банк требует перевести все деньги на «безопасный счёт», чтобы защитить их от кражи.",
      "ru",
      "«Безопасный счёт»",
    ],
  ] as const)(
    "routes a confirmed live direct phrase without a generic check: %s",
    async (text, lang, expected) => {
      await handleCheck(text, {
        chatId: 100,
        userId: 42,
        session: { ...sessionWith(), lang },
      });

      expect(hoisted.runCheckCalls).toHaveLength(0);
      expect(hoisted.sentMessages).toHaveLength(1);
      expect(hoisted.sentMessages[0].text).toContain(expected);
      expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
    },
  );

  it.each(LIVE_PHRASE_CASES.map((item) => [item.area, item.text, item] as const))(
    "routes live phrase matrix row '%s' / '%s'",
    async (_area, _text, item) => {
      await handleCheck(item.text, {
        chatId: 100,
        userId: 42,
        session: { ...sessionWith(), lang: item.lang ?? "ru" },
      });

      if (item.expected.kind === "handler_reply" && item.expected.route === "sensitive_secret") {
        expect(hoisted.runCheckCalls).toHaveLength(0);
        expect(hoisted.sentMessages.map(({ text }) => text)).toEqual([
          expect.stringContaining(item.expected.replyIncludes),
        ]);
        return;
      }

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

  it("routes live relative distress to family verification guidance, not organization copy", async () => {
    await handleCheck(
      "мне звонит сестра. Просит срочно перевести деньги, так как у нее случилась проблема с машиной",
      {
        chatId: 100,
        userId: 42,
        session: sessionWith(),
      },
    );

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("подтвердите личность");
    expect(hoisted.sentMessages[0].text).toContain("сохранённому номеру");
    expect(hoisted.sentMessages[0].text).toContain("кодовое слово");
    expect(hoisted.sentMessages[0].text).not.toContain("настоящая организация");
    expect(hoisted.sentMessages[0].text).not.toContain("официальному номеру");
    expect(hoisted.saveSessionCalls).toHaveLength(1);
    expect(JSON.stringify(hoisted.saveSessionCalls[0].patch)).toContain(
      '"lastVictimIntent":{"kind":"friend_money","askedContext":"transfer"',
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
