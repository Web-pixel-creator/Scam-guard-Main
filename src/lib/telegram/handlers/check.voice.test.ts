import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sendMessage: vi.fn(),
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
  sendChatAction: vi.fn(),
  getFile: hoisted.getFile,
  downloadFileAsDataUrl: hoisted.downloadFileAsDataUrl,
  getChatInfo: vi.fn(),
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: hoisted.saveSession,
  loadSession: vi.fn(),
  resetScenario: vi.fn(),
}));

import { handleVoice } from "./check";

function ctx(): HandlerCtx {
  const session: Session = {
    telegramUserId: 42,
    lang: "ru",
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
      expect.objectContaining({
        chatId: 100,
        text: expect.stringContaining("caller asks for SMS code"),
      }),
    );
    const sentTexts = hoisted.sendMessage.mock.calls.map(([message]) => String(message.text));
    expect(sentTexts.findIndex((text) => text.includes("Я распознал голос"))).toBeLessThan(
      sentTexts.findIndex((text) => text.includes("Высокий риск")),
    );
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
      expect.objectContaining({ text: expect.stringContaining("Слишком много запросов") }),
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
