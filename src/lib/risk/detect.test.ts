import { describe, expect, it } from "vitest";
import {
  detectInputType,
  looksLikePaymentInput,
  luhnCheck,
  normalizeTelegram,
  redactText,
  shouldRedactAsCard,
} from "./detect";

describe("looksLikePaymentInput", () => {
  it.each([
    "Pay the delivery fee 12000 UZS by Click before the parcel is returned",
    "Oldindan to'lov qiling: 50000 so'm, Humo karta orqali",
    "Scan this QR and pay 25000 UZS to receive the order",
    "Prepay 40 USD deposit by Payme invoice",
  ])("detects payment-flow text: %s", (text) => {
    expect(looksLikePaymentInput(text)).toBe(true);
    expect(detectInputType(text)).toBe("payment");
  });

  it.each([
    "https://payme.uz/invoice/abc",
    "https://example.com/file.apk",
    "https://t.me/official_channel",
    "+998 90 123 45 67",
    "My order number is 123456 and it arrived today",
  ])("does not steal non-payment primary inputs: %s", (text) => {
    expect(looksLikePaymentInput(text)).toBe(false);
  });
});

describe("detectInputType payment priority", () => {
  it("keeps pure payment URLs as url for entity reputation lookup", () => {
    expect(detectInputType("https://payme.uz/invoice/abc")).toBe("url");
  });

  it("keeps APK URLs as apk", () => {
    expect(detectInputType("https://example.com/app.apk")).toBe("apk");
  });

  it("keeps Telegram links as telegram", () => {
    expect(detectInputType("https://t.me/scam_support")).toBe("telegram");
  });

  it("keeps pure phones as phone", () => {
    expect(detectInputType("+998 90 123 45 67")).toBe("phone");
  });
});

describe("normalizeTelegram", () => {
  it("extracts private invite codes from t.me/+ links", () => {
    expect(normalizeTelegram("https://t.me/+fdOETKx56pozNTBi")).toBe("+fdOETKx56pozNTBi");
  });

  it("extracts a private invite code from a longer caption", () => {
    const caption = "СЕГОДНЯ СТАВЛЮ НА МАТЧ. Прогноз бесплатно: https://t.me/+fdOETKx56pozNTBi";

    expect(normalizeTelegram(caption)).toBe("+fdOETKx56pozNTBi");
  });
});

describe("luhnCheck", () => {
  it("returns true for valid card numbers", () => {
    // Known valid test card numbers (Luhn-valid)
    expect(luhnCheck("4539148803436467")).toBe(true); // Visa test
    expect(luhnCheck("4111111111111111")).toBe(true); // Visa test
    expect(luhnCheck("5500000000000004")).toBe(true); // Mastercard test
    expect(luhnCheck("79927398713")).toBe(true); // Wikipedia example
  });

  it("returns false for invalid card numbers", () => {
    expect(luhnCheck("4539148803436468")).toBe(false); // last digit wrong
    expect(luhnCheck("1234567890123456")).toBe(false);
    expect(luhnCheck("0000000000000001")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(luhnCheck("")).toBe(false);
  });

  it("returns false for non-digit characters", () => {
    expect(luhnCheck("4539-1488-0343-6467")).toBe(false);
    expect(luhnCheck("abcdefghijklmnop")).toBe(false);
  });

  it("returns true for single digit 0", () => {
    // 0 mod 10 === 0, so "0" passes Luhn
    expect(luhnCheck("0")).toBe(true);
  });
});

describe("redactText — context-aware card detection", () => {
  it("redacts card-like digits when context word is present", () => {
    const text = "Переведите на карту 8600123456789012 до завтра";
    const result = redactText(text);
    expect(result).toContain("•••• •••• •••• ••••");
    expect(result).not.toContain("8600123456789012");
  });

  it("does NOT redact digit sequences without context words (barcode/EAN)", () => {
    const text = "Штрих-код на бутылке: 4607027764235 проверено";
    const result = redactText(text);
    expect(result).toContain("4607027764235");
    expect(result).not.toContain("•••• •••• •••• ••••");
  });

  it("does NOT redact tracking numbers without payment context", () => {
    const text = "Your tracking number is 1234567890123456789";
    const result = redactText(text);
    // No context word → no redaction (unless it happens to be Luhn-16-valid)
    expect(result).not.toContain("•••• •••• •••• ••••");
  });

  it("does NOT treat card context words as substrings inside unrelated words", () => {
    const digits = "1234567890123";
    const text = `Shipping reference ${digits} is printed on the parcel label`;
    const start = text.indexOf(digits);
    const end = start + digits.length;

    expect(shouldRedactAsCard(digits, text, start, end)).toBe(false);
    expect(redactText(text)).toContain(digits);
  });

  it("accepts separated card-like digits when a real context word is nearby", () => {
    const digits = "8600 1234 5678 9012";
    const text = `Переведите на карту ${digits}`;
    const start = text.indexOf(digits);
    const end = start + digits.length;

    expect(shouldRedactAsCard(digits, text, start, end)).toBe(true);
  });

  it("unconditionally redacts 16-digit Luhn-valid sequences", () => {
    // 4111111111111111 is Luhn-valid
    const text = "Вот номер: 4111111111111111 — запомни";
    const result = redactText(text);
    expect(result).toContain("•••• •••• •••• ••••");
    expect(result).not.toContain("4111111111111111");
  });

  it("still redacts phone numbers normally", () => {
    const text = "Позвоните по +998901234567 для подтверждения";
    const result = redactText(text);
    expect(result).toContain("+998•••••67");
    expect(result).not.toContain("+998901234567");
  });

  it("still redacts OTP patterns", () => {
    const text = "Ваш код подтверждения: 4829";
    const result = redactText(text);
    expect(result).toContain("••••");
  });

  it("redacts email, URL and Telegram identifiers in narrative text", () => {
    const text =
      "Contact victim@example.com, @FakeSupportBot or t.me/+SecretInvite and open https://evil.example/reset?token=secret.";
    const result = redactText(text);

    expect(result).not.toContain("victim@example.com");
    expect(result).not.toContain("@FakeSupportBot");
    expect(result).not.toContain("t.me/+SecretInvite");
    expect(result).not.toContain("https://evil.example/reset?token=secret");
    expect(result).toContain("v*****@example.com");
    expect(result).toContain("[telegram]");
    expect(result).toContain("[link]");
  });

  it("beverage ad with EAN barcode does NOT trigger card redaction", () => {
    const text = "Акция! Купи Coca-Cola 1.5л. Штрих-код: 5449000000996. Скидка 20%!";
    const result = redactText(text);
    expect(result).toContain("5449000000996");
    expect(result).not.toContain("•••• •••• •••• ••••");
  });

  it("phone numbers are not double-matched as cards", () => {
    const text = "Bank: call +998712000044 for support about your карту";
    const result = redactText(text);
    // Phone should be redacted as phone, not as card
    expect(result).toContain("+998•••••44");
    expect(result).not.toContain("•••• •••• •••• ••••");
  });
});
