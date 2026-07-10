// Optional live STT fixture collector for Voice-in QA.
//
// Usage:
//   npm run stt:transcribe-fixtures -- --manifest private/voice-stt-fixtures/manifest.json
//   npm run stt:transcribe-fixtures -- --manifest private/voice-stt-fixtures/manifest.json --output private/voice-stt-fixtures/transcripts.json
//
// Security: this script never prints API keys, raw audio bytes, provider error
// bodies, or Telegram identifiers. Audio is read from local files and sent only
// to the configured STT provider through transcribeVoiceCore. Output transcripts
// are the sanitized/redacted strings returned by the app pipeline.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import type { Lang } from "@/lib/i18n";
import { transcribeVoiceCore } from "@/lib/risk/check-core";

const MAX_FIXTURE_AUDIO_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

interface AudioFixtureManifest {
  cases: AudioFixtureCase[];
}

interface AudioFixtureCase {
  id: string;
  lang: Lang;
  audioPath: string;
  expectedIncludes?: string[];
  note?: string;
}

interface CapturedTranscriptFixture {
  id: string;
  lang: Lang;
  transcript: string;
  sourceKind: "provider_sanitized_transcript";
  note: string;
}

export class FixtureCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureCliError";
  }
}

function fail(message: string): never {
  throw new FixtureCliError(message);
}

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function parseArgs(): {
  manifestPath: string | null;
  outputPath: string | null;
  timeoutMs: number;
} {
  const args = process.argv.slice(2);
  let manifestPath: string | null = null;
  let outputPath: string | null = null;
  let timeoutMs = DEFAULT_TIMEOUT_MS;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: npm run stt:transcribe-fixtures -- --manifest <manifest.json> [--output <transcripts.json>]",
          "       npm run stt:transcribe-fixtures -- --manifest <manifest.json> --timeout-ms 60000",
          "",
          "Manifest shape:",
          '{ "cases": [{ "id": "ru-sms-code-live-001", "lang": "ru", "audioPath": "./ru-sms-code.ogg", "expectedIncludes": ["sms", "код"] }] }',
          "",
          "Audio paths are resolved relative to the manifest file. Output contains sanitized transcripts only.",
        ].join("\n"),
      );
      process.exit(0);
    }
    if (arg === "--manifest") {
      manifestPath = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--output") {
      outputPath = args[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      const value = Number(args[i + 1]);
      if (!Number.isInteger(value) || value < MIN_TIMEOUT_MS || value > MAX_TIMEOUT_MS) {
        fail(`--timeout-ms must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`);
      }
      timeoutMs = value;
      i += 1;
      continue;
    }
    if (!arg.startsWith("-") && !manifestPath) manifestPath = arg;
  }

  return { manifestPath, outputPath, timeoutMs };
}

function isLang(value: unknown): value is Lang {
  return value === "ru" || value === "uz" || value === "en";
}

export function parseManifest(value: unknown): AudioFixtureManifest {
  const cases = (value as { cases?: unknown })?.cases;
  if (!Array.isArray(cases) || cases.length === 0) {
    fail("manifest must contain a non-empty cases array");
  }

  return {
    cases: cases.map((candidate, index) => {
      const row = candidate as Partial<AudioFixtureCase>;
      if (!row.id || typeof row.id !== "string") fail(`case ${index}: missing id`);
      if (!isLang(row.lang)) fail(`case ${row.id}: lang must be ru, uz, or en`);
      if (!row.audioPath || typeof row.audioPath !== "string") {
        fail(`case ${row.id}: missing audioPath`);
      }
      if (
        row.expectedIncludes !== undefined &&
        (!Array.isArray(row.expectedIncludes) ||
          row.expectedIncludes.some((item) => typeof item !== "string"))
      ) {
        fail(`case ${row.id}: expectedIncludes must be an array of strings`);
      }
      return {
        id: row.id,
        lang: row.lang,
        audioPath: row.audioPath,
        expectedIncludes: row.expectedIncludes ?? [],
        note: typeof row.note === "string" ? row.note : undefined,
      };
    }),
  };
}

