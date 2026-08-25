import { describe, expect, it } from "vitest";

import {
  buildSensitiveSecretFollowUpContext,
  buildSensitiveSecretGuidance,
  classifySensitiveSecretFollowUp,
  detectTelegramSensitiveSecret,
  hasPastedSensitiveSecretValue,
  resolveSensitiveSecretFollowUpLanguage,
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
    ["API_KEY=sk-proj-TestOnly1234567890abcdef", "access_token"],
    ["access token abcdefgh1234567890abcd", "access_token"],
    [
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.TESTONLY1234567890.signatureABC123",
      "access_token",
    ],
    ["123456789:AAExampleTokenValue1234567890abcdefghi", "access_token"],
    ["ghp_TestOnlyToken1234567890ABCDEFGHIJ12345", "access_token"],
    [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TestOnlySignature1234567890abcdef",
      "access_token",
    ],
    ["AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890", "access_token"],
    ["AKIATESTONLY12345678", "access_token"],
    ["ASIATESTONLY87654321", "access_token"],
    [
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "recovery_phrase",
    ],
    [
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      "recovery_phrase",
    ],
    ["0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "private_key"],
    ["0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "private_key"],
    ["731", "code"],
    ["123?", "code"],
    ["Bearer CompletelyOpaqueCredentialMaterial", "access_token"],
    ["token=CompletelyOpaqueCredentialMaterial", "access_token"],
    ["API_KEY=CompletelyAlphabeticCredential", "access_token"],
    ["password=CompletelyAlphabeticPassword", "password"],
    ["parolim: UzunMaxfiyParol", "password"],
    ["паролим: UzunMaxfiyParol", "password"],
    ["kodim: 4821", "code"],
    ["кодим: 4821", "code"],
    ["Bearer abcdefghijklmnop", "access_token"],
    ["Пароль🟠UzunMaxfiyParol", "password"],
    ["SMS kodi 👉 592814", "code"],
    ["OTP → 482901", "code"],
    ["Bearer: abcdefghijklmnop", "access_token"],
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
    "The API key field is required, but no value was provided.",
    "Authorization: Bearer token",
    "Use https://docs.example.test/api-key to rotate credentials.",
    "Call +998 90 123 45 67 for support.",
    "Bearer eyJ.not-a-complete-token",
    "AIza-short is a documentation placeholder.",
    "AKIA is the documented AWS prefix.",
    "AKIATESTONLY1234567",
    "eyJhbGciOiJIUzI1NiJ9.payload-without-signature",
    "Please remember to buy fresh apples oranges bananas milk bread cheese tomorrow",
    "unknown people offer cheap tickets asking money quickly today sounds very risky",
    "happy people enjoy sunny weather every morning birds sing near green trees",
    "Room 731 is ready.",
    "token=placeholder",
    "API_KEY=placeholder",
    "Пароль🟠должен быть длинным.",
    "SMS kodi 👉 yuborilmagan.",
    "OTP → field is empty.",
    "Bearer: token",
    "Bearer: documentationplaceholder",
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
    "API_KEY=sk-proj-TestOnly1234567890abcdef",
    "access token abcdefgh1234567890abcd",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.TESTONLY1234567890.signatureABC123",
    "123456789:AAExampleTokenValue1234567890abcdefghi",
    "ghp_TestOnlyToken1234567890ABCDEFGHIJ12345",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TestOnlySignature1234567890abcdef",
    "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.TestOnlySignature9876543210abcdef",
    "AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890",
    "AKIATESTONLY12345678",
    "ASIATESTONLY87654321",
    "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "731",
    "Bearer CompletelyOpaqueCredentialMaterial",
    "token=CompletelyOpaqueCredentialMaterial",
    "API_KEY=CompletelyAlphabeticCredential",
    "password=CompletelyAlphabeticPassword",
    "Пароль🟠UzunMaxfiyParol",
    "SMS kodi 👉 592814",
    "OTP → 482901",
    "Bearer: abcdefghijklmnop",
  ])("keeps an actual secret-shaped value on the private path: %s", (input) => {
    expect(hasPastedSensitiveSecretValue(input)).toBe(true);
  });
});

describe("buildSensitiveSecretGuidance", () => {
  it.each([
    ["ru", "password", /парол/iu],
    ["uz", "code", /kod/iu],
    ["en", "recovery_phrase", /recovery/iu],
    ["ru", "access_token", /токен/iu],
    ["uz", "access_token", /token/iu],
    ["en", "access_token", /access token/iu],
  ] as const)("returns %s guidance for %s", (lang, secretClass, expected) => {
    const guidance = buildSensitiveSecretGuidance([secretClass], lang);

    expect(`${guidance.title}\n${guidance.description}`).toMatch(expected);
  });
});

describe("classifySensitiveSecretFollowUp", () => {
  const now = new Date("2026-08-23T10:00:00.000Z");
  const context = buildSensitiveSecretFollowUpContext(["code"], "ru", now);

  it.each([
    ["почему?", "why"],
    ["пачему?", "why"],
    ["nega?", "why"],
    ["nima uchun?", "why"],
    ["why?", "why"],
    ["что дальше?", "next_steps"],
    ["а что дальше?", "next_steps"],
    ["дальше что?", "next_steps"],
    ["what next?", "next_steps"],
    ["now what?", "next_steps"],
    ["keyin nima?", "next_steps"],
    ["endi nima?", "next_steps"],
  ] as const)("accepts a bounded human follow-up: %s", (text, action) => {
    expect(classifySensitiveSecretFollowUp(text, context, now)).toMatchObject({
      action,
      context: { classes: ["code"], lang: "ru" },
    });
  });

  it.each([
    "why 481927?",
    "почему https://example.test?",
    "nega ularga 592814 kodni beray?",
    "what next, send it to support@example.test?",
  ])("does not hide a new artifact as a saved-context follow-up: %s", (text) => {
    expect(classifySensitiveSecretFollowUp(text, context, now)).toBeNull();
  });

  it.each([
    ["Пачему?", "en", "ru"],
    ["Nima uchun?", "ru", "uz"],
    ["What next?", "uz", "en"],
  ] as const)("resolves the current follow-up language for %s", (text, fallback, expected) => {
    expect(resolveSensitiveSecretFollowUpLanguage(text, fallback)).toBe(expected);
  });
});
