// Smoke test for the optional Telegram Voice-out / TTS path.
//
// Usage:
//   railway run npm run tts:smoke
//
// Security: this script never prints API keys, request bodies, user evidence,
// generated audio content, or provider error bodies.
import process from "node:process";

const DEFAULT_OPENAI_TTS_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "alloy";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_GEMINI_TTS_VOICE = "Kore";
const TIMEOUT_MS = 15_000;

type Provider = "gemini" | "openai";

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function preferredProviders(): Provider[] {
  const preferred = (process.env.TTS_PROVIDER || process.env.VOICE_OUT_TTS_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (preferred === "openai") return ["openai", "gemini"];
  return ["gemini", "openai"];
}

async function smokeGemini(): Promise<boolean> {
  const apiKey = optionalEnv("GEMINI_TTS_API_KEY") || optionalEnv("GOOGLE_TTS_API_KEY");
  if (!apiKey) return false;

  const model = optionalEnv("GEMINI_TTS_MODEL") || DEFAULT_GEMINI_TTS_MODEL;
  const voice = optionalEnv("GEMINI_TTS_VOICE") || DEFAULT_GEMINI_TTS_VOICE;
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Say calmly: Ishonch Guard voice check is ready." }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    },
  );

  if (!res.ok) fail(`gemini tts returned status=${res.status}, model=${model}, voice=${voice}`);

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
    }>;
  };
  const part = json.candidates?.[0]?.content?.parts?.find(
    (candidate) => candidate.inlineData?.data || candidate.inline_data?.data,
  );
  const encoded = part?.inlineData?.data || part?.inline_data?.data || "";
  const mimeType = part?.inlineData?.mimeType || part?.inline_data?.mime_type || "missing";
  const bytes = encoded ? Buffer.byteLength(encoded, "base64") : 0;
  if (bytes < 100) fail(`gemini tts returned too few bytes=${bytes}, model=${model}, voice=${voice}`);
  if (!mimeType.includes("audio")) {
    fail(`gemini tts returned unexpected mime=${mimeType}, model=${model}, voice=${voice}`);
  }

  console.log(`OK tts provider=gemini model=${model} voice=${voice} mime=${mimeType} bytes=${bytes}`);
  return true;
}

async function smokeOpenAi(): Promise<boolean> {
  const apiKey = optionalEnv("OPENAI_TTS_API_KEY");
  if (!apiKey) return false;

  const baseUrl = (optionalEnv("OPENAI_TTS_BASE_URL") || DEFAULT_OPENAI_TTS_BASE_URL).replace(/\/+$/, "");
  const model = optionalEnv("OPENAI_TTS_MODEL") || DEFAULT_OPENAI_TTS_MODEL;
  const voice = optionalEnv("OPENAI_TTS_VOICE") || DEFAULT_OPENAI_TTS_VOICE;

  const res = await fetchWithTimeout(`${baseUrl}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      voice,
      input: "Ishonch Guard voice check is ready.",
      response_format: "mp3",
    }),
  });

  if (!res.ok) fail(`openai tts returned status=${res.status}, model=${model}, voice=${voice}`);

  const contentType = res.headers.get("content-type") || "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 100) {
    fail(`openai tts returned too few bytes=${bytes.byteLength}, model=${model}, voice=${voice}`);
  }
  if (!contentType.includes("audio") && !contentType.includes("octet-stream")) {
    fail(`openai tts returned unexpected content-type=${contentType || "missing"}`);
  }

  console.log(`OK tts provider=openai model=${model} voice=${voice} status=${res.status} bytes=${bytes.byteLength}`);
  return true;
}

async function main(): Promise<void> {
  for (const provider of preferredProviders()) {
    const handled = provider === "gemini" ? await smokeGemini() : await smokeOpenAi();
    if (handled) return;
  }
  fail("no TTS provider is configured; set GEMINI_TTS_API_KEY or OPENAI_TTS_API_KEY");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  fail(`tts smoke failed: ${message}`);
});