export function mimeTypeForAudioPath(audioPath: string): string {
  const ext = path.extname(audioPath).toLowerCase();
  if (ext === ".ogg" || ext === ".oga" || ext === ".opus") return "audio/ogg";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a" || ext === ".mp4") return "audio/mp4";
  if (ext === ".webm") return "audio/webm";
  fail(`unsupported audio extension for ${path.basename(audioPath)}`);
}

function isPathInside(parentDir: string, candidatePath: string): boolean {
  const relative = path.relative(parentDir, candidatePath);
  return (
    relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function resolveFixtureAudioPath(manifestPath: string, audioPath: string): string {
  if (path.isAbsolute(audioPath)) {
    fail(`audioPath for ${path.basename(audioPath)} must be relative to the manifest file`);
  }
  const manifestDir = path.dirname(path.resolve(manifestPath));
  const resolvedAudioPath = path.resolve(manifestDir, audioPath);
  if (!isPathInside(manifestDir, resolvedAudioPath)) {
    fail(`audioPath ${audioPath} must stay inside the manifest directory`);
  }
  return resolvedAudioPath;
}

async function readAudioDataUrl(audioPath: string): Promise<string> {
  const bytes = await readFile(audioPath);
  if (bytes.byteLength === 0) fail(`${path.basename(audioPath)} is empty`);
  if (bytes.byteLength > MAX_FIXTURE_AUDIO_BYTES) {
    fail(`${path.basename(audioPath)} exceeds ${MAX_FIXTURE_AUDIO_BYTES} bytes`);
  }
  return `data:${mimeTypeForAudioPath(audioPath)};base64,${bytes.toString("base64")}`;
}

export function assertIncludes(
  caseId: string,
  transcript: string,
  expectedIncludes: readonly string[],
): void {
  const normalized = transcript.toLowerCase();
  for (const expected of expectedIncludes) {
    if (!normalized.includes(expected.toLowerCase())) {
      fail(`case ${caseId}: sanitized transcript did not include expected fragment "${expected}"`);
    }
  }
}

export async function main(): Promise<void> {
  const { manifestPath, outputPath, timeoutMs } = parseArgs();
  if (!manifestPath) fail("missing --manifest <path>");
  if (!optionalEnv("OPENAI_API_KEY")) {
    fail("OPENAI_API_KEY is not configured for STT provider access");
  }

  const resolvedManifestPath = path.resolve(manifestPath);
  const manifest = parseManifest(JSON.parse(await readFile(resolvedManifestPath, "utf8")));
  const captured: CapturedTranscriptFixture[] = [];

  for (const item of manifest.cases) {
    const audioPath = resolveFixtureAudioPath(resolvedManifestPath, item.audioPath);
    const dataUrl = await readAudioDataUrl(audioPath);
    const result = await transcribeVoiceCore(dataUrl, item.lang, `fixture:${item.id}`, {
      timeoutMs,
    });
    if (!result.text) fail(`case ${item.id}: provider returned no usable transcript`);
    assertIncludes(item.id, result.text, item.expectedIncludes ?? []);
    captured.push({
      id: item.id,
      lang: item.lang,
      transcript: result.text,
      sourceKind: "provider_sanitized_transcript",
      note: item.note ?? `Captured from local audio fixture ${path.basename(audioPath)}`,
    });
    console.log(`OK stt fixture id=${item.id} lang=${item.lang} chars=${result.text.length}`);
  }

  const output = JSON.stringify({ ok: true, captured }, null, 2);
  if (outputPath) {
    await writeFile(path.resolve(outputPath), `${output}\n`, "utf8");
    console.log(`OK wrote sanitized transcript fixtures to ${path.resolve(outputPath)}`);
  } else {
    console.log(output);
  }
}

function isMainModule(): boolean {
  if (process.env.VITEST) return false;
  if (process.env.npm_lifecycle_event === "stt:transcribe-fixtures") return true;
  return process.argv.some((arg) => {
    const normalized = arg.replace(/\\/g, "/");
    return (
      normalized === "scripts/transcribe-voice-stt-fixtures.ts" ||
      normalized.endsWith("/scripts/transcribe-voice-stt-fixtures.ts")
    );
  });
}

if (isMainModule()) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`FAIL stt fixture transcription failed: ${message}`);
    process.exit(1);
  });
}
