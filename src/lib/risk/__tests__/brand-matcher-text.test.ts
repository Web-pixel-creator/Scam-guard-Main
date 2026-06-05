// Unit tests for matchBrandInText — validates critical test cases for text-based detection
import { describe, it, expect } from "vitest";
import { matchBrandInText } from "../brand-matcher";
import type { ReasonCode } from "../rules";

describe("matchBrandInText", () => {
  describe("Generic brand false positive suppression (Req 6.5)", () => {
    it('"click here" → no Click brand match', () => {
      const result = matchBrandInText("click here to see more", [], []);
      expect(result.detected).toBe(false);
    });

    it('"click this link" → no Click brand match', () => {
      const result = matchBrandInText("Please click this link for details", [], []);
      expect(result.detected).toBe(false);
    });

    it('"pay me later" → no Payme brand match', () => {
      const result = matchBrandInText("pay me later when you can", [], []);
      expect(result.detected).toBe(false);
    });

    it('"pay me back" → no Payme brand match', () => {
      const result = matchBrandInText("Can you pay me back tomorrow?", [], []);
      expect(result.detected).toBe(false);
    });

    it('"click" alone without suspicious context → no match', () => {
      const result = matchBrandInText("I heard a click sound", [], []);
      expect(result.detected).toBe(false);
    });
  });

  describe("Non-generic brand without URL or risk signals (Req 3.2, 6.2)", () => {
    it('"Kapitalbank" without URL → no detection', () => {
      const result = matchBrandInText("Kapitalbank announced new services today", [], []);
      expect(result.detected).toBe(false);
    });

    it('"Beeline" in plain discussion → no detection', () => {
      const result = matchBrandInText("I use Beeline for my mobile plan", [], []);
      expect(result.detected).toBe(false);
    });

    it('"Uzcard" without URL → no detection', () => {
      const result = matchBrandInText("Uzcard is a popular payment system", [], []);
      expect(result.detected).toBe(false);
    });
  });

  describe("Non-generic brand + non-official URL (Req 3.1)", () => {
    it('"Kapitalbank https://evil.com/login" → detects impersonation', () => {
      const result = matchBrandInText(
        "Kapitalbank https://evil.com/login",
        ["https://evil.com/login"],
        [],
      );
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("kapitalbank");
      expect(result.evidence[0].matchedIn).toBe("text");
    });

    it("brand name + embedded URL in text → detects", () => {
      const result = matchBrandInText(
        "Уважаемый клиент Капиталбанк! Пройдите верификацию: https://kapitalbank-verify.evil.com",
        [],
        [],
      );
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("kapitalbank");
    });

    it("brand + official URL → no detection", () => {
      const result = matchBrandInText(
        "Visit Kapitalbank at https://kapitalbank.uz/services",
        ["https://kapitalbank.uz/services"],
        [],
      );
      expect(result.detected).toBe(false);
    });
  });

  describe("Non-generic brand + high-risk codes (Req 3.3)", () => {
    it("brand + asks_for_otp → detects impersonation", () => {
      const codes: ReasonCode[] = ["asks_for_otp"];
      const result = matchBrandInText("Kapitalbank: please enter your OTP code", [], codes);
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("kapitalbank");
      expect(result.evidence[0].matchedIn).toBe("text");
    });

    it("brand + asks_for_card_cvv → detects", () => {
      const codes: ReasonCode[] = ["asks_for_card_cvv"];
      const result = matchBrandInText("Humo security team: confirm your card CVV", [], codes);
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("humo");
    });

    it("brand + non-high-risk code (uses_urgency) → no detection", () => {
      const codes: ReasonCode[] = ["uses_urgency"];
      const result = matchBrandInText("Kapitalbank has a new promotion", [], codes);
      expect(result.detected).toBe(false);
    });
  });

  describe("Generic brand with suspicious keywords + URL (Req 6.6)", () => {
    it("Click + payment keywords + URL → detects", () => {
      const result = matchBrandInText(
        "Click payment verification required: https://click-verify.evil.com",
        ["https://click-verify.evil.com"],
        [],
      );
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("click");
    });

    it("Payme + card keyword + URL → detects", () => {
      const result = matchBrandInText(
        "Payme: подтвердите вашу карту https://payme-fake.com",
        ["https://payme-fake.com"],
        [],
      );
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("payme");
    });
  });

  describe("matchedIn field accuracy (Req 9.4)", () => {
    it("text detection sets matchedIn to 'text'", () => {
      const result = matchBrandInText(
        "Beeline support: https://beeline-fake.com/login",
        ["https://beeline-fake.com/login"],
        [],
      );
      expect(result.detected).toBe(true);
      expect(result.evidence[0].matchedIn).toBe("text");
    });
  });
});
