import { describe, expect, it } from "vitest";

import { displayRiskScore } from "./display-score";
import { scoreFromCodes } from "./rules";

describe("displayRiskScore", () => {
  it("bounds summed rule weights to the 0–100 scale shown to people", () => {
    expect(displayRiskScore(115)).toBe(100);
    expect(displayRiskScore(-4)).toBe(0);
    expect(displayRiskScore(74.6)).toBe(75);
    expect(displayRiskScore(Number.NaN)).toBe(0);
  });

  it("keeps an over-100 engine score displayable as at most 100", () => {
    // The homepage APK example produced "115 / 100" before the bound.
    const { score } = scoreFromCodes(["asks_to_install_apk", "apk_download_link", "weird_domain"]);
    expect(score).toBeGreaterThan(100);
    expect(displayRiskScore(score)).toBe(100);
  });
});
