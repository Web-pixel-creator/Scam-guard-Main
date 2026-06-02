import { describe, expect, it } from "vitest";
import { detectInputType, looksLikePaymentInput } from "./detect";

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
