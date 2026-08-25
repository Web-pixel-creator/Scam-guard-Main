import { describe, expect, it } from "vitest";
import { redactText } from "./detect";
import { evaluateText } from "./rules";
import { sanitizeSensitiveTextForSink } from "./sensitive-text";

describe("sanitizeSensitiveTextForSink", () => {
  it.each([
    ["password", "password = Correct-Horse-Battery-Staple", "Correct-Horse-Battery-Staple"],
    ["password", "pаsswоrd: AlphaSecret42", "AlphaSecret42"],
    ["password", "passphrase = correct horse battery staple", "correct horse battery staple"],
    ["password", "пароль = Секрет-42", "Секрет-42"],
    ["password", "pasword: AlphaSecret42", "AlphaSecret42"],
    ["password", "parol = Maxfiy-42", "Maxfiy-42"],
    ["password", "password, huntertwo", "huntertwo"],
    ["password", "password; huntertwo", "huntertwo"],
    ["password", "password — huntertwo", "huntertwo"],
    ["password", "пароль, huntertwo", "huntertwo"],
    ["password", "parol; huntertwo", "huntertwo"],
    ["password", "password, Qwerty!2026", "Qwerty"],
    ["password", "Parol!2026 parolini yuboring", "Parol!"],
    ["password", "Soxta yordam xizmati Parol!2026 parolini yuborishni so'radi.", "Parol!"],
    ["code", "OTP: 9 1 4 2 8 7", "9 1 4 2 8 7"],
    ["code", "код подтверждения: 1 2 3 4 5 6", "1 2 3 4 5 6"],
    ["code", "tasdiqlash kodi: 1-2-3-4-5-6", "1-2-3-4-5-6"],
    ["code", "CVV: 1 2 3", "1 2 3"],
    ["code", "the caller asks for 614 CVV", "614"],
    ["code", "the caller asks for 614, CVV", "614"],
    ["code", "the caller asks for 614 — CVV", "614"],
    ["code", "the caller asks for 825/CVV", "825"],
    ["code", "звонивший говорит: 917 это CVV", "917"],
    ["code", "неизвестный просит 4821 PIN", "4821"],
    ["code", "support asked for 638205 OTP", "638205"],
    ["code", "CVV #825", "825"],
    ["code", "CVV №825", "825"],
    ["code", "CVV (825)", "825"],
    ["code", "CVV — 825", "825"],
    ["code", "CVV, 825", "825"],
    ["code", "CVV; 825", "825"],
    ["code", "CVV: #825", "825"],
    ["code", "CVV = #825", "825"],
    ["code", "CVV [825]", "825"],
    ["code", "Salom, bu kodni kiriting please: 1234", "1234"],
    ["code", "verification code: AB12CD", "AB12CD"],
    ["code", "verificaton code: ZX90QW", "ZX90QW"],
    ["code", "verification code AB12CD", "AB12CD"],
    ["code", "SMS code: AB-12-CD", "AB-12-CD"],
    ["code", "SMS code: AB 12 CD", "AB 12 CD"],
    ["code", "SMS code: AB_12_CD", "AB_12_CD"],
    ["code", "AB12CD — verification code", "AB12CD"],
    ["code", "AB12CD verification code", "AB12CD"],
    ["code", "AB12CD is the SMS code", "AB12CD"],
    ["code", "SMS code = ZX90QW", "ZX90QW"],
    ["code", "CVC/917", "917"],
    ["code", "the caller asks for 614 (CVV)", "614"],
    ["code", "the caller asks for 614 [CVV]", "614"],
    ["password", "huntertwo password", "huntertwo"],
    ["password", "huntertwo (password)", "huntertwo"],
    ["password", "huntertwo [password]", "huntertwo"],
    ["password", "Qwerty!2026 password", "Qwerty!2026"],
    ["password", '"correct horse battery staple" password', "correct horse battery staple"],
    ["password", "correct horse battery staple — password", "correct horse battery staple"],
    ["password", "correct horse battery staple — passphrase", "correct horse battery staple"],
    [
      "recovery_phrase",
      "seed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "recovery_phrase",
      "seed phase apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "recovery_phrase",
      "seed phrse apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "recovery_phrase",
      "тиклаш ибораси: olma velosiped sham ajdar burgut o'rmon bog' port orol o'rmoncha mushuk limon",
      "olma velosiped sham ajdar burgut o'rmon bog' port orol o'rmoncha mushuk limon",
    ],
    [
      "recovery_phrase",
      "s e e d p h r a s e: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    ["password", "p a s s w o r d: Correct-Horse-42", "Correct-Horse-42"],
    [
      "private_key",
      "private key = ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    ],
    [
      "private_key",
      "махфий калит: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    ],
    [
      "private_key",
      "p r i v a t e k e y: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    ],
    [
      "private_key",
      "private key = -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----",
      "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC",
    ],
    [
      "access_token",
      "API_KEY=sk-proj-TestOnly1234567890abcdef",
      "sk-proj-TestOnly1234567890abcdef",
    ],
    ["access_token", "access token abcdefgh1234567890abcd", "abcdefgh1234567890abcd"],
    [
      "access_token",
      "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.TESTONLY1234567890.signatureABC123",
      "eyJhbGciOiJIUzI1NiJ9.TESTONLY1234567890.signatureABC123",
    ],
    [
      "access_token",
      "Telegram bot token 123456789:AAExampleTokenValue1234567890abcdefghi",
      "123456789:AAExampleTokenValue1234567890abcdefghi",
    ],
    [
      "access_token",
      "GitHub token ghp_TestOnlyToken1234567890ABCDEFGHIJ12345",
      "ghp_TestOnlyToken1234567890ABCDEFGHIJ12345",
    ],
    [
      "access_token",
      "github_pat_TestOnlyToken_1234567890_ABCDEFGHIJ",
      "github_pat_TestOnlyToken_1234567890_ABCDEFGHIJ",
    ],
    [
      "access_token",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgT25seSJ9.TestOnlySignature1234567890abcdef",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgT25seSJ9.TestOnlySignature1234567890abcdef",
    ],
    [
      "access_token",
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgT25seSJ9.TestOnlySignature9876543210abcdef",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgT25seSJ9.TestOnlySignature9876543210abcdef",
    ],
    [
      "access_token",
      "AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890",
      "AIzaABCDEFGHIJKLMNOPQRSTUVWXY1234567890",
    ],
    ["access_token", "AKIATESTONLY12345678", "AKIATESTONLY12345678"],
    ["access_token", "ASIATESTONLY87654321", "ASIATESTONLY87654321"],
    [
      "recovery_phrase",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "recovery_phrase",
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    ],
    [
      "private_key",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ],
    [
      "private_key",
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ],
    ["code", "731", "731"],
    ["code", "123?", "123"],
    [
      "access_token",
      "Bearer CompletelyOpaqueCredentialMaterial",
      "CompletelyOpaqueCredentialMaterial",
    ],
    [
      "access_token",
      "token=CompletelyOpaqueCredentialMaterial",
      "CompletelyOpaqueCredentialMaterial",
    ],
    ["access_token", "API_KEY=CompletelyAlphabeticCredential", "CompletelyAlphabeticCredential"],
    ["password", "password=CompletelyAlphabeticPassword", "CompletelyAlphabeticPassword"],
    ["password", "parolim: UzunMaxfiyParol", "UzunMaxfiyParol"],
    ["password", "паролим: UzunMaxfiyParol", "UzunMaxfiyParol"],
    ["code", "kodim: 4821", "4821"],
    ["code", "кодим: 4821", "4821"],
    ["access_token", "Bearer abcdefghijklmnop", "abcdefghijklmnop"],
    ["password", "Пароль🟠UzunMaxfiyParol", "UzunMaxfiyParol"],
    ["code", "SMS kodi 👉 592814", "592814"],
    ["code", "OTP → 482901", "482901"],
    ["access_token", "Bearer: abcdefghijklmnop", "abcdefghijklmnop"],
  ])("redacts a %s value from %s", (expectedClass, input, marker) => {
    const result = sanitizeSensitiveTextForSink(input);
    expect(result.redacted).toBe(true);
    expect(result.classes).toContain(expectedClass);
    expect(result.value).not.toContain(marker);
  });

  it("redacts a seed phrase written one word per line without changing surrounding text", () => {
    const input =
      "Evidence\nseed phrase:\napple\nbicycle\ncandle\ndragon\neagle\nforest\ngarden\nharbor\nisland\njungle\nkitten\nlemon\nPlease help.";

    const result = sanitizeSensitiveTextForSink(input);

    expect(result.classes).toContain("recovery_phrase");
    expect(result.value).toBe("Evidence\nseed phrase:\n••••\nPlease help.");
  });

  it("does not greedily consume a one-word line after a canonical multiline phrase", () => {
    const input =
      "seed phrase:\napple\nbicycle\ncandle\ndragon\neagle\nforest\ngarden\nharbor\nisland\njungle\nkitten\nlemon\nhelp";

    expect(sanitizeSensitiveTextForSink(input)).toEqual({
      value: "seed phrase:\n••••\nhelp",
      redacted: true,
      classes: ["recovery_phrase"],
    });
  });

  it.each([
    [
      "numbered-dot LF",
      `seed phrase:\n${[
        "apple",
        "bicycle",
        "candle",
        "dragon",
        "eagle",
        "forest",
        "garden",
        "harbor",
        "island",
        "jungle",
        "kitten",
        "lemon",
      ]
        .map((word, index) => `${index + 1}. ${word}`)
        .join("\n")}\nKeep this prose.`,
      "\nKeep this prose.",
    ],
    [
      "numbered-paren CRLF",
      `тиклаш сузлари:\r\n${[
        "apple",
        "bicycle",
        "candle",
        "dragon",
        "eagle",
        "forest",
        "garden",
        "harbor",
        "island",
        "jungle",
        "kitten",
        "lemon",
      ]
        .map((word, index) => `${index + 1}) ${word}`)
        .join("\r\n")}\r\nKeyingi matn.`,
      "\r\nKeyingi matn.",
    ],
    [
      "dash bullets",
      `тиклаш сўзлари:\n${[
        "apple",
        "bicycle",
        "candle",
        "dragon",
        "eagle",
        "forest",
        "garden",
        "harbor",
        "island",
        "jungle",
        "kitten",
        "lemon",
      ]
        .map((word) => `- ${word}`)
        .join("\n")}\nYordam kerak.`,
      "\nYordam kerak.",
    ],
    [
      "bullet glyphs",
      `seed phrase:\n${[
        "apple",
        "bicycle",
        "candle",
        "dragon",
        "eagle",
        "forest",
        "garden",
        "harbor",
        "island",
        "jungle",
        "kitten",
        "lemon",
      ]
        .map((word) => `• ${word}`)
        .join("\n")}`,
      "",
    ],
  ])("redacts a consistently prefixed multiline recovery phrase: %s", (_name, input, tail) => {
    const result = sanitizeSensitiveTextForSink(input);

    expect(result.classes).toContain("recovery_phrase");
    expect(result.value).toContain("••••");
    expect(result.value.endsWith(tail)).toBe(true);
    expect(result.value).not.toContain("apple");
    expect(result.value).not.toContain("lemon");
  });

  it.each([
    [
      "11 numbered words",
      `seed phrase:\n${Array.from({ length: 11 }, (_, index) => `${index + 1}. word`).join("\n")}`,
    ],
    [
      "mixed narrative line",
      `seed phrase:\n${Array.from({ length: 6 }, (_, index) => `${index + 1}. word`).join("\n")}\n7. two words\n${Array.from({ length: 5 }, (_, index) => `${index + 8}. word`).join("\n")}`,
    ],
    [
      "mixed prefix styles",
      `seed phrase:\n${Array.from({ length: 6 }, () => `- word`).join("\n")}\n${Array.from({ length: 6 }, () => `• word`).join("\n")}`,
    ],
    [
      "25-item numbered narrative list",
      `seed phrase:\n${Array.from({ length: 25 }, (_, index) => `${index + 1}. topic`).join("\n")}`,
    ],
  ])("preserves non-canonical multiline recovery-shaped prose: %s", (_name, input) => {
    expect(sanitizeSensitiveTextForSink(input)).toEqual({
      value: input,
      redacted: false,
      classes: [],
    });
  });

  it.each(["тиклаш сўзлари", "тиклаш сузлари"])(
    "redacts a same-line UZ Cyrillic recovery label: %s",
    (label) => {
      const secret =
        "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon";
      const result = sanitizeSensitiveTextForSink(`${label}: ${secret}`);

      expect(result.classes).toContain("recovery_phrase");
      expect(result.value).toBe(`${label}: ••••`);
    },
  );

  it.each([
    ["p a s s w o r d: Correct-Horse-42", "p a s s w o r d: ••••"],
    [
      "s e e d p h r a s e: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "s e e d p h r a s e: ••••",
    ],
    ["махфий калит: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", "махфий калит: ••••"],
    ["verification code AB12CD", "verification code ••••"],
  ])(
    "preserves the original label and separator while masking only its value: %s",
    (input, expected) => {
      expect(sanitizeSensitiveTextForSink(input).value).toBe(expected);
    },
  );

  it.each([
    "verification code: ABCDEF",
    "verification code: 123456789",
    "the reference is AB12CD",
    "p a s s w o r d should remain private",
    "seed phrase:\none\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven",
  ])("preserves non-secret alphanumeric text without a bounded labeled code: %s", (input) => {
    expect(sanitizeSensitiveTextForSink(input)).toEqual({
      value: input,
      redacted: false,
      classes: [],
    });
  });

  it.each([
    "Never share your password or seed phrase with support.",
    "Use a password manager and change passwords from a clean device.",
    "password authentication failed",
    "\u041f\u0430\u0440\u043e\u043b\u044c \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u043e\u0441\u043b\u0435 \u0432\u0445\u043e\u0434\u0430.",
    "Seed phrase means a wallet recovery secret; do not send it.",
    "The verification code field is required, but no code is included.",
    "The verificaton code field is required, but no code is included.",
    "The pasword typo is in the documentation.",
    "The pаsswоrd field is required.",
    "Seed phrse means a wallet recovery secret; do not send it.",
    "temporary password",
    "incorrect password",
    "надежный пароль",
    "vaqtinchalik parol",
    "never ever share your password",
    "do not reuse your password",
    "Do not share your bank password with a stranger.",
    "ПРОГНОЗ НА 100.000₽",
    "The API key field is required, but no value was provided.",
    "Authorization: Bearer token",
    "Use https://docs.example.test/api-key to rotate credentials.",
    "The ghp_documentation prefix is mentioned in this article.",
    "sk-short is a documentation placeholder.",
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
  ])("preserves legitimate text without an actual secret value", (input) => {
    expect(sanitizeSensitiveTextForSink(input)).toEqual({
      value: input,
      redacted: false,
      classes: [],
    });
  });

  it("redacts an unlabelled 64-hex value even when it is embedded in prose", () => {
    const raw = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const result = sanitizeSensitiveTextForSink(`received ${raw}.`);

    expect(result.classes).toContain("private_key");
    expect(result.value).not.toContain(raw);
  });

  it("is idempotent", () => {
    const once = sanitizeSensitiveTextForSink("password = hunter2; OTP: 1 2 3 4").value;
    expect(sanitizeSensitiveTextForSink(once).value).toBe(once);
  });

  it("defers phone-shaped values to the existing phone masker", () => {
    expect(sanitizeSensitiveTextForSink("password: +998901234567")).toEqual({
      value: "password: +998901234567",
      redacted: false,
      classes: [],
    });
  });

  it("masks the nearest reverse-order CVV without swallowing an earlier order number", () => {
    const result = sanitizeSensitiveTextForSink("order 1234 614 CVV");
    expect(result.value).toContain("order 1234");
    expect(result.value).not.toContain("614");
    expect(result.classes).toContain("code");
  });

  it.each([
    "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "731",
    "Bearer CompletelyOpaqueCredentialMaterial",
    "token=CompletelyOpaqueCredentialMaterial",
    "API_KEY=CompletelyAlphabeticCredential",
    "password=CompletelyAlphabeticPassword",
  ])("does not leave a newly supported raw secret in the persistence redactor: %s", (input) => {
    const redacted = redactText(input);
    expect(redacted).toContain("••••");
    expect(redacted).not.toContain(input.replace(/^(?:Bearer\s+|token=|API_KEY=|password=)/u, ""));
  });

  it.each([
    "please send me your password",
    "send me your bank password",
    "they ask me to share my bank password",
    "parolini yuboring",
    "parolni kiriting",
    "parolni ko'rsating",
  ])("does not erase password-request risk context before scoring: %s", (input) => {
    expect(evaluateText(input)).toContain("asks_for_pin");
    expect(evaluateText(redactText(input))).toContain("asks_for_pin");
  });

  it("removes a multiline PEM block through the shared persistence redactor", () => {
    const input =
      "Evidence:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAsecretmaterial\n-----END RSA PRIVATE KEY-----";

    const redacted = redactText(input);
    expect(redacted).not.toContain("MIIEowIBAAKCAQEAsecretmaterial");
    expect(redacted).not.toContain("BEGIN RSA PRIVATE KEY");
  });
});
