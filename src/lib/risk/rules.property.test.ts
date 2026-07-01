import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { scoreFromCodes, type ReasonCode, type RiskLevel } from "./rules";

// Property-based tests for the risk scoring rules (Properties 6 and 10 from
// design.md of the telegram-bot-mvp spec). Each property is a single fast-check
// test with >= 100 runs, per the spec's testing strategy.

// ---------------------------------------------------------------------------
// Shared fixtures: the reason-code universe split into "legacy" (pre-refactor,
// 26 codes) and the 4 codes added by task 3.1. Kept as runtime arrays because
// `ReasonCode` is a compile-time-only union; the `readonly ReasonCode[]`
// annotations make TypeScript reject any typo'd / non-existent code.
// ---------------------------------------------------------------------------

/** The four reason codes added for the Telegram local-scenario scoring. */
const NEW_CODES = [
  "asks_to_scan_qr",
  "relative_in_distress",
  "requests_card_digits",
  "threatens_account_block",
] as const satisfies readonly ReasonCode[];

/** The follow-up reason codes added from local research-feed patterns. */
const RESEARCH_FEED_CODES = [
  "known_reported",
  "fake_delivery_payment",
  "fake_boss_request",
  "malicious_file_bait",
  "telegram_account_takeover_phishing",
  "dropper_recruitment",
  "gambling_prediction_promo",
  "giveaway_engagement_bait",
  "crypto_casino_bonus_funnel",
  "fake_captcha_or_voting",
  "task_reward_engagement_bait",
  "wallet_action_urgency",
  "ton_referral_earning_scheme",
  "investment_fast_profit_pitch",
  "romance_investment_pivot",
  "oneid_government_phishing",
  "sim_swap_or_number_transfer",
  "money_mule_recruitment",
  "advance_fee_prize_inheritance",
] as const satisfies readonly ReasonCode[];

/** The 26 reason codes that existed before the new local-scenario codes. */
const OLD_CODES = [
  "asks_for_otp",
  "asks_for_sms_code",
  "asks_for_card_cvv",
  "asks_for_pin",
  "asks_to_install_apk",
  "asks_to_share_screen",
  "asks_to_transfer_to_safe_account",
  "impersonates_bank",
  "impersonates_operator",
  "uses_urgency",
  "threatens_legal_action",
  "asks_not_to_hang_up",
  "telegram_bank_contact",
  "fake_loan_offer",
  "suspicious_short_link",
  "apk_download_link",
  "unknown_sender",
  "new_telegram_account",
  "weird_domain",
  "brand_name_typo",
  "payment_before_service",
  "too_good_to_be_true",
  "requests_personal_data",
  "non_uz_phone",
  "valid_uz_phone",
  "verified_official",
] as const satisfies readonly ReasonCode[];

const ALL_CODES: readonly ReasonCode[] = [...OLD_CODES, ...NEW_CODES, ...RESEARCH_FEED_CODES];

// ---------------------------------------------------------------------------
// Legacy reference for Property 10.
//
// These weights and thresholds are copied verbatim from the pre-refactor
// `scoreFromCodes` (before the 4 new codes were added). They act as an
// independent oracle: for any input drawn only from the OLD codes, the current
// `scoreFromCodes` must still produce exactly this result.
// ---------------------------------------------------------------------------

const LEGACY_WEIGHTS: Record<(typeof OLD_CODES)[number], number> = {
  asks_for_otp: 45,
  asks_for_sms_code: 45,
  asks_for_card_cvv: 45,
  asks_for_pin: 45,
  asks_to_install_apk: 45,
  asks_to_share_screen: 35,
  asks_to_transfer_to_safe_account: 40,
  impersonates_bank: 30,
  impersonates_operator: 25,
  uses_urgency: 15,
  threatens_legal_action: 20,
  asks_not_to_hang_up: 20,
  telegram_bank_contact: 25,
  fake_loan_offer: 25,
  suspicious_short_link: 30,
  apk_download_link: 45,
  unknown_sender: 5,
  new_telegram_account: 10,
  weird_domain: 25,
  brand_name_typo: 20,
  payment_before_service: 20,
  too_good_to_be_true: 15,
  requests_personal_data: 15,
  non_uz_phone: 5,
  valid_uz_phone: 0,
  verified_official: -100,
};

/** Pre-refactor scoring logic, reproduced exactly (weights + thresholds). */
function legacyScoreFromCodes(codes: readonly (typeof OLD_CODES)[number][]): {
  score: number;
  level: RiskLevel;
} {
  let score = 0;
  for (const c of codes) score += LEGACY_WEIGHTS[c] ?? 0;
  if (codes.includes("verified_official")) return { score: 0, level: "safe" };
  if (score >= 50) return { score, level: "high_risk" };
  if (score >= 20) return { score, level: "suspicious" };
  if (score > 0) return { score, level: "unknown" };
  return { score, level: "unknown" };
}

describe("risk rules — property-based scoring invariants", () => {
  // Sanity guard so the fixtures above stay in sync with rules.ts: the universe
  // must be exactly the 26 old + 4 new codes, with no overlaps or duplicates.
  it("fixtures cover the full reason-code universe without overlap", () => {
    expect(OLD_CODES.length).toBe(26);
    expect(NEW_CODES.length).toBe(4);
    expect(RESEARCH_FEED_CODES.length).toBe(19);
    expect(new Set(ALL_CODES).size).toBe(49);
    for (const c of [...NEW_CODES, ...RESEARCH_FEED_CODES]) {
      expect(OLD_CODES).not.toContain(c);
    }
  });

  // Feature: telegram-bot-mvp, Property 6: `asks_to_scan_qr` always yields high_risk
  //
  // For any set of reason codes containing "asks_to_scan_qr",
  // scoreFromCodes(codes).level === "high_risk".
  //
  // Assumption (documented): "verified_official" is excluded from the generator.
  // It is the sole short-circuit in scoreFromCodes (returns "safe" regardless of
  // other codes), and the property "QR request => high_risk" presupposes there is
  // no verified official contact overriding the verdict. With verified_official
  // excluded, every other weight is >= 0 and asks_to_scan_qr alone weighs 50, so
  // the total is always >= 50 => high_risk.
  //
  // Validates: Requirements 14.4
  it("Property 6: any code set containing asks_to_scan_qr is high_risk", () => {
    const candidatePool = ALL_CODES.filter(
      (c) => c !== "asks_to_scan_qr" && c !== "verified_official",
    );

    fc.assert(
      fc.property(fc.subarray(candidatePool), (others) => {
        const codes: ReasonCode[] = [...others, "asks_to_scan_qr"];
        expect(scoreFromCodes(codes).level).toBe("high_risk");
      }),
      { numRuns: 100 },
    );
  });

  // Feature: telegram-bot-mvp, Property 10: thresholds preserved when adding reason codes
  //
  // For any set of codes drawn only from the OLD 26 (i.e. excluding the four new
  // codes), the current scoreFromCodes result is identical to the pre-refactor
  // behavior reproduced by legacyScoreFromCodes. This proves the new codes did
  // not perturb scoring/thresholds for pre-existing inputs.
  //
  // Validates: Requirements 14.1, 4.2
  it("Property 10: legacy code sets score identically to the pre-refactor oracle", () => {
    fc.assert(
      fc.property(fc.subarray([...OLD_CODES]), (codes) => {
        expect(scoreFromCodes(codes)).toEqual(legacyScoreFromCodes(codes));
      }),
      { numRuns: 100 },
    );
  });
});
