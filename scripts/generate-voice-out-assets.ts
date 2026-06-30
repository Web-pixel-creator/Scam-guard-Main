// Generate static Telegram Voice-out assets for main SOS panic callbacks.
//
// Usage:
//   railway run npm run tts:generate-assets -- --force
//
// Security: this script never prints API keys, request bodies, generated audio
// content, or user evidence. It uses only static, reviewed SOS scripts.
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { buildPanicVoiceOutText } from "@/lib/telegram/voice-out.server";

const PANIC_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
const LANGS = ["ru", "uz", "en"] as const;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), "public", "audio", "voice-out");
const DEFAULT_OPENAI_TTS_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_OPENAI_TTS_VOICE = "alloy";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_GEMINI_TTS_VOICE = "Kore";
const TIMEOUT_MS = 20_000;

type Lang = (typeof LANGS)[number];
type PanicId = (typeof PANIC_IDS)[number];
type GeneratedAudio = { bytes: Uint8Array; filename: string; provider: string };

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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

function parseGeminiPcmMime(mimeType: string): { sampleRate: number; channels: number } {
  const rate = Number(mimeType.match(/\brate=(\d+)/i)?.[1] || 24_000);
  const channels = Number(mimeType.match(/\bchannels=(\d+)/i)?.[1] || 1);
  return {
    sampleRate: Number.isFinite(rate) && rate > 0 ? rate : 24_000,
    channels: Number.isFinite(channels) && channels > 0 ? channels : 1,
  };
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const headerSize = 44;
  const bytesPerSample = 2;
  const wav = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) wav[offset + i] = value.charCodeAt(i);
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, headerSize);
  return wav;
}

async function generateGemini(text: string, panicId: PanicId, lang: Lang): Promise<GeneratedAudio> {
  const apiKey = optionalEnv("GEMINI_TTS_API_KEY") || optionalEnv("GOOGLE_TTS_API_KEY");
  if (!apiKey) fail("GEMINI_TTS_API_KEY or GOOGLE_TTS_API_KEY is required");

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
        contents: [{ parts: [{ text }] }],
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

  if (!res.ok) fail(`gemini tts returned status=${res.status}, panic=${panicId}, lang=${lang}`);

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
  const mimeType = part?.inlineData?.mimeType || part?.inline_data?.mime_type || "";
  if (!encoded || !mimeType.includes("audio")) {
    fail(`gemini tts returned no audio, panic=${panicId}, lang=${lang}`);
  }

  const raw = new Uint8Array(Buffer.from(encoded, "base64"));
  const { sampleRate, channels } = parseGeminiPcmMime(mimeType);
  return {
    bytes: pcm16ToWav(raw, sampleRate, channels),
    filename: `panic-${panicId}-${lang}.wav`,
    provider: "gemini",
  };
}

async function generateOpenAi(text: string, panicId: PanicId, lang: Lang): Promise<GeneratedAudio> {
  const apiKey = optionalEnv("OPENAI_TTS_API_KEY");
  if (!apiKey) fail("OPENAI_TTS_API_KEY is required");

  const baseUrl = (optionalEnv("OPENAI_TTS_BASE_URL") || DEFAULT_OPENAI_TTS_BASE_URL).replace(
    /\/+$/,
    "",
  );
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
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) fail(`openai tts returned status=${res.status}, panic=${panicId}, lang=${lang}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 100) fail(`openai tts returned too few bytes, panic=${panicId}`);
  return { bytes, filename: `panic-${panicId}-${lang}.mp3`, provider: "openai" };
}

function preferredProvider(): "gemini" | "openai" {
  const preferred = (process.env.TTS_PROVIDER || process.env.VOICE_OUT_TTS_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (preferred === "openai") return "openai";
  if (optionalEnv("GEMINI_TTS_API_KEY") || optionalEnv("GOOGLE_TTS_API_KEY")) return "gemini";
  return "openai";
}

async function main(): Promise<void> {
  const outputDir = optionalEnv("VOICE_OUT_PRERECORDED_DIR") || DEFAULT_OUTPUT_DIR;
  const force = process.argv.includes("--force");
  const provider = preferredProvider();
  await mkdir(outputDir, { recursive: true });

  let written = 0;
  let skipped = 0;
  for (const panicId of PANIC_IDS) {
    for (const lang of LANGS) {
      const text = buildPanicVoiceOutText(panicId, lang);
      const expectedExt = provider === "gemini" ? "wav" : "mp3";
      const target = path.join(outputDir, `panic-${panicId}-${lang}.${expectedExt}`);
      if (!force && (await exists(target))) {
        skipped += 1;
        console.log(`SKIP panic-${panicId}-${lang}.${expectedExt}`);
        continue;
      }

      const audio =
        provider === "gemini"
          ? await generateGemini(text, panicId, lang)
          : await generateOpenAi(text, panicId, lang);
      await writeFile(path.join(outputDir, audio.filename), audio.bytes);
      written += 1;
      console.log(
        `OK ${audio.filename} provider=${audio.provider} bytes=${audio.bytes.byteLength}`,
      );
    }
  }

  console.log(`DONE written=${written} skipped=${skipped} dir=${outputDir}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "unknown error");
});
