import { describe, expect, it } from "vitest";
import { INCIDENT_ONLY_REDACTED_VALUE } from "@/lib/report-boundary";
import { buildQuickReportSubmitData } from "./quick-report-payload";

describe("buildQuickReportSubmitData", () => {
  it("marks an empty optional target as incident-only", () => {
    expect(
      buildQuickReportSubmitData({
        value: "   ",
        description: "  They described a scam pattern without a concrete target.  ",
        lang: "ru",
      }),
    ).toEqual({
      value: INCIDENT_ONLY_REDACTED_VALUE,
      description: "They described a scam pattern without a concrete target.",
      lang: "ru",
      incidentOnly: true,
    });
  });

  it("keeps concrete targets as targeted reports", () => {
    expect(
      buildQuickReportSubmitData({
        value: "  @fakebank_support  ",
        description: "  Asked for an SMS code.  ",
        lang: "en",
      }),
    ).toEqual({
      value: "@fakebank_support",
      description: "Asked for an SMS code.",
      lang: "en",
    });
  });
});
