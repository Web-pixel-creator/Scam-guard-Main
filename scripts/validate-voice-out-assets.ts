import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { Lang } from "@/lib/i18n";
import { buildPanicVoiceOutText } from "@/lib/telegram/voice-out.server";

const VOICE_OUT_DIR = path.join(process.cwd(), "public", "audio", "voice-out");
const PANIC_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
const LANGS = ["ru", "uz", "en"] as const satisfies readonly Lang[];
const MAX_AUDIO_BYTES = 1_500_000;
const MAX_SCRIPT_CHARS = 520;
const MIN_DURATION_SEC = 1;
const MAX_DURATION_SEC = 30;

function fail(message: string): never {
  throw new Error(`voice-out asset validation failed: ${message}`);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Buffer.from(bytes.subarray(start, start + length)).toString("ascii");
}

function oggOpusDurationSec(bytes: Uint8Array): number {
  if (ascii(bytes, 0, 4) !== "OggS") fail("not an Ogg container");
  if (Buffer.from(bytes.subarray(0, Math.min(bytes.byteLength, 4096))).indexOf("OpusHead") < 0) {
    fail("Ogg file does not contain OpusHead");
  }

  let offset = 0;
  let lastGranule = 0n;
  while (offset + 27 <= bytes.byteLength) {
    if (ascii(bytes, offset, 4) !== "OggS") fail(`bad Ogg page at byte ${offset}`);
    const segments = bytes[offset + 26];
    const tableStart = offset + 27;
    const dataStart = tableStart + segments;
    if (dataStart > bytes.byteLength) fail(`truncated Ogg segment table at byte ${offset}`);

    let payloadLength = 0;
    for (let i = 0; i < segments; i += 1) payloadLength += bytes[tableStart + i] ?? 0;
    const next = dataStart + payloadLength;
    if (next > bytes.byteLength) fail(`truncated Ogg page payload at byte ${offset}`);

    const granule = new DataView(bytes.buffer, bytes.byteOffset + offset + 6, 8).getBigUint64(
      0,
      true,
    );
    if (granule !== 0xffff_ffff_ffff_ffffn) lastGranule = granule;
    offset = next;
  }

  if (offset !== bytes.byteLength) fail(`trailing partial Ogg data at byte ${offset}`);
  if (lastGranule <= 0n) fail("Ogg Opus granule position is missing");
  return Number(lastGranule) / 48_000;
}

function validateScript(id: (typeof PANIC_IDS)[number], lang: Lang): void {
  const script = buildPanicVoiceOutText(id, lang);
  if (script.length === 0) fail(`empty script panic-${id}-${lang}`);
  if (script.length > MAX_SCRIPT_CHARS) {
    fail(`script too long panic-${id}-${lang}: ${script.length} chars`);
  }
  if (/https?:\/\/|www\.|@[A-Za-z0-9_]{3,}/i.test(script)) {
    fail(`script contains link or handle panic-${id}-${lang}`);
  }
  if (/\b(?:\d[\s-]?){4,}\b/u.test(script)) {
    fail(`script contains a long digit run panic-${id}-${lang}`);
  }
}

async function validateOggAsset(filename: string): Promise<{ bytes: number; durationSec: number }> {
  const filePath = path.join(VOICE_OUT_DIR, filename);
  const info = await stat(filePath);
  if (!info.isFile()) fail(`${filename} is not a file`);
  if (info.size <= 0) fail(`${filename} is empty`);
  if (info.size > MAX_AUDIO_BYTES) fail(`${filename} exceeds ${MAX_AUDIO_BYTES} bytes`);

  const bytes = new Uint8Array(await readFile(filePath));
  const durationSec = oggOpusDurationSec(bytes);
  if (durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
    fail(`${filename} duration ${durationSec.toFixed(2)}s is outside expected range`);
  }
  return { bytes: info.size, durationSec };
}

async function main(): Promise<void> {
  const files = new Set(await readdir(VOICE_OUT_DIR));
  const rows: Array<{ filename: string; bytes: number; durationSec: number }> = [];

  for (const id of PANIC_IDS) {
    for (const lang of LANGS) {
      validateScript(id, lang);
      const filename = `panic-${id}-${lang}.ogg`;
      if (!files.has(filename)) fail(`missing ${filename}`);
      rows.push({ filename, ...(await validateOggAsset(filename)) });
    }
  }

  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const max = rows.reduce((current, row) => (row.bytes > current.bytes ? row : current), rows[0]);
  const min = rows.reduce((current, row) => (row.bytes < current.bytes ? row : current), rows[0]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        dir: VOICE_OUT_DIR,
        assets: rows.length,
        totalBytes,
        smallest: min,
        largest: max,
      },
      null,
      2,
    ),
  );
}

await main();
