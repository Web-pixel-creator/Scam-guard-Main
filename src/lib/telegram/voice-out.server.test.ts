import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  rateLimitResult: { ok: true, remaining: 4, retryAfterSec: 0 } as
    | { ok: true; remaining: number; retryAfterSec: number }
    | { ok: false; retryAfterSec: number },
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  sentAudio: [] as Array<{
    chatId: number;
    audio: Uint8Array;
    caption?: string;
    filename?: string;
    mimeType?: string;
  }>,
  sentActions: [] as Array<{ chatId: number; action: string }>,
  answeredCallbacks: [] as Array<{ id: string; text?: string }>,
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(async () => hoisted.rateLimitResult),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  escapeMarkdownV2: (text: string) => text,
  sendAudioFile: vi.fn(
    async (opts: {
      chatId: number;
      audio: Uint8Array;
      caption?: string;
      filename?: string;
      mimeType?: string;
    }) => {
      hoisted.sentAudio.push(opts);
      return { ok: true };
    },
  ),
  sendChatAction: vi.fn(async (chatId: number, action: string) => {
    hoisted.sentActions.push({ chatId, action });
  }),
  sendMessage: vi.fn(async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return { ok: true };
  }),
  answerCallbackQuery: vi.fn(async (id: string, text?: string) => {
    hoisted.answeredCallbacks.push({ id, text });
  }),
}));

