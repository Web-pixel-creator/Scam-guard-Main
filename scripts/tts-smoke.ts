// Smoke test for the optional Telegram Voice-out / OpenAI TTS path.
//
// Usage:
//   OPENAI_TTS_API_KEY=... npm run tts:smoke
//   railway run npm run tts:smoke
//
// Security: this script never prints API keys, request bodies, user evidence,
// generated audio content, or provider error bodies.
import process from "node:process";

const DEFAULT_TTS_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const DEFAULT_TTS_VOICE = "alloy";
const TIMEOUT_MS = 15_000;

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is not set`);
  return value;
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

async function main(): Promise<void> {
  const apiKey = requiredEnv("OPENAI_TTS_API_KEY");
  const baseUrl = (process.env.OPENAI_TTS_BASE_URL || DEFAULT_TTS_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const voice = process.env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE;

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

  if (!res.ok) {
    fail(`tts provider returned status=${res.status}, model=${model}, voice=${voice}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 100) {
    fail(`tts provider returned too few bytes=${bytes.byteLength}, model=${model}, voice=${voice}`);
  }
  if (!contentType.includes("audio") && !contentType.includes("octet-stream")) {
    fail(`tts provider returned unexpected content-type=${contentType || "missing"}`);
  }

  console.log(
    `OK tts provider: model=${model}, voice=${voice}, status=${res.status}, bytes=${bytes.byteLength}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  fail(`tts smoke failed: ${message}`);
});
