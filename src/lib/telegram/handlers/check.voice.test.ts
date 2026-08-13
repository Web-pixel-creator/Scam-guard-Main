import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  sendChatAction: vi.fn(),
  getFile: vi.fn(),
  downloadFileAsDataUrl: vi.fn(),
  transcribeVoiceCore: vi.fn(),
  runCheck: vi.fn(),
  saveSession: vi.fn(),
  checkSharedRateLimit: vi.fn(),
}));

const FAKE_RESULT = {
  type: "text" as const,
  display: "caller asks for SMS code",
  level: "high_risk" as const,
  score: 50,
  reasons: ["otp_request"],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: hoisted.runCheck,
  analyzeImageCore: vi.fn(),
  transcribeVoiceCore: hoisted.transcribeVoiceCore,
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: hoisted.checkSharedRateLimit,
}));

vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: hoisted.sendMessage,
  sendChatAction: hoisted.sendChatAction,
  getFile: hoisted.getFile,
  downloadFileAsDataUrl: hoisted.downloadFileAsDataUrl,
  getChatInfo: vi.fn(),
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: hoisted.saveSession,
  loadSession: vi.fn(),
  resetScenario: vi.fn(),
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

import { handleCheck, handleVoice } from "./check";
import { bt } from "../bot-i18n";
import {
  VOICE_STT_PROVIDER_REPLAY_FIXTURES,
  isVoiceSttNegatedAckReplayFixture,
  isVoiceSttNormalReplayFixture,
  isVoiceSttPanicReplayFixture,
} from "../voice-stt-provider-fixtures";

function ctx(lang: Session["lang"] = "ru"): HandlerCtx {
  const session: Session = {
    telegramUserId: 42,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
  };
  return { chatId: 100, userId: 42, session };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.getFile.mockResolvedValue({ filePath: "voice/file_1.oga", fileSize: 1024 });
  hoisted.downloadFileAsDataUrl.mockResolvedValue("data:audio/ogg;base64,AAAA");
  hoisted.transcribeVoiceCore.mockResolvedValue({ text: "caller asks for SMS code" });
  hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
  hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });
});

