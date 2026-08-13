import { describe, expect, it } from "vitest";

import {
  buildSensitiveSecretGuidance,
  detectTelegramSensitiveSecret,
  hasPastedSensitiveSecretValue,
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
    ['p a s s w o r d: "Correct-Horse-Battery-Staple"', "password"],
    [
      "s e e d p h r a s e: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "recovery_phrase",
    ],
    ["p r i v a t e k e y: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", "private_key"],
    [
      "тиклаш ибораси:\napple\nbicycle\ncandle\ndragon\neagle\nforest\ngarden\nharbor\nisland\njungle\nkitten\nlemon",
      "recovery_phrase",
    ],
    ["махфий калит: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", "private_key"],
    ["verification code: AB12CD", "code"],
    ["verification code AB12CD", "code"],
    ["verificaton code: ZX90QW", "code"],
    ["pasword: AlphaSecret42", "password"],
    [
      "seed phrse: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "recovery_phrase",
    ],
    ["SMS code: AB-12-CD", "code"],
    ["SMS code: AB 12 CD", "code"],
    ["SMS code: AB_12_CD", "code"],
    ["AB12CD — verification code", "code"],
    ["AB12CD verification code", "code"],
    ["AB12CD is the SMS code", "code"],
    ["passphrase: CorrectHorseBatteryStaple42", "password"],
    ["махфий сўз: AlphaSecret42", "password"],
    ["махфий суз: BetaSecret84", "password"],
    ["password huntertwo", "password"],
    ["пароль секретный", "password"],
    ["parol maxfiysir", "password"],
    ["passphrase correct horse battery staple", "password"],
    ["пароль очень секретная фраза", "password"],
    ["parol juda maxfiy uzun soz", "password"],
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
    "A passphrase should be long",
    "The pasword typo is in the documentation",
    "The verificaton code field is empty",
    "Seed phrse means a wallet recovery secret",
    "Махфий сўз узун бўлиши керак",
    "SMS code",
    "Не сообщайте пароль незнакомым людям.",
    "Не сообщайте пароль от банковского приложения незнакомым.",
    "Bank ilovasi parolini notanish odamlarga aytmang.",
    "Do not tell strangers your password.",
    "всплывающее окно Apple ID просит пароль для проверки аккаунта",
    "Password policy requires eight character minimum.",
  ])("does not classify natural advice without a pasted value: %s", (input) => {
    expect(detectTelegramSensitiveSecret(input)).toBeNull();
  });
});

describe("hasPastedSensitiveSecretValue", () => {
  it.each(["I read out the one-time password", "Я уже сообщил одноразовый пароль"])(
    "distinguishes a completed-action reference from a pasted value: %s",
    (input) => {
      expect(hasPastedSensitiveSecretValue(input)).toBe(false);
    },
  );

  it.each([
    "Не сообщайте пароль незнакомым людям.",
    "Не сообщайте пароль от банковского приложения незнакомым.",
    "Bank ilovasi parolini notanish odamlarga aytmang.",
    "Do not tell strangers your password.",
    "всплывающее окно Apple ID просит пароль для проверки аккаунта",
  ])("keeps password safety guidance out of the pasted-value path: %s", (input) => {
    expect(hasPastedSensitiveSecretValue(input)).toBe(false);
  });

  it.each([
    'password: "Correct-Horse-Battery-Staple"',
    "password huntertwo",
    "пароль секретный",
    "parol maxfiysir",
    "passphrase correct horse battery staple",
    "пароль очень секретная фраза",
    "parol juda maxfiy uzun soz",
    "SMS code: 731904",
    "private key: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    "seed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
  ])("keeps an actual secret-shaped value on the private path: %s", (input) => {
    expect(hasPastedSensitiveSecretValue(input)).toBe(true);
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
