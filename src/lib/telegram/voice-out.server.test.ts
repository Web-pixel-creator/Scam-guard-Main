import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  rateLimitResult: { ok: true, remaining: 4, retryAfterSec: 0 } as
    | { ok: true; remaining: number; retryAfterSec: number }
    | { ok: false; retryAfterSec: number },
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  sentAudio: [] as Array<{ chatId: number; audio: Uint8Array; caption?: string }>,
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(async () => hoisted.rateLimitResult),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  escapeMarkdownV2: (text: string) => text,
  sendAudioFile: vi.fn(async (opts: { chatId: number; audio: Uint8Array; caption?: string }) => {
    hoisted.sentAudio.push(opts);
    return { ok: true };
  }),
  sendMessage: vi.fn(async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return { ok: true };
  }),
}));

import {
  buildGuardianVoiceOutText,
  buildPanicVoiceOutText,
  parseVoiceOutCallback,
  sendVoiceOutResponse,
  synthesizeVoiceOut,
  VOICE_OUT_CB,
} from "@/lib/telegram/voice-out.server";

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_TTS_API_KEY: process.env.OPENAI_TTS_API_KEY,
  OPENAI_TTS_BASE_URL: process.env.OPENAI_TTS_BASE_URL,
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("telegram Voice-out / TTS", () => {
  beforeEach(() => {
    restoreEnv();
    hoisted.rateLimitResult = { ok: true, remaining: 4, retryAfterSec: 0 };
    hoisted.sentMessages.length = 0;
    hoisted.sentAudio.length = 0;
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("parses only the explicit voice-out callbacks", () => {
    expect(parseVoiceOutCallback("voiceout:panic")).toBe(VOICE_OUT_CB.panic);
    expect(parseVoiceOutCallback("voiceout:guardian")).toBe(VOICE_OUT_CB.guardian);
    expect(parseVoiceOutCallback("panicctx:full")).toBeNull();
  });

  it("builds short SOS voice guidance without directory-sized text", () => {
    expect(buildPanicVoiceOutText(2, "ru")).toContain("авиарежим");
    expect(buildPanicVoiceOutText(11, "ru")).toContain("голос похож");
    expect(buildPanicVoiceOutText(2, "ru")).not.toContain("Национальный банк");
  });

  it("builds contextual Guardian voice guidance from safe metadata only", () => {
    const text = buildGuardianVoiceOutText(
      {
        level: "high_risk",
        type: "text",
        reasons: ["asks_for_sms_code", "impersonates_bank"],
        at: "2026-06-16T10:00:00.000Z",
      },
      "ru",
    );

    expect(text).toContain("Не называйте код");
    expect(text).not.toContain("https://");
    expect(text).not.toContain("+998");
  });

  it("does not reuse a Gemini-compatible OpenAI key as a speech endpoint", async () => {
    process.env.OPENAI_API_KEY = "gemini-key";
    process.env.OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeVoiceOut("Я рядом. Завершите звонок.", 1001)).resolves.toMatchObject({
      ok: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses an explicit TTS key and removes raw links, usernames and long numbers", async () => {
    process.env.OPENAI_TTS_API_KEY = "tts-key";
    process.env.OPENAI_TTS_BASE_URL = "https://tts.example/v1";
    process.env.OPENAI_TTS_MODEL = "test-tts";
    process.env.OPENAI_TTS_VOICE = "test-voice";

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        input: string;
        model: string;
        voice: string;
      };
      expect(body.input).not.toContain("https://evil.example");
      expect(body.input).not.toContain("@bad_actor");
      expect(body.input).not.toContain("8600123412341234");
      expect(body.input).toContain("ссылка скрыта");
      expect(body.input).toContain("аккаунт скрыт");
      expect(body.model).toBe("test-tts");
      expect(body.voice).toBe("test-voice");
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      synthesizeVoiceOut(
        "Проверьте https://evil.example и @bad_actor, карта 8600123412341234",
        1002,
      ),
    ).resolves.toMatchObject({ ok: true, mimeType: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tts.example/v1/audio/speech",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to a text message when audio is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_API_KEY;
    vi.stubGlobal("fetch", vi.fn());

    await sendVoiceOutResponse({
      chatId: 10,
      userId: 1003,
      lang: "ru",
      text: "Я рядом. Завершите звонок.",
      keyboard: [[{ text: "OK", callback_data: "ok" }]],
    });

    expect(hoisted.sentAudio).toHaveLength(0);
    expect(hoisted.sentMessages).toEqual([
      expect.objectContaining({
        chatId: 10,
        text: expect.stringContaining("Голосовой ответ пока не подключён"),
      }),
    ]);
  });
});
