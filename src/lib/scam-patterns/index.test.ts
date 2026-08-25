import { describe, expect, it } from "vitest";

import { findMatchingPatterns, getPatternById } from "./index";

function matchingIds(...codes: Parameters<typeof findMatchingPatterns>[0]) {
  return findMatchingPatterns(codes).map((pattern) => pattern.id);
}

describe("scam-pattern reason fidelity", () => {
  it("does not invent a specific scheme from a generic advance payment", () => {
    expect(matchingIds("payment_before_service")).toEqual([]);
  });

  it("requires both a loan offer and advance-payment evidence for the loan pattern", () => {
    expect(matchingIds("fake_loan_offer")).toEqual([]);
    expect(matchingIds("payment_before_service", "fake_loan_offer")).toEqual(["fake-loan-scam"]);
  });

  it("honors every linked code for match-all patterns, including weak context", () => {
    const pattern = getPatternById("fake-loan-scam");
    expect(pattern).toBeDefined();
    pattern!.reasonCodes.push("unknown_sender");

    try {
      expect(matchingIds("payment_before_service", "fake_loan_offer")).not.toContain(
        "fake-loan-scam",
      );
      expect(matchingIds("payment_before_service", "fake_loan_offer", "unknown_sender")).toContain(
        "fake-loan-scam",
      );
    } finally {
      pattern!.reasonCodes.pop();
    }
  });

  it("does not relabel a broad advance-fee reason as a prize", () => {
    expect(matchingIds("advance_fee_prize_inheritance")).not.toContain("prize-winner-scam");
    expect(matchingIds("payment_before_service", "advance_fee_prize_inheritance")).not.toContain(
      "prize-winner-scam",
    );
  });

  it("keeps the ungrounded prize entry available as educational content", () => {
    expect(getPatternById("prize-winner-scam")?.reasonCodes).toEqual([]);
  });

  it("keeps exact positive controls bound to their observed reasons", () => {
    expect(matchingIds("asks_to_transfer_to_safe_account")).toEqual(["safe-account-transfer"]);
    expect(matchingIds("fake_delivery_payment")).toEqual(["fake-delivery-scam"]);
    expect(matchingIds("asks_for_sms_code")).toEqual(["otp-code-scam"]);
  });

  it("does not let weak context attach a concrete pattern", () => {
    expect(matchingIds("unknown_sender")).toEqual([]);
  });

  it("binds the two emerging physical/traffic schemes only to their precise reasons", () => {
    expect(matchingIds("authority_coerced_dangerous_act")).toEqual([
      "authority-coerced-dangerous-act",
    ]);
    expect(matchingIds("fake_penalty_points_erasure")).toEqual(["penalty-points-erasure-scam"]);
    expect(matchingIds("threatens_legal_action")).not.toContain("authority-coerced-dangerous-act");
    expect(matchingIds("asks_for_money_transfer")).not.toContain("penalty-points-erasure-scam");
  });

  it("describes APK capabilities probabilistically rather than as a guaranteed outcome", () => {
    const pattern = getPatternById("apk-install-scam");

    expect(pattern?.description.en).toContain("may access or steal");
    expect(pattern?.description.ru).toContain("может получить доступ");
    expect(pattern?.description.uz).toContain("kirishi yoki ularni o'g'irlashi mumkin");
    expect(pattern?.description.en).not.toContain("The APK steals");
  });
});
