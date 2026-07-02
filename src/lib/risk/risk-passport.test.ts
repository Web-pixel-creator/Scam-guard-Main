import { describe, expect, it } from "vitest";

import { buildRiskPassportSummary, detectRiskPassportKind } from "./risk-passport";
import type { RiskPassportInput } from "./risk-passport";

function baseResult(overrides: Partial<RiskPassportInput> = {}): RiskPassportInput {
  return {
    type: "text",
    display: "masked input",
    level: "unknown",
    reasons: [],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    ...overrides,
  };
}

describe("risk passport summary", () => {
  it("builds a compact phone passport from public metadata without raw digits", () => {
    const summary = buildRiskPassportSummary(
      baseResult({
        type: "phone",
        display: "+998 90 *** ** 67",
        reasons: ["valid_uz_phone"],
        phoneIntelligence: {
          digits: "998901234567",
          normalized: "+998901234567",
          kind: "uz_mobile",
          isValidFormat: true,
          isUzbekistan: true,
          country: {
            iso: "UZ",
            callingCode: "998",
            name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
          },
          uzPrefix: "90",
          uzOperator: {
            ru: "Beeline по префиксу 90",
            uz: "90 prefiksi bo'yicha Beeline",
            en: "Beeline by prefix 90",
          },
          officialDirectoryStatus: "not_found",
        },
      }),
      "en",
    );

    expect(summary).toMatchObject({
      kind: "phone",
      title: "Number passport",
      eyebrow: "Context, not a verdict",
    });
    expect(summary?.sections.map((section) => section.id)).toEqual([
      "visible",
      "directory",
      "reputation",
      "meaning",
      "next_step",
    ]);
    expect(summary?.sections[0]?.lines).toContain("Number: Uzbekistan (+998)");
    expect(JSON.stringify(summary)).toContain("Beeline by prefix 90");
    expect(JSON.stringify(summary)).not.toContain("998901234567");
  });

  it("parses existing Telegram passport briefs into compact sections", () => {
    const summary = buildRiskPassportSummary(
      baseResult({
        type: "telegram",
        display: "@UiWebWeb",
        explanation:
          "Telegram passport: @UiWebWeb\n\n👁 Visible\n• Public channel\n• Title: Ishonch\n\n🚫 Not visible\n• account age or hidden reports\n\n📌 Bottom line\nA username alone cannot prove safe or scam.",
      }),
      "en",
    );

    expect(summary?.kind).toBe("telegram");
    expect(summary?.title).toBe("Telegram passport");
    expect(summary?.sections.map((section) => section.id)).toEqual([
      "visible",
      "limits",
      "bottom_line",
      "next_step",
    ]);
    expect(summary?.sections[0]?.lines).toContain("Public channel");
    expect(summary?.sections[1]?.lines).toContain("account age or hidden reports");
  });

  it("does not replace urgent high-risk results with a passport", () => {
    const result = baseResult({
      type: "phone",
      level: "high_risk",
      reasons: ["asks_for_sms_code"],
      phoneIntelligence: {
        digits: "998901234567",
        normalized: "+998901234567",
        kind: "uz_mobile",
        isValidFormat: true,
        isUzbekistan: true,
        country: null,
        uzPrefix: "90",
        uzOperator: null,
        officialDirectoryStatus: "not_found",
      },
    });

    expect(detectRiskPassportKind(result)).toBeNull();
    expect(buildRiskPassportSummary(result, "en")).toBeNull();
  });

  it("includes moderated phone reputation source, confidence and scope limits", () => {
    const summary = buildRiskPassportSummary(
      baseResult({
        type: "phone",
        display: "+998 90 *** ** 67",
        reasons: ["valid_uz_phone"],
        knownReports: 3,
        phoneIntelligence: {
          digits: "998901234567",
          normalized: "+998901234567",
          kind: "uz_mobile",
          isValidFormat: true,
          isUzbekistan: true,
          country: {
            iso: "UZ",
            callingCode: "998",
            name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
          },
          uzPrefix: "90",
          uzOperator: {
            ru: "Beeline по префиксу 90",
            uz: "90 prefiksi bo'yicha Beeline",
            en: "Beeline by prefix 90",
          },
          officialDirectoryStatus: "not_found",
        },
        phoneReputation: {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: 3,
          confidence: "medium",
          riskLevel: "suspicious",
          publicScope: "confirmed_moderated_reports_only",
        },
      }),
      "en",
    );

    const reputation = summary?.sections.find((section) => section.id === "reputation");

    expect(reputation?.tone).toBe("warning");
    expect(reputation?.lines.join("\n")).toContain("moderator-confirmed reports");
    expect(reputation?.lines.join("\n")).toContain("3 confirmed report(s)");
    expect(reputation?.lines.join("\n")).toContain("Confidence: medium");
    expect(reputation?.lines.join("\n")).toContain("unverified reports");
    expect(reputation?.lines.join("\n")).toContain("carrier data");
    expect(JSON.stringify(summary)).not.toContain("998901234567");
  });
});
