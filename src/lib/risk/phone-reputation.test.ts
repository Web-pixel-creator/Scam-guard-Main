import { describe, expect, it } from "vitest";

import {
  buildPhoneReputationSummary,
  formatNoPhoneReputationLine,
  formatPhoneReputationEvidenceLine,
  formatPhoneReputationScopeLine,
  phoneReputationConfidence,
} from "./phone-reputation";

describe("phone reputation summary", () => {
  it("does not expose unmoderated report counts", () => {
    const summary = buildPhoneReputationSummary({
      report_count: 9,
      moderation_status: "new",
      risk_level: "high_risk",
    });

    expect(summary).toBeNull();
  });

  it("builds a public summary from confirmed moderated reports only", () => {
    const summary = buildPhoneReputationSummary({
      report_count: 3,
      moderation_status: "confirmed",
      risk_level: "suspicious",
    });

    expect(summary).toEqual({
      source: "ishonch_guard_moderated_reports",
      confirmedReportCount: 3,
      confidence: "medium",
      riskLevel: "suspicious",
      publicScope: "confirmed_moderated_reports_only",
    });
  });

  it("uses conservative confidence thresholds", () => {
    expect(phoneReputationConfidence(1)).toBe("low");
    expect(phoneReputationConfidence(2)).toBe("medium");
    expect(phoneReputationConfidence(4)).toBe("medium");
    expect(phoneReputationConfidence(5)).toBe("high");
  });

  it("formats public reputation evidence with source, confidence and scope limits", () => {
    const summary = buildPhoneReputationSummary({
      report_count: 5,
      moderation_status: "confirmed",
      risk_level: "high_risk",
    });

    if (!summary) throw new Error("expected phone reputation summary");

    expect(formatPhoneReputationEvidenceLine(summary, "ru")).toContain(
      "подтверждённые модераторами жалобы Ishonch Guard",
    );
    expect(formatPhoneReputationEvidenceLine(summary, "ru")).toContain("5 подтверждённых жалоб");
    expect(formatPhoneReputationEvidenceLine(summary, "ru")).toContain("Уверенность: высокая");
    expect(formatPhoneReputationScopeLine("ru")).toContain("непроверенные жалобы");
    expect(formatPhoneReputationScopeLine("ru")).toContain("владельца номера");
    expect(formatNoPhoneReputationLine("ru")).toContain("не гарантия безопасности");
  });
});
