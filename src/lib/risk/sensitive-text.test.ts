import { describe, expect, it } from "vitest";
import { redactText } from "./detect";
import { sanitizeSensitiveTextForSink } from "./sensitive-text";

describe("sanitizeSensitiveTextForSink", () => {
  it.each([
    ["password", "password = Correct-Horse-Battery-Staple", "Correct-Horse-Battery-Staple"],
    ["password", "passphrase = correct horse battery staple", "correct horse battery staple"],
    ["password", "пароль = Секрет-42", "Секрет-42"],
    ["password", "parol = Maxfiy-42", "Maxfiy-42"],
    ["code", "OTP: 9 1 4 2 8 7", "9 1 4 2 8 7"],
    ["code", "код подтверждения: 1 2 3 4 5 6", "1 2 3 4 5 6"],
    ["code", "tasdiqlash kodi: 1-2-3-4-5-6", "1-2-3-4-5-6"],
    ["code", "CVV: 1 2 3", "1 2 3"],
    [
      "recovery_phrase",
      "seed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    [
      "private_key",
      "private key = ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    ],
    [
      "private_key",
      "private key = -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----",
      "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC",
    ],
  ])("redacts a %s value", (expectedClass, input, marker) => {
    const result = sanitizeSensitiveTextForSink(input);
    expect(result.redacted).toBe(true);
    expect(result.classes).toContain(expectedClass);
    expect(result.value).not.toContain(marker);
  });

  it.each([
    "Never share your password or seed phrase with support.",
    "Use a password manager and change passwords from a clean device.",
    "password authentication failed",
    "\u041f\u0430\u0440\u043e\u043b\u044c \u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u043e\u0441\u043b\u0435 \u0432\u0445\u043e\u0434\u0430.",
    "Seed phrase means a wallet recovery secret; do not send it.",
    "The verification code field is required, but no code is included.",
    "ПРОГНОЗ НА 100.000₽",
  ])("preserves legitimate text without an actual secret value", (input) => {
    expect(sanitizeSensitiveTextForSink(input)).toEqual({
      value: input,
      redacted: false,
      classes: [],
    });
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

  it("removes a multiline PEM block through the shared persistence redactor", () => {
    const input =
      "Evidence:\n-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAsecretmaterial\n-----END RSA PRIVATE KEY-----";

    const redacted = redactText(input);
    expect(redacted).not.toContain("MIIEowIBAAKCAQEAsecretmaterial");
    expect(redacted).not.toContain("BEGIN RSA PRIVATE KEY");
  });
});
