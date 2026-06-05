// Integration tests for brand_impersonation scoring — validates risk score and level
// when brand_impersonation coexists with other reason codes.
import { describe, it, expect } from "vitest";
import { scoreFromCodes } from "../rules";
import type { ReasonCode } from "../rules";

describe("brand_impersonation scoring integration", () => {
  /**
   * Validates: Requirements 4.1, 4.4
   * brand_impersonation alone (weight 40) → score 40, level "suspicious"
   * Score is >= 20 but < 50, so it should NOT be high_risk.
   */
  it("brand_impersonation alone → score 40, level suspicious", () => {
    const codes: ReasonCode[] = ["brand_impersonation"];
    const result = scoreFromCodes(codes);

    expect(result.score).toBe(40);
    expect(result.level).toBe("suspicious");
  });

  /**
   * Validates: Requirements 4.2, 4.6
   * brand_impersonation (40) + hosted_app_platform (0) → minimum score 50
   * hosted_app_platform remains informational alone, but a brand on public hosting
   * is a strong phishing combination and escalates to high_risk.
   */
  it("brand_impersonation + hosted_app_platform → score 50, level high_risk", () => {
    const codes: ReasonCode[] = ["brand_impersonation", "hosted_app_platform"];
    const result = scoreFromCodes(codes);

    expect(result.score).toBe(50);
    expect(result.level).toBe("high_risk");
  });

  /**
   * Validates: Requirements 4.5, 4.8
   * brand_impersonation (40) + suspicious_short_link (30) → score 70, level "high_risk"
   * Combined score exceeds the 50 threshold.
   */
  it("brand_impersonation + suspicious_short_link → score 70, level high_risk", () => {
    const codes: ReasonCode[] = ["brand_impersonation", "suspicious_short_link"];
    const result = scoreFromCodes(codes);

    expect(result.score).toBe(70);
    expect(result.level).toBe("high_risk");
  });

  /**
   * Validates: Requirements 4.6, 4.7
   * brand_impersonation (40) + asks_for_otp (45) → score 85, level "high_risk"
   * OTP request alongside brand impersonation is a strong scam indicator.
   */
  it("brand_impersonation + asks_for_otp → score 85, level high_risk", () => {
    const codes: ReasonCode[] = ["brand_impersonation", "asks_for_otp"];
    const result = scoreFromCodes(codes);

    expect(result.score).toBe(85);
    expect(result.level).toBe("high_risk");
  });

  /**
   * Validates: Requirements 4.1, 4.2, 4.5, 4.6, 4.7, 4.8
   * brand_impersonation coexists with other reason codes without interference.
   * Each code's weight contributes independently to the total score.
   */
  describe("coexistence with other reason codes", () => {
    it("brand_impersonation + uses_urgency → score 55, level high_risk", () => {
      const codes: ReasonCode[] = ["brand_impersonation", "uses_urgency"];
      const result = scoreFromCodes(codes);

      expect(result.score).toBe(55); // 40 + 15
      expect(result.level).toBe("high_risk");
    });

    it("brand_impersonation + unknown_sender → score 45, level suspicious", () => {
      const codes: ReasonCode[] = ["brand_impersonation", "unknown_sender"];
      const result = scoreFromCodes(codes);

      expect(result.score).toBe(45); // 40 + 5
      expect(result.level).toBe("suspicious");
    });

    it("brand_impersonation + weird_domain + hosted_app_platform → score 65, level high_risk", () => {
      const codes: ReasonCode[] = ["brand_impersonation", "weird_domain", "hosted_app_platform"];
      const result = scoreFromCodes(codes);

      expect(result.score).toBe(65); // 40 + 25 + 0
      expect(result.level).toBe("high_risk");
    });

    it("brand_impersonation does not interfere with verified_official override", () => {
      const codes: ReasonCode[] = ["brand_impersonation", "verified_official"];
      const result = scoreFromCodes(codes);

      expect(result.score).toBe(0);
      expect(result.level).toBe("safe");
    });
  });
});
