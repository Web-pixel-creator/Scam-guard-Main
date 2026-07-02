import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  FixtureCliError,
  assertIncludes,
  mimeTypeForAudioPath,
  parseManifest,
  resolveFixtureAudioPath,
} from "../../../scripts/transcribe-voice-stt-fixtures";

describe("transcribe voice STT fixture collector helpers", () => {
  it("validates the manifest shape before any provider call", () => {
    expect(() => parseManifest({ cases: [] })).toThrow(FixtureCliError);
    expect(() =>
      parseManifest({
        cases: [{ id: "bad-lang", lang: "de", audioPath: "./clip.ogg" }],
      }),
    ).toThrow("lang must be ru, uz, or en");
    expect(() =>
      parseManifest({
        cases: [
          { id: "bad-expected", lang: "ru", audioPath: "./clip.ogg", expectedIncludes: [42] },
        ],
      }),
    ).toThrow("expectedIncludes must be an array of strings");

    expect(
      parseManifest({
        cases: [{ id: "ru-live-001", lang: "ru", audioPath: "./clip.ogg" }],
      }),
    ).toEqual({
      cases: [
        {
          id: "ru-live-001",
          lang: "ru",
          audioPath: "./clip.ogg",
          expectedIncludes: [],
          note: undefined,
        },
      ],
    });
  });

  it("keeps local audio reads scoped to the manifest directory", () => {
    const manifestPath = path.resolve("private/voice-stt-fixtures/manifest.json");

    expect(resolveFixtureAudioPath(manifestPath, "./ru/live-001.ogg")).toBe(
      path.resolve("private/voice-stt-fixtures/ru/live-001.ogg"),
    );
    expect(() => resolveFixtureAudioPath(manifestPath, "../outside.ogg")).toThrow(
      "must stay inside the manifest directory",
    );
    expect(() => resolveFixtureAudioPath(manifestPath, path.resolve("clip.ogg"))).toThrow(
      "must be relative",
    );
  });

  it("accepts only supported Telegram audio fixture extensions", () => {
    expect(mimeTypeForAudioPath("voice.ogg")).toBe("audio/ogg");
    expect(mimeTypeForAudioPath("voice.oga")).toBe("audio/ogg");
    expect(mimeTypeForAudioPath("voice.opus")).toBe("audio/ogg");
    expect(mimeTypeForAudioPath("voice.mp3")).toBe("audio/mpeg");
    expect(mimeTypeForAudioPath("voice.m4a")).toBe("audio/mp4");
    expect(mimeTypeForAudioPath("voice.wav")).toBe("audio/wav");
    expect(mimeTypeForAudioPath("voice.webm")).toBe("audio/webm");
    expect(() => mimeTypeForAudioPath("voice.txt")).toThrow("unsupported audio extension");
  });

  it("checks expected fragments against sanitized transcripts case-insensitively", () => {
    expect(() =>
      assertIncludes("ru-live-001", "SMS code was redacted", ["sms", "CODE"]),
    ).not.toThrow();
    expect(() => assertIncludes("ru-live-001", "SMS code was redacted", ["card"])).toThrow(
      'expected fragment "card"',
    );
  });
});
