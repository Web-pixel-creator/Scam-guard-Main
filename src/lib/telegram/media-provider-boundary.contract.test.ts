import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const HANDLERS_DIR = join(process.cwd(), "src", "lib", "telegram", "handlers");
const SRC_DIR = join(process.cwd(), "src");
const CHECK_CORE_SOURCE = readFileSync(
  join(process.cwd(), "src", "lib", "risk", "check-core.ts"),
  "utf8",
);

function source(name: string): string {
  return readFileSync(join(HANDLERS_DIR, name), "utf8");
}

function productionTypeScriptFiles(directory = SRC_DIR): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionTypeScriptFiles(path);
    if (!entry.isFile() || !/\.(?:ts|tsx)$/u.test(entry.name)) return [];
    if (/\.(?:test|spec)\.(?:ts|tsx)$/u.test(entry.name)) return [];
    return [path];
  });
}

function section(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

function expectLastMileHookBeforeFetch(transport: string): void {
  const hookMatch = /await (?:options\.)?beforeProviderTransfer\?\.\(\)/u.exec(transport);
  const hook = hookMatch?.index ?? -1;
  const fetchCall = transport.indexOf("await fetch(", hook);
  expect(hook).toBeGreaterThanOrEqual(0);
  expect(fetchCall).toBeGreaterThan(hook);
  expect(transport.slice(hook + (hookMatch?.[0].length ?? 0), fetchCall)).not.toMatch(/\bawait\b/u);
}

describe("Telegram external media provider boundary", () => {
  it("keeps every production vision/STT caller in the audited consent-gated handlers", () => {
    const checkCorePath = join(SRC_DIR, "lib", "risk", "check-core.ts");
    const callSites = productionTypeScriptFiles()
      .filter((path) => path !== checkCorePath)
      .flatMap((path) => {
        const matches =
          readFileSync(path, "utf8").match(/\b(?:analyzeImageCore|transcribeVoiceCore)\s*\(/gu) ??
          [];
        const sourcePath = relative(SRC_DIR, path).replaceAll("\\", "/");
        return matches.map((call) => `${sourcePath}:${call.replace(/\s+/gu, "")}`);
      });

    expect(callSites.sort()).toEqual(
      [
        "lib/telegram/handlers/check.ts:analyzeImageCore(",
        "lib/telegram/handlers/check.ts:transcribeVoiceCore(",
        "lib/telegram/handlers/report.ts:analyzeImageCore(",
      ].sort(),
    );
  });

  it("consumes the matching grant before each provider call", () => {
    const check = source("check.ts");
    const report = source("report.ts");

    const imageConsent = check.indexOf('consumeMediaProviderConsent(ctx, "image")');
    const imageAdmission = check.indexOf("claimTelegramImageDownloadBudget", imageConsent);
    const imageDownload = check.indexOf("getFile(fileId)", imageConsent);
    const imageProvider = check.indexOf("analyzeImageCore(", imageConsent);
    expect(imageConsent).toBeGreaterThan(-1);
    expect(imageAdmission).toBeGreaterThan(imageConsent);
    expect(imageDownload).toBeGreaterThan(imageConsent);
    expect(imageProvider).toBeGreaterThan(imageDownload);
    expect(imageProvider).toBeGreaterThan(imageConsent);

    const voiceConsent = check.indexOf('consumeMediaProviderConsent(ctx, "voice")');
    const voiceMetadataLimit = check.indexOf("declaredSize > MAX_VOICE_BYTES", voiceConsent);
    const voiceDownload = check.indexOf("downloadFileAsDataUrl", voiceConsent);
    const voiceProvider = check.indexOf("transcribeVoiceCore(", voiceConsent);
    expect(voiceConsent).toBeGreaterThan(-1);
    expect(voiceMetadataLimit).toBeGreaterThan(voiceConsent);
    expect(voiceProvider).toBeGreaterThan(voiceDownload);
    expect(voiceProvider).toBeGreaterThan(voiceConsent);

    const reportConsent = report.indexOf('consumeMediaProviderConsent(ctx, "report_image")');
    const reportDownload = report.indexOf("getFile(fileId)", reportConsent);
    const reportProvider = report.indexOf("analyzeImageCore(", reportConsent);
    expect(reportConsent).toBeGreaterThan(-1);
    expect(reportDownload).toBeGreaterThan(reportConsent);
    expect(reportProvider).toBeGreaterThan(reportDownload);
  });

  it("places the live-lease hook at every raw HTTP transport after prior awaited work", () => {
    const geminiVoice = section(
      CHECK_CORE_SOURCE,
      "async function transcribeAudioWithGemini",
      "async function transcribeAudioWithOpenAiCompatible",
    );
    const openAiVoice = section(
      CHECK_CORE_SOURCE,
      "async function transcribeAudioWithOpenAiCompatible",
      "/** Body shape accepted by the OpenAI-compatible Chat Completions API.",
    );
    const chatCompletion = section(
      CHECK_CORE_SOURCE,
      "async function callChatCompletionOnce",
      "async function chatCompletionWithRetry",
    );

    expectLastMileHookBeforeFetch(geminiVoice);
    expectLastMileHookBeforeFetch(openAiVoice);
    expectLastMileHookBeforeFetch(chatCompletion);
    expect(CHECK_CORE_SOURCE).toContain("options.beforeProviderTransfer,");
  });

  it("pins all consented media paths to one attempt, no fallback and the live hook", () => {
    const check = source("check.ts");
    const report = source("report.ts");

    expect(check).toContain("const TELEGRAM_IMAGE_ANALYSIS_OPTIONS = {");
    expect(check).toMatch(
      /TELEGRAM_IMAGE_ANALYSIS_OPTIONS\s*=\s*\{[\s\S]*?maxAttempts:\s*1,[\s\S]*?allowFallback:\s*false,[\s\S]*?beforeProviderTransfer:\s*assertMediaProviderTransferAllowed/u,
    );
    expect(check).toMatch(
      /TELEGRAM_VOICE_TRANSCRIBE_OPTIONS\s*=\s*\{[\s\S]*?maxAttempts:\s*1,[\s\S]*?allowFallback:\s*false,[\s\S]*?beforeProviderTransfer:\s*assertMediaProviderTransferAllowed/u,
    );
    expect(report).toMatch(
      /REPORT_IMAGE_ANALYSIS_OPTIONS\s*=\s*\{[\s\S]*?maxAttempts:\s*1,[\s\S]*?allowFallback:\s*false,[\s\S]*?beforeProviderTransfer:\s*assertMediaProviderTransferAllowed/u,
    );
    expect(check).toContain("TELEGRAM_IMAGE_ANALYSIS_OPTIONS,");
    expect(check).toContain("TELEGRAM_VOICE_TRANSCRIBE_OPTIONS,");
    expect(report).toContain("REPORT_IMAGE_ANALYSIS_OPTIONS,");
  });
});
