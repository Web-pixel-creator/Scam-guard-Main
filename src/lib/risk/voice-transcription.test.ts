import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  checkSharedRateLimit: vi.fn(),
}));

vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: hoisted.checkSharedRateLimit,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {},
}));

import { transcribeVoiceCore } from "./check-core";

const DATA_URL = `data:audio/ogg;base64,${Buffer.from("fake audio").toString("base64")}`;

type FetchMock = ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>
>;

describe("transcribeVoiceCore", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    hoisted.checkSharedRateLimit.mockResolvedValue({
      ok: true,
      remaining: 9,
      retryAfterSec: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses Gemini native audio and redacts sensitive transcript text", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai");
    vi.stubEnv("OPENAI_MODEL", "gemini-3.5-flash");

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Мне сказали назвать SMS код 123456 и номер +998901234567" }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeVoiceCore(DATA_URL, "ru", "tg:42");

    expect(result.text).toContain("SMS");
    expect(result.text).not.toContain("123456");
    expect(result.text).not.toContain("+998901234567");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/models/gemini-3.5-flash:generateContent");
    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts[0].text).toContain("Uzbek");
    expect(body.contents[0].parts[0].text).toContain("SMS-kod");
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe("audio/ogg");
  });

  it("uses OpenAI-compatible audio transcriptions when the provider is not Gemini", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Просят перевести деньги на безопасный счет" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeVoiceCore(DATA_URL, "ru", "tg:42");

    expect(result.text).toBe("Просят перевести деньги на безопасный счет");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(form.get("language")).toBeNull();
    expect(String(form.get("prompt"))).toContain("Uzbek");
    expect(String(form.get("prompt"))).toContain("SMS-kod");
    expect(String(form.get("prompt"))).toContain("kod yubormadim");
    expect(String(form.get("prompt"))).toContain("singlim qo'ng'iroq qilyapti");
    expect(String(form.get("prompt"))).toContain("kanal administratori menga yozmoqda");
    expect(String(form.get("prompt"))).toContain("SMS kodini yuborishimni so'rayapti");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("does not force the UI language as the STT language hint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Men SMS kod yubormadim." }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await transcribeVoiceCore(DATA_URL, "ru", "tg:42");

    const [, init] = fetchMock.mock.calls[0]!;
    const form = init?.body as FormData;
    expect(form.get("language")).toBeNull();
    expect(String(form.get("prompt"))).toContain("UI language is Russian");
    expect(String(form.get("prompt"))).toContain("spoken audio may be Russian, Uzbek");
  });

  it("normalizes a live Uzbek-Latin STT language-drift artifact", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://api.openai.com/v1");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");

    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Men SMS-kort, jo, hvorfor med dem." }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeVoiceCore(DATA_URL, "ru", "tg:42");

    expect(result.text).toBe("Men SMS kod yubormadim.");
  });

  it("returns null without an AI key and does not call fetch", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_BASE_URL", "");
    vi.stubEnv("OPENAI_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeVoiceCore(DATA_URL, "ru", "tg:42");

    expect(result).toEqual({ text: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not own user budget decisions; callers rate-limit STT before provider calls", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    hoisted.checkSharedRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      retryAfterSec: 17,
    });
    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Просят SMS код" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(transcribeVoiceCore(DATA_URL, "ru", "tg:42")).resolves.toMatchObject({
      text: expect.stringContaining("SMS"),
    });
    expect(hoisted.checkSharedRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
