import { describe, expect, it } from "vitest";

import {
  buildSensitiveSecretGuidance,
  detectTelegramSensitiveSecret,
} from "@/lib/telegram/sensitive-secret-input";

describe("detectTelegramSensitiveSecret", () => {
  it.each([
    ['pаssword: "Correct-Horse-Battery-Staple"', "password"],
    [
      "se\u200Bed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "recovery_phrase",
    ],
    ["S\u2066MS code: 731904", "code"],
    ["OTP\u202E: 482901", "code"],
    ['pаsswоrd: "Correct-Horse-Battery-Staple"', "password"],
    ['пaрoль: "Correct-Horse-Battery-Staple"', "password"],
    ["SМS cоde: 731904", "code"],
    ["Salom, bu kodni kiriting please: 1234", "code"],
    [
      "seеd phrаse: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "recovery_phrase",
    ],
  ] as const)("detects a secret behind an obfuscated label: %s", (input, expectedClass) => {
    const detected = detectTelegramSensitiveSecret(input);

    expect(detected?.redacted).toBe(true);
    expect(detected?.classes).toContain(expectedClass);
    expect(detected?.value).toContain("••••");
  });

  it.each([
    "Не сообщайте пароль от приложения",
    "A password should be strong",
    "Parolni hech kimga yubormang",
    "SMS code",
  ])("does not classify natural advice without a pasted value: %s", (input) => {
    expect(detectTelegramSensitiveSecret(input)).toBeNull();
  });
});

describe("buildSensitiveSecretGuidance", () => {
  it.each([
    ["ru", "password", /парол/iu],
    ["uz", "code", /kod/iu],
    ["en", "recovery_phrase", /recovery/iu],
  ] as const)("returns %s guidance for %s", (lang, secretClass, expected) => {
    const guidance = buildSensitiveSecretGuidance([secretClass], lang);

    expect(`${guidance.title}\n${guidance.description}`).toMatch(expected);
  });
});
