import { describe, it, expect } from "vitest";
import { filterAdvice } from "@/lib/telegram/advice-filter";

describe("filterAdvice", () => {
  describe("high_risk with multiple reasons", () => {
    it("returns ≤3 advice items relevant to the given reasons", () => {
      const reasons = [
        "asks_for_otp",
        "suspicious_short_link",
        "asks_to_transfer_to_safe_account",
        "uses_urgency",
      ];
      const result = filterAdvice("high_risk", reasons, "ru");

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result.length).toBeGreaterThan(0);
      // Each item should be a non-empty string
      for (const item of result) {
        expect(item).toBeTruthy();
        expect(typeof item).toBe("string");
      }
    });
  });

  describe("unknown with no reasons", () => {
    it("returns empty array", () => {
      const result = filterAdvice("unknown", [], "ru");
      expect(result).toEqual([]);
    });
  });

  describe("unknown with non-actionable context reasons", () => {
    it("does not invent crypto advice for unknown_sender", () => {
      const result = filterAdvice("unknown", ["unknown_sender"], "ru");

      expect(result).toEqual([]);
    });

    it("returns empty array for multiple weak context reasons", () => {
      const result = filterAdvice("unknown", ["unknown_sender", "new_telegram_account"], "ru");

      expect(result).toEqual([]);
    });
  });

  describe("suspicious with mixed reasons", () => {
    it("returns appropriate advice (not generic), limited to 3", () => {
      const reasons = [
        "impersonates_bank",
        "asks_for_sms_code",
        "uses_urgency",
        "suspicious_short_link",
      ];
      const result = filterAdvice("suspicious", reasons, "ru");

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result.length).toBeGreaterThan(0);
      // Should contain contextual advice, not generic boilerplate
      for (const item of result) {
        expect(item.length).toBeGreaterThan(5);
      }
    });
  });

  describe("safe with no reasons", () => {
    it("returns empty array", () => {
      const result = filterAdvice("safe", [], "ru");
      expect(result).toEqual([]);
    });
  });

  describe("deduplication", () => {
    it("does not return same advice category twice for multiple reasons mapping to it", () => {
      // asks_for_otp, asks_for_sms_code, asks_for_pin all map to OTP category
      const reasons = ["asks_for_otp", "asks_for_sms_code", "asks_for_pin"];
      const result = filterAdvice("high_risk", reasons, "ru");

      // Should only appear once since they all map to the same category
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });
  });

  describe("max 3 limit", () => {
    it("returns at most 3 items even with many different reason categories", () => {
      // Pick reasons from all 5 different categories
      const reasons = [
        "asks_for_otp", // OTP category
        "suspicious_short_link", // Link/APK category
        "asks_to_transfer_to_safe_account", // Money transfer category
        "uses_urgency", // Pressure category
        "impersonates_bank", // Impersonation category
      ];
      const result = filterAdvice("high_risk", reasons, "ru");

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result.length).toBe(3);
    });
  });

  describe("research feed v1 advice", () => {
    it("uses account takeover advice for Telegram deletion phishing", () => {
      const result = filterAdvice("high_risk", ["telegram_account_takeover_phishing"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("Telegram");
      expect(result[0]).toContain("Устройства");
      expect(result[0]).not.toContain("безопасный счёт");
    });

    it("uses card/SIM/account transfer advice for dropper recruitment", () => {
      const result = filterAdvice("suspicious", ["dropper_recruitment"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("карту");
      expect(result[0]).toContain("SIM");
      expect(result[0]).not.toContain("APK");
    });
  });

  describe("trilingual consistency", () => {
    it("returns same number of items for ru, uz, and en", () => {
      const reasons = [
        "asks_for_otp",
        "suspicious_short_link",
        "uses_urgency",
        "impersonates_bank",
      ];

      const ruResult = filterAdvice("high_risk", reasons, "ru");
      const uzResult = filterAdvice("high_risk", reasons, "uz");
      const enResult = filterAdvice("high_risk", reasons, "en");

      expect(ruResult.length).toBe(uzResult.length);
      expect(ruResult.length).toBe(enResult.length);
      expect(ruResult.length).toBeGreaterThan(0);
    });
  });
});