describe("handleVoice", () => {
  it.each(["Мне звонят из налоговой и просят данные", "Звонит из налоговой и просит данные"])(
    "uses government live-call copy when the caller claims to be tax office: %s",
    async (text) => {
      await handleCheck(text, ctx());

      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.saveSession).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenario: "none",
          scenarioData: expect.objectContaining({
            lastPanicId: 6,
            lastLiveCallContext: "government",
          }),
        }),
      );

      const joined = hoisted.sendMessage.mock.calls
        .map(([message]) => String(message.text))
        .join("\n");
      expect(joined).toContain("налоговая, госорган или полиция");
      expect(joined).not.toContain("настоящий банк спокойно дождётся");
    },
  );

  it("keeps government live-call context for text follow-up questions", async () => {
    const followUpCtx = ctx();
    followUpCtx.session.scenarioData = {
      lastPanicId: 6,
      lastPanicAt: new Date().toISOString(),
      lastLiveCallContext: "government",
    };

    await handleCheck("что дальше", followUpCtx);

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    const joined = hoisted.sendMessage.mock.calls
      .map(([message]) => String(message.text))
      .join("\n");
    expect(joined).toContain("официальный сайт, приложение или номер госоргана");
    expect(joined).not.toContain("перезвоните в банк");
  });

  it("transcribes voice notes and runs the normal check pipeline", async () => {
    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      mimeType: "audio/ogg",
      fileUniqueId: "unique-voice-1",
    });

    expect(hoisted.getFile).toHaveBeenCalledWith("voice-file-id");
    expect(hoisted.checkSharedRateLimit).toHaveBeenCalledWith(
      "check",
      "voice-stt:tg:42",
      5,
      24 * 60 * 60 * 1000,
    );
    expect(hoisted.transcribeVoiceCore).toHaveBeenCalledWith(
      "data:audio/ogg;base64,AAAA",
      "ru",
      "tg:42",
      expect.objectContaining({ timeoutMs: 12_000 }),
    );
    expect(hoisted.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        input: "caller asks for SMS code",
        type: "text",
        lang: "ru",
        rateLimitKey: "tg:42",
        channel: "telegram",
      }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 100, text: expect.stringContaining("Высокий риск") }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 100, text: expect.stringContaining("Я распознал голос") }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 100, text: expect.stringContaining("Распознаю голос") }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("caller asks for SMS code"),
      }),
    );
    const transcriptCorrectionMessage = hoisted.sendMessage.mock.calls
      .map(([message]) => message)
      .find((message) => JSON.stringify(message.keyboard ?? []).includes("voice_correct"));
    expect(transcriptCorrectionMessage).toEqual(
      expect.objectContaining({
        chatId: 100,
        keyboard: [[expect.objectContaining({ callback_data: "voice_correct" })]],
      }),
    );
    const sentTexts = hoisted.sendMessage.mock.calls.map(([message]) => String(message.text));
    expect(sentTexts.findIndex((text) => text.includes("Я распознал голос"))).toBeLessThan(
      sentTexts.findIndex((text) => text.includes("Высокий риск")),
    );
    expect(sentTexts.findIndex((text) => text.includes("Распознаю голос"))).toBeLessThan(
      sentTexts.findIndex((text) => text.includes("Я распознал голос")),
    );
  });

  it("trims long voice transcript previews on a word boundary with an ellipsis", async () => {
    const transcript = `${"добрый ".repeat(25)}неизвестный профиль просит SMS код и данные карты`;
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: transcript });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 34,
      mimeType: "audio/ogg",
      fileUniqueId: "long-voice-preview",
    });

    expect(hoisted.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        input: transcript,
        type: "text",
      }),
    );
    const transcriptNote = hoisted.sendMessage.mock.calls
      .map(([message]) => String(message.text))
      .find((text) => text.includes("Я распознал голос"));

    expect(transcriptNote).toContain("…");
    expect(transcriptNote).not.toContain("неизв");
  });

  it("adds a redacted hook phrase to voice check results", async () => {
    const transcript =
      "The courier says open https://evil.example/pay, message @seller, and pay by card only 123456.";
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: transcript });
    hoisted.runCheck.mockResolvedValue({
      ...FAKE_RESULT,
      display: "delivery card-only voice transcript",
      level: "suspicious",
      score: 35,
      reasons: ["fake_delivery_payment"],
      explanation: null,
    });

    await handleVoice("voice-file-id", ctx("en"), {
      fileSize: 1024,
      duration: 8,
      mimeType: "audio/ogg",
      fileUniqueId: "voice-hook-redaction",
    });

    const joined = hoisted.sendMessage.mock.calls
      .map(([message]) => String(message.text))
      .join("\n");

    expect(joined).toContain("Key phrase from the voice note");
    expect(joined).toContain("card only");
    expect(joined).not.toContain("evil.example");
    expect(joined).not.toContain("@seller");
    expect(joined).not.toContain("123456");
  });

  it.each([
    {
      id: "ru-password",
      lang: "ru",
      transcript: "пароль: CorrectHorse42",
      secrets: ["CorrectHorse42"],
      safePreview: "Чувствительные данные скрыты",
    },
    {
      id: "ru-code",
      lang: "ru",
      transcript: "СМС-код: AB12CD",
      secrets: ["AB12CD"],
      safePreview: "Чувствительные данные скрыты",
    },
    {
      id: "ru-recovery",
      lang: "ru",
      transcript:
        "сид-фраза: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      secrets: [
        "apple",
        "bicycle",
        "candle",
        "dragon",
        "eagle",
        "forest",
        "garden",
        "harbor",
        "island",
        "jungle",
        "kitten",
        "lemon",
      ],
      safePreview: "Чувствительные данные скрыты",
    },
    {
      id: "uz-password",
      lang: "uz",
      transcript: "parol: UzbekSecret42",
      secrets: ["UzbekSecret42"],
      safePreview: "Maxfiy ma'lumotlar yashirildi",
    },
    {
      id: "uz-code",
      lang: "uz",
      transcript: "SMS kod: UZ12AB",
      secrets: ["UZ12AB"],
      safePreview: "Maxfiy ma'lumotlar yashirildi",
    },
    {
      id: "uz-recovery",
      lang: "uz",
      transcript:
        "tiklash iborasi: anchor blossom copper dolphin ember feather galaxy hazel ivory jasmine kernel lotus",
      secrets: [
        "anchor",
        "blossom",
        "copper",
        "dolphin",
        "ember",
        "feather",
        "galaxy",
        "hazel",
        "ivory",
        "jasmine",
        "kernel",
        "lotus",
      ],
      safePreview: "Maxfiy ma'lumotlar yashirildi",
    },
    {
      id: "en-password",
      lang: "en",
      transcript: "password: EnglishSecret42",
      secrets: ["EnglishSecret42"],
      safePreview: "Sensitive data is hidden",
    },
    {
      id: "en-code",
      lang: "en",
      transcript: "verification code: EN12CD",
      secrets: ["EN12CD"],
      safePreview: "Sensitive data is hidden",
    },
    {
      id: "en-recovery",
      lang: "en",
      transcript:
        "recovery phrase: maple nectar olive pebble quartz river silver timber umber velvet willow xenon",
      secrets: [
        "maple",
        "nectar",
        "olive",
        "pebble",
        "quartz",
        "river",
        "silver",
        "timber",
        "umber",
        "velvet",
        "willow",
        "xenon",
      ],
      safePreview: "Sensitive data is hidden",
    },
  ] as const)(
    "keeps a $lang $id voice secret out of every Telegram/check/storage sink",
    async ({ id, lang, transcript, secrets, safePreview }) => {
      hoisted.transcribeVoiceCore.mockResolvedValue({ text: transcript });

      await handleVoice("voice-file-id", ctx(lang), {
        fileSize: 1024,
        duration: 8,
        mimeType: "audio/ogg",
        fileUniqueId: `voice-secret-${id}`,
      });

      expect(hoisted.transcribeVoiceCore).toHaveBeenCalledOnce();
      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.saveSession).not.toHaveBeenCalled();

      const sentMessages = hoisted.sendMessage.mock.calls.map(([message]) => message);
      const sentTexts = sentMessages.map((message) => String(message.text));
      expect(sentTexts.join("\n")).toContain(safePreview);
      for (const sentText of sentTexts) {
        expect(sentText).not.toContain(transcript);
        for (const secret of secrets) expect(sentText).not.toContain(secret);
      }

      expect(
        sentMessages.some((message) =>
          JSON.stringify(message.keyboard ?? []).includes("voice_correct"),
        ),
      ).toBe(true);
    },
  );

  it("does not retain a secret-bearing voice transcript in the 24-hour replay cache", async () => {
    const transcript = "password: NeverCacheThis42";
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: transcript });
    const meta = {
      fileSize: 1024,
      duration: 8,
      mimeType: "audio/ogg",
      fileUniqueId: "voice-secret-cache-boundary",
    };

    await handleVoice("voice-file-id", ctx("en"), meta);
    await handleVoice("voice-file-id-again", ctx("en"), meta);

    expect(hoisted.getFile).toHaveBeenCalledTimes(2);
    expect(hoisted.downloadFileAsDataUrl).toHaveBeenCalledTimes(2);
    expect(hoisted.transcribeVoiceCore).toHaveBeenCalledTimes(2);
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).not.toHaveBeenCalled();
    for (const [message] of hoisted.sendMessage.mock.calls) {
      expect(String(message.text)).not.toContain("NeverCacheThis42");
    }
  });

  it("keeps delivery card-only voice transcripts in the suspicious lane", async () => {
    const transcript =
      "Ссылку скинул, если вдруг там только по карте, то не проблема, я тебе переведу за дорогу сразу же. Вот, потому что, по-моему, доставка они там только по карте.";
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: transcript });
    hoisted.runCheck.mockResolvedValue({
      ...FAKE_RESULT,
      display: transcript,
      level: "suspicious",
      score: 35,
      reasons: ["fake_delivery_payment"],
    });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 10,
      mimeType: "audio/ogg",
      fileUniqueId: "delivery-card-only-voice",
    });

    expect(hoisted.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        input: transcript,
        type: "text",
        lang: "ru",
        channel: "telegram",
      }),
    );
    const sentTexts = hoisted.sendMessage.mock.calls.map(([message]) => String(message.text));
    const joined = sentTexts.join("\n");
    expect(joined).toContain("Требуется осторожность");
    expect(joined).not.toContain("Высокий риск");
    expect(joined).not.toContain("Закрытый канал");
  });

  it("routes corrected voice text with a code request to protective local guidance", async () => {
    await handleCheck("corrected voice transcript asks for SMS code", ctx());

    expect(hoisted.getFile).not.toHaveBeenCalled();
    expect(hoisted.downloadFileAsDataUrl).not.toHaveBeenCalled();
    expect(hoisted.checkSharedRateLimit).not.toHaveBeenCalled();
    expect(hoisted.transcribeVoiceCore).not.toHaveBeenCalled();
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("Do not tell anyone the code"),
      }),
    );
  });

  it("shows a typing action while voice transcription is slow", async () => {
    vi.useFakeTimers();
    hoisted.transcribeVoiceCore.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ text: "caller asks for SMS code" }), 1000);
        }),
    );

    try {
      const promise = handleVoice("voice-file-id", ctx(), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: "slow-voice",
      });

      await vi.advanceTimersByTimeAsync(600);
      expect(hoisted.sendChatAction).toHaveBeenCalledWith(100, "typing");

      await vi.advanceTimersByTimeAsync(1000);
      await promise;
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes obvious already-happened voice emergencies to the panic flow", async () => {
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: "Я уже отправил SMS-код мошеннику" });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "sent-code-voice",
    });

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        scenario: "none",
        scenarioData: expect.objectContaining({ lastPanicId: 1 }),
      }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("Я уже отправил SMS-код"),
      }),
    );
  });

  it("asks for correction when STT returns a low-signal transcript", async () => {
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: "ha yoq" });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 4,
      fileUniqueId: "low-signal-voice",
    });

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).not.toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        scenarioData: expect.objectContaining({ lastPanicId: expect.any(Number) }),
      }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("текста мало"),
        keyboard: expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ callback_data: "voice_correct" })]),
        ]),
      }),
    );
  });

  it("routes mixed RU/UZ emergency voice transcripts to panic scenarios", async () => {
    const cases: Array<[string, number, string]> = [
      ["Men telegram kod yubordim, endi nima qilay", 1, "uz-code"],
      ["Men pul o'tkazdim karta orqali", 3, "uz-money"],
      ["Hozir menga bankdan qo'ng'iroq qilishyapti", 6, "uz-call"],
    ];

    for (const [text, panicId, uniqueId] of cases) {
      vi.clearAllMocks();
      hoisted.transcribeVoiceCore.mockResolvedValue({ text });
      hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
      hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });

      await handleVoice("voice-file-id", ctx(), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: uniqueId,
      });

      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.saveSession).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenario: "none",
          scenarioData: expect.objectContaining({ lastPanicId: panicId }),
        }),
      );
    }
  });

  it("uses government live-call copy for voice transcripts about tax-office calls", async () => {
    hoisted.transcribeVoiceCore.mockResolvedValue({
      text: "Hozir menga soliqdan qo'ng'iroq qilishyapti va ma'lumot so'rashyapti",
    });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "uz-tax-call-voice",
    });

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        scenario: "none",
        scenarioData: expect.objectContaining({
          lastPanicId: 6,
          lastLiveCallContext: "government",
        }),
      }),
    );

    const joined = hoisted.sendMessage.mock.calls
      .map(([message]) => String(message.text))
      .join("\n");
    expect(joined).toContain("налоговая, госорган или полиция");
    expect(joined).not.toContain("настоящий банк спокойно дождётся");
  });

  it.each([
    {
      id: "uz-relative-urgent-money-call",
      text: "Menga akam qo'ng'iroq qildi, shoshilinch pul so'radi",
      context: "relative",
    },
    {
      id: "uz-operator-sim-block-call",
      text: "Menga Beeline operatori telefon qildi, raqam bloklanadi deyapti",
      context: "operator",
    },
    {
      id: "uz-government-soliq-code-call",
      text: "Menga Soliqdan qo'ng'iroq qildi, SMS kod so'radi",
      context: "government",
    },
    {
      id: "uz-relative-sister-car-urgent-transfer-call",
      text: "Menga singlim qo'ng'iroq qilyapti. U mashinasi bilan muammo bo'lib qolganini aytib, zudlik bilan pul o'tkazishimni so'rayapti.",
      context: "relative",
    },
  ] as const)(
    "keeps the right UZ live-call context for short voice wording: $id",
    async ({ id, text, context }) => {
      hoisted.transcribeVoiceCore.mockResolvedValue({ text });

      await handleVoice("voice-file-id", ctx("uz"), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: id,
      });

      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.saveSession).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenario: "none",
          scenarioData: expect.objectContaining({
            lastPanicId: 6,
            lastLiveCallContext: context,
          }),
        }),
      );
    },
  );

  it("checks a longer Uzbek channel-admin voice asking for an SMS code", async () => {
    const text =
      "Kanal administratori menga yozmoqda. U mendan SMS kodini yuborishimni so'rayapti.";
    hoisted.transcribeVoiceCore.mockResolvedValue({ text });
    hoisted.runCheck.mockResolvedValue({
      ...FAKE_RESULT,
      level: "high_risk",
      score: 55,
      reasons: ["asks_for_sms_code", "unknown_sender"],
      display: text,
    });

    await handleVoice("voice-file-id", ctx("uz"), {
      fileSize: 1024,
      duration: 5,
      fileUniqueId: "uz-channel-admin-sms-code-request",
    });

    expect(hoisted.saveSession).not.toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        scenarioData: expect.objectContaining({ lastPanicId: expect.any(Number) }),
      }),
    );
    expect(hoisted.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        input: text,
        type: "text",
        lang: "uz",
        channel: "telegram",
      }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Yuqori xavf") }),
    );
  });

  it("routes production-like STT emergency corpus without needing raw audio fixtures", async () => {
    for (const fixture of VOICE_STT_PROVIDER_REPLAY_FIXTURES.filter(isVoiceSttPanicReplayFixture)) {
      vi.clearAllMocks();
      hoisted.transcribeVoiceCore.mockResolvedValue({ text: fixture.transcript });
      hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
      hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });

      await handleVoice("voice-file-id", ctx(fixture.lang), {
        fileSize: 1024,
        duration: 9,
        fileUniqueId: fixture.id,
      });

      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.saveSession).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenario: "none",
          scenarioData: expect.objectContaining({ lastPanicId: fixture.expectation.panicId }),
        }),
      );
    }
  });

  it("acknowledges negated STT phrases without running the generic risk card", async () => {
    for (const fixture of VOICE_STT_PROVIDER_REPLAY_FIXTURES.filter(
      isVoiceSttNegatedAckReplayFixture,
    )) {
      vi.clearAllMocks();
      hoisted.transcribeVoiceCore.mockResolvedValue({ text: fixture.transcript });
      hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
      hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });

      await handleVoice("voice-file-id", ctx(fixture.lang), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: fixture.id,
      });

      expect(hoisted.runCheck).not.toHaveBeenCalled();
      expect(hoisted.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: bt("voice_negated_done_ack", fixture.lang),
        }),
      );
      expect(hoisted.saveSession).not.toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenarioData: expect.objectContaining({ lastPanicId: expect.any(Number) }),
        }),
      );
    }
  });

  it("passes non-emergency STT replay phrases into the normal check pipeline", async () => {
    for (const fixture of VOICE_STT_PROVIDER_REPLAY_FIXTURES.filter(
      isVoiceSttNormalReplayFixture,
    )) {
      vi.clearAllMocks();
      hoisted.transcribeVoiceCore.mockResolvedValue({ text: fixture.transcript });
      hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
      hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });

      await handleVoice("voice-file-id", ctx(fixture.lang), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: fixture.id,
      });

      expect(hoisted.runCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          input: fixture.transcript,
          type: "text",
          lang: fixture.lang,
          channel: "telegram",
        }),
      );
      expect(hoisted.saveSession).not.toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          scenarioData: expect.objectContaining({ lastPanicId: expect.any(Number) }),
        }),
      );
      expect(hoisted.sendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          text: bt("voice_negated_done_ack", fixture.lang),
        }),
      );
    }
  });

  it("reuses a cached transcript for the same Telegram file_unique_id", async () => {
    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "same-voice",
    });

    vi.clearAllMocks();
    hoisted.getFile.mockResolvedValue({ filePath: "voice/file_1.oga", fileSize: 1024 });
    hoisted.downloadFileAsDataUrl.mockResolvedValue("data:audio/ogg;base64,BBBB");
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: "different paid transcript" });
    hoisted.runCheck.mockResolvedValue(FAKE_RESULT);
    hoisted.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });

    await handleVoice("voice-file-id-again", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "same-voice",
    });

    expect(hoisted.getFile).not.toHaveBeenCalled();
    expect(hoisted.downloadFileAsDataUrl).not.toHaveBeenCalled();
    expect(hoisted.checkSharedRateLimit).not.toHaveBeenCalled();
    expect(hoisted.transcribeVoiceCore).not.toHaveBeenCalled();
    expect(hoisted.runCheck).toHaveBeenCalledWith(
      expect.objectContaining({ input: "caller asks for SMS code" }),
    );
  });

  it("shares an in-flight STT request for the same Telegram file_unique_id", async () => {
    let resolveTranscript!: (value: { text: string }) => void;
    hoisted.transcribeVoiceCore.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranscript = resolve;
        }),
    );

    const first = handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "same-inflight-voice",
    });

    await vi.waitFor(() => expect(hoisted.transcribeVoiceCore).toHaveBeenCalledTimes(1));

    const second = handleVoice("voice-file-id-again", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "same-inflight-voice",
    });

    resolveTranscript({ text: "caller asks for SMS code" });
    await Promise.all([first, second]);

    expect(hoisted.getFile).toHaveBeenCalledTimes(1);
    expect(hoisted.downloadFileAsDataUrl).toHaveBeenCalledTimes(1);
    expect(hoisted.checkSharedRateLimit).toHaveBeenCalledTimes(1);
    expect(hoisted.transcribeVoiceCore).toHaveBeenCalledTimes(1);
    expect(hoisted.runCheck).toHaveBeenCalledTimes(2);
  });

  it("shares only a non-secret summary when concurrent voice requests resolve to a password", async () => {
    let resolveTranscript!: (value: { text: string }) => void;
    hoisted.transcribeVoiceCore.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranscript = resolve;
        }),
    );
    const meta = {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "same-inflight-secret-voice",
    };

    const first = handleVoice("voice-file-id", ctx("en"), meta);
    await vi.waitFor(() => expect(hoisted.transcribeVoiceCore).toHaveBeenCalledTimes(1));
    const second = handleVoice("voice-file-id-again", ctx("en"), meta);

    resolveTranscript({ text: "password: ConcurrentSecret42" });
    await Promise.all([first, second]);

    expect(hoisted.getFile).toHaveBeenCalledTimes(1);
    expect(hoisted.downloadFileAsDataUrl).toHaveBeenCalledTimes(1);
    expect(hoisted.transcribeVoiceCore).toHaveBeenCalledTimes(1);
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).not.toHaveBeenCalled();
    const sentTexts = hoisted.sendMessage.mock.calls.map(([message]) => String(message.text));
    expect(sentTexts.filter((text) => text.includes("Sensitive data is hidden"))).toHaveLength(2);
    for (const sentText of sentTexts) {
      expect(sentText).not.toContain("ConcurrentSecret42");
    }
  });

  it("logs voice timings without exposing transcript content", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    process.env.TELEGRAM_TIMING_LOGS = "1";
    let logs = "";
    hoisted.transcribeVoiceCore.mockResolvedValue({
      text: "Секретный код 1234, ссылка https://example.test и @seller",
    });

    try {
      await handleVoice("voice-file-id", ctx(), {
        fileSize: 1024,
        duration: 8,
        fileUniqueId: "timing-voice",
      });
      logs = infoSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    } finally {
      delete process.env.TELEGRAM_TIMING_LOGS;
      infoSpy.mockRestore();
    }

    expect(logs).toContain("telegram_timing");
    expect(logs).toContain("voice.transcribe");
    expect(logs).toContain("transcriptChars");
    expect(logs).not.toContain("Секретный код");
    expect(logs).not.toContain("1234");
    expect(logs).not.toContain("example.test");
    expect(logs).not.toContain("@seller");
  });

  it("blocks new STT calls when the daily voice budget is exhausted", async () => {
    hoisted.checkSharedRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterSec: 3600,
    });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 8,
      fileUniqueId: "budget-blocked",
    });

    expect(hoisted.downloadFileAsDataUrl).not.toHaveBeenCalled();
    expect(hoisted.transcribeVoiceCore).not.toHaveBeenCalled();
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Лимит распознавания голосовых") }),
    );
  });

  it("falls back with emergency actions when transcription fails", async () => {
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: null });

    await handleVoice("voice-file-id", ctx(), { fileSize: 1024, duration: 8 });

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("не смог надёжно разобрать голосовое"),
        keyboard: expect.arrayContaining([
          expect.arrayContaining([expect.objectContaining({ callback_data: "emergency" })]),
        ]),
      }),
    );
  });

  it("uses risky audio filename text as a fallback when transcription fails", async () => {
    hoisted.transcribeVoiceCore.mockResolvedValue({ text: null });

    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 2,
      mimeType: "audio/mpeg",
      fileUniqueId: "uz-app-sms-permission",
      fileName: "Men ilovani o'rnatdim va SMSga ruxsat.mp3",
    });

    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.saveSession).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        scenario: "none",
        scenarioData: expect.objectContaining({ lastPanicId: 2 }),
      }),
    );
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("Men ilovani o'rnatdim va SMSga ruxsat"),
      }),
    );
  });

  it("rejects oversized voice files before downloading", async () => {
    await handleVoice("voice-file-id", ctx(), {
      fileSize: 1024,
      duration: 61,
      mimeType: "audio/ogg",
    });

    expect(hoisted.getFile).not.toHaveBeenCalled();
    expect(hoisted.downloadFileAsDataUrl).not.toHaveBeenCalled();
    expect(hoisted.checkSharedRateLimit).not.toHaveBeenCalled();
    expect(hoisted.transcribeVoiceCore).not.toHaveBeenCalled();
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Голосовое или аудио слишком большое"),
      }),
    );
  });

  it("rejects downloaded voice files that exceed the voice cap when metadata is missing", async () => {
    hoisted.getFile.mockResolvedValue({ filePath: "voice/file_1.oga", fileSize: 0 });
    hoisted.downloadFileAsDataUrl.mockResolvedValue(
      `data:audio/ogg;base64,${Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64")}`,
    );

    await handleVoice("voice-file-id", ctx(), {});

    expect(hoisted.transcribeVoiceCore).not.toHaveBeenCalled();
    expect(hoisted.runCheck).not.toHaveBeenCalled();
    expect(hoisted.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Голосовое или аудио слишком большое"),
      }),
    );
  });
});