import {
  buildGuardianVoiceOutText,
  buildPanicVoiceOutText,
  parseVoiceOutCallback,
  parseVoiceOutPanicAction,
  parseVoiceOutPanicCallback,
  parseVoiceOutPanicId,
  sendVoiceOutResponse,
  synthesizeVoiceOut,
  VOICE_OUT_CB,
} from "@/lib/telegram/voice-out.server";
import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_TTS_API_KEY: process.env.OPENAI_TTS_API_KEY,
  OPENAI_TTS_BASE_URL: process.env.OPENAI_TTS_BASE_URL,
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
  GEMINI_TTS_API_KEY: process.env.GEMINI_TTS_API_KEY,
  GEMINI_TTS_MODEL: process.env.GEMINI_TTS_MODEL,
  GEMINI_TTS_VOICE: process.env.GEMINI_TTS_VOICE,
  LEGACY_GEMINI_TTS_API_KEY: process.env["Gemini TTS"],
  TTS_PROVIDER: process.env.TTS_PROVIDER,
  VOICE_OUT_TTS_PROVIDER: process.env.VOICE_OUT_TTS_PROVIDER,
  VOICE_OUT_PRERECORDED_DIR: process.env.VOICE_OUT_PRERECORDED_DIR,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (key === "LEGACY_GEMINI_TTS_API_KEY") {
      if (value === undefined) delete process.env["Gemini TTS"];
      else process.env["Gemini TTS"] = value;
      continue;
    }
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
    hoisted.sentActions.length = 0;
    hoisted.answeredCallbacks.length = 0;
  });

  afterEach(() => {
    restoreEnv();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("parses only the explicit voice-out callbacks", () => {
    expect(parseVoiceOutCallback("voiceout:panic")).toBe(VOICE_OUT_CB.panic);
    expect(parseVoiceOutCallback("voiceout:panic:4")).toBe(VOICE_OUT_CB.panic);
    expect(parseVoiceOutCallback("voiceout:panic:4:script")).toBe(VOICE_OUT_CB.panic);
    expect(parseVoiceOutPanicId("voiceout:panic:4")).toBe(4);
    expect(parseVoiceOutPanicId("voiceout:panic:4:script")).toBe(4);
    expect(parseVoiceOutPanicAction("voiceout:panic:4:script")).toBe("script");
    expect(parseVoiceOutPanicCallback("voiceout:panic:4:script")).toEqual({
      panicId: 4,
      action: "script",
    });
    expect(parseVoiceOutPanicId("voiceout:panic:99")).toBeNull();
    expect(parseVoiceOutPanicCallback("voiceout:panic:4:unknown")).toBeNull();
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

  it("sends prerecorded panic audio before TTS budget or provider calls", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "voice-out-"));
    try {
      process.env.VOICE_OUT_PRERECORDED_DIR = dir;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_TTS_API_KEY;
      delete process.env.GEMINI_TTS_API_KEY;
      delete process.env["Gemini TTS"];
      hoisted.rateLimitResult = { ok: false, retryAfterSec: 3600 };
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await writeFile(path.join(dir, "panic-4-ru.wav"), new Uint8Array([7, 8, 9]));

      await sendVoiceOutResponse({
        chatId: 10,
        userId: 1001,
        lang: "ru",
        text: buildPanicVoiceOutText(4, "ru"),
        keyboard: [[{ text: "OK", callback_data: "ok" }]],
        prerecorded: { kind: "panic", panicId: 4 },
      });

      expect(checkSharedRateLimit).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(hoisted.sentMessages).toHaveLength(0);
      expect(hoisted.sentAudio).toEqual([
        expect.objectContaining({
          chatId: 10,
          audio: new Uint8Array([7, 8, 9]),
          filename: "panic-4-ru.wav",
          mimeType: "audio/wav",
        }),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prefers prerecorded OGG panic audio over WAV fallback", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "voice-out-"));
    try {
      process.env.VOICE_OUT_PRERECORDED_DIR = dir;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_TTS_API_KEY;
      delete process.env.GEMINI_TTS_API_KEY;
      delete process.env["Gemini TTS"];
      hoisted.rateLimitResult = { ok: false, retryAfterSec: 3600 };
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await writeFile(path.join(dir, "panic-6-en.wav"), new Uint8Array([1, 2, 3]));
      await writeFile(path.join(dir, "panic-6-en.ogg"), new Uint8Array([4, 5, 6]));

      await sendVoiceOutResponse({
        chatId: 11,
        userId: 1002,
        lang: "en",
        text: buildPanicVoiceOutText(6, "en"),
        prerecorded: { kind: "panic", panicId: 6 },
      });

      expect(checkSharedRateLimit).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(hoisted.sentMessages).toHaveLength(0);
      expect(hoisted.sentAudio).toEqual([
        expect.objectContaining({
          chatId: 11,
          audio: new Uint8Array([4, 5, 6]),
          filename: "panic-6-en.ogg",
          mimeType: "audio/ogg",
        }),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not reuse a Gemini-compatible OpenAI key as a speech endpoint", async () => {
    process.env.OPENAI_API_KEY = "gemini-key";
    process.env.OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    delete process.env.GEMINI_TTS_API_KEY;
    delete process.env["Gemini TTS"];

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeVoiceOut("Я рядом. Завершите звонок.", 1001)).resolves.toMatchObject({
      ok: false,
      reason: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Gemini TTS first and wraps raw PCM as WAV", async () => {
    process.env.GEMINI_TTS_API_KEY = "gemini-tts-key";
    process.env.GEMINI_TTS_MODEL = "gemini-test-tts";
    process.env.GEMINI_TTS_VOICE = "Kore";
    delete process.env.OPENAI_TTS_API_KEY;

    const pcm = new Uint8Array([1, 0, 2, 0]);
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
        generationConfig: {
          responseModalities: string[];
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: string } } };
        };
      };
      expect(String(_url)).toContain("/models/gemini-test-tts:generateContent");
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("gemini-tts-key");
      expect(body.contents[0]?.parts[0]?.text.length).toBeGreaterThan(10);
      expect(body.generationConfig.responseModalities).toEqual(["AUDIO"]);
      expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
        "Kore",
      );
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/l16; rate=24000; channels=1",
                    data: Buffer.from(pcm).toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeVoiceOut(
      "РЇ СЂСЏРґРѕРј. Р—Р°РІРµСЂС€РёС‚Рµ Р·РІРѕРЅРѕРє.",
      1004,
    );

    expect(result).toMatchObject({
      ok: true,
      mimeType: "audio/wav",
      filename: "ishonch-guard-voice.wav",
    });
    expect(result.ok && Buffer.from(result.bytes.subarray(0, 4)).toString("ascii")).toBe("RIFF");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OpenAI TTS when Gemini TTS fails", async () => {
    process.env.GEMINI_TTS_API_KEY = "gemini-tts-key";
    process.env.OPENAI_TTS_API_KEY = "openai-tts-key";
    process.env.OPENAI_TTS_BASE_URL = "https://tts.example/v1";
    process.env.OPENAI_TTS_MODEL = "test-tts";
    process.env.OPENAI_TTS_VOICE = "test-voice";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      synthesizeVoiceOut("РЇ СЂСЏРґРѕРј. Р—Р°РІРµСЂС€РёС‚Рµ Р·РІРѕРЅРѕРє.", 1005),
    ).resolves.toMatchObject({ ok: true, mimeType: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("generativelanguage.googleapis.com");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://tts.example/v1/audio/speech");
  });

  it("uses an explicit TTS key and removes raw links, usernames and long numbers", async () => {
    delete process.env.GEMINI_TTS_API_KEY;
    delete process.env["Gemini TTS"];
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

  it("suppresses duplicate voice-out sends and captions the spoken text", async () => {
    process.env.GEMINI_TTS_API_KEY = "gemini-tts-key";
    delete process.env.OPENAI_TTS_API_KEY;

    const pcm = new Uint8Array([1, 0, 2, 0]);
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/l16; rate=24000; channels=1",
                    data: Buffer.from(pcm).toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const args = {
      chatId: 20,
      userId: 2001,
      lang: "ru" as const,
      text: "Я рядом. Позвоните в банк по официальному номеру.",
      keyboard: [[{ text: "OK", callback_data: "ok" }]],
    };

    await sendVoiceOutResponse({ ...args, callbackQueryId: "voice-cb-1" });
    await sendVoiceOutResponse({ ...args, callbackQueryId: "voice-cb-2" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hoisted.sentActions).toEqual([{ chatId: 20, action: "upload_voice" }]);
    expect(hoisted.sentAudio).toHaveLength(1);
    expect(hoisted.sentMessages).toHaveLength(0);
    expect(hoisted.answeredCallbacks).toEqual([
      { id: "voice-cb-1", text: expect.stringContaining("Готовлю") },
      { id: "voice-cb-2", text: expect.stringContaining("уже") },
    ]);
    expect(hoisted.sentAudio[0]?.caption).toContain("Голосом");
    expect(hoisted.sentAudio[0]?.caption).toContain("Позвоните в банк");
  });

  it("does not regenerate the same voice tip when the user taps again a few minutes later", async () => {
    process.env.GEMINI_TTS_API_KEY = "gemini-tts-key";
    delete process.env.OPENAI_TTS_API_KEY;

    const pcm = new Uint8Array([1, 0, 2, 0]);
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/l16; rate=24000; channels=1",
                    data: Buffer.from(pcm).toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const now = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000_000)
      .mockReturnValueOnce(1_000_000 + 3 * 60_000);

    const args = {
      chatId: 21,
      userId: 2002,
      lang: "ru" as const,
      text: "Я рядом. Позвоните в банк и попросите заморозить перевод.",
      keyboard: [[{ text: "OK", callback_data: "ok" }]],
    };

    await sendVoiceOutResponse(args);
    await sendVoiceOutResponse(args);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hoisted.sentActions).toEqual([{ chatId: 21, action: "upload_voice" }]);
    expect(hoisted.sentAudio).toHaveLength(1);
    expect(hoisted.sentMessages).toHaveLength(0);
    now.mockRestore();
  });

  it("allows a retry after a failed voice-out attempt", async () => {
    process.env.GEMINI_TTS_API_KEY = "gemini-tts-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_API_KEY;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("provider down", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/l16; rate=24000; channels=1",
                      data: Buffer.from(new Uint8Array([1, 0, 2, 0])).toString("base64"),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const args = {
      chatId: 22,
      userId: 2003,
      lang: "ru" as const,
      text: "Я рядом. Завершите звонок и перезвоните по официальному номеру.",
      keyboard: [[{ text: "OK", callback_data: "ok" }]],
    };

    await sendVoiceOutResponse(args);
    await sendVoiceOutResponse(args);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentAudio).toHaveLength(1);
  });

  it("falls back to a text message when audio is not configured", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_API_KEY;
    delete process.env.GEMINI_TTS_API_KEY;
    delete process.env["Gemini TTS"];
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

  it("removes provider-only voice buttons from the rate-limit fallback keyboard", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TTS_API_KEY;
    delete process.env.GEMINI_TTS_API_KEY;
    delete process.env["Gemini TTS"];
    hoisted.rateLimitResult = { ok: false, retryAfterSec: 3600 };
    vi.stubGlobal("fetch", vi.fn());

    await sendVoiceOutResponse({
      chatId: 30,
      userId: 3003,
      lang: "en",
      text: "I am with you. End the call and call the bank back on the official number.",
      keyboard: [
        [
          { text: "Voice", callback_data: "voiceout:guardian" },
          { text: "Full plan", callback_data: "guardian:full_plan" },
        ],
        [
          { text: "Context voice", callback_data: "voiceout:panic:4:script" },
          { text: "Static SOS voice", callback_data: "voiceout:panic:4" },
        ],
      ],
    });

    expect(checkSharedRateLimit).toHaveBeenCalled();
    expect(hoisted.sentAudio).toHaveLength(0);
    expect(hoisted.sentMessages).toEqual([
      expect.objectContaining({
        chatId: 30,
        keyboard: [
          [{ text: "Full plan", callback_data: "guardian:full_plan" }],
          [{ text: "Static SOS voice", callback_data: "voiceout:panic:4" }],
        ],
      }),
    ]);
  });
});
