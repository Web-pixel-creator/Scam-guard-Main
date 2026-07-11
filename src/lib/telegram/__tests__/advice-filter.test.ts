import { describe, it, expect } from "vitest";
import { filterAdvice, REASON_PROTECTIVE_ACTION } from "@/lib/telegram/advice-filter";
import { REASON_LABELS, scoreFromCodes, type ReasonCode } from "@/lib/risk/rules";

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

  describe("exhaustive high-risk protective actions", () => {
    const reasonCodes = Object.keys(REASON_LABELS) as ReasonCode[];

    it("binds every current ReasonCode to an explicit action or intentional null", () => {
      expect(Object.keys(REASON_PROTECTIVE_ACTION).sort()).toEqual([...reasonCodes].sort());
      for (const reason of reasonCodes) {
        if (REASON_PROTECTIVE_ACTION[reason] === null) continue;
        expect(filterAdvice("suspicious", [reason], "en"), reason).toHaveLength(1);
      }
    });

    it.each(["known_reported", "external_phishing_url", "external_malware_url"] as const)(
      "returns an immediate action for %s in every language",
      (reason) => {
        for (const lang of ["ru", "uz", "en"] as const) {
          const advice = filterAdvice("high_risk", [reason], lang);
          expect(advice.length).toBeGreaterThan(0);
          expect(advice.join(" ").toLowerCase()).not.toMatch(
            /more context|больше контекст|ko'proq/iu,
          );
        }
      },
    );

    it("never produces a high-risk single/pair verdict without a protective action", () => {
      for (let left = 0; left < reasonCodes.length; left += 1) {
        for (let right = left; right < reasonCodes.length; right += 1) {
          const reasons = [...new Set([reasonCodes[left], reasonCodes[right]])];
          if (scoreFromCodes(reasons).level !== "high_risk") continue;
          expect(filterAdvice("high_risk", reasons, "en"), reasons.join("+")).not.toEqual([]);
        }
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

    it("uses betting-channel advice for closed prediction promos", () => {
      const result = filterAdvice("high_risk", ["gambling_prediction_promo"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("прогноз");
      expect(result[0]).toContain("закрытый канал");
      expect(result[0]).not.toContain("SMS");
    });

    it("uses delivery-specific advice without betting or safe-account wording", () => {
      const result = filterAdvice("suspicious", ["fake_delivery_payment"], "en");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("delivery");
      expect(result[0]).toContain("official");
      expect(result[0]).not.toContain("prediction");
      expect(result[0]).not.toContain("closed-channel");
      expect(result[0]).not.toContain("safe account");
    });

    it("uses giveaway advice for NFT/prize engagement bait", () => {
      const result = filterAdvice("suspicious", ["giveaway_engagement_bait"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("капчу");
      expect(result[0]).toContain("кошелёк");
      expect(result[0]).not.toContain("APK");
    });

    it("uses invite-link advice without unrelated APK wording", () => {
      const result = filterAdvice("suspicious", ["suspicious_invite_link"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("invite-ссылке");
      expect(result[0]).toContain("Telegram-код");
      expect(result[0]).not.toContain("APK");
    });
  });

  describe("research feed v2 advice", () => {
    it("maps casino bonus funnels to betting/casino advice", () => {
      const result = filterAdvice("suspicious", ["crypto_casino_bonus_funnel"], "en");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("free-spins");
      expect(result[0]).toContain("card/wallet");
      expect(result[0]).not.toContain("APK");
    });

    it("maps fake captcha, task reward and TON referral bait to contextual advice", () => {
      const result = filterAdvice(
        "high_risk",
        ["fake_captcha_or_voting", "task_reward_engagement_bait", "ton_referral_earning_scheme"],
        "en",
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toContain("captcha");
      expect(result[0]).toContain("NFT/Stars");
      expect(result[1]).toContain("task/referral");
      expect(result[1]).toContain("TON");
      expect(result[0]).not.toContain("APK");
      expect(result[1]).not.toContain("APK");
    });

    it("maps wallet urgency to wallet-specific advice", () => {
      const result = filterAdvice("suspicious", ["wallet_action_urgency"], "en");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("connect a wallet");
      expect(result[0]).toContain("seed phrase");
      expect(result[0]).not.toContain("safe account");
    });

    it("maps investment fast-profit pitches to deposit/signal-specific advice", () => {
      const result = filterAdvice("suspicious", ["investment_fast_profit_pitch"], "ru");

      expect(result).toHaveLength(1);
      expect(result[0]).toContain("депозит");
      expect(result[0]).toContain("сигналы");
      expect(result[0]).not.toContain("SMS");
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
