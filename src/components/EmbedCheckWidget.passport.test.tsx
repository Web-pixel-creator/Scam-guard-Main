import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EmbedResult } from "@/components/EmbedCheckWidget";
import type { CheckResult } from "@/components/RiskResultCard";

const PHONE_PASSPORT_RESULT: CheckResult = {
  type: "phone",
  display: "+998 90 *** ** 67",
  level: "unknown",
  score: 0,
  reasons: ["valid_uz_phone"],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
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
    officialLookalike: null,
  },
  phoneReputation: null,
};

describe("EmbedResult risk passport", () => {
  it("renders phone passport sections compactly instead of generic advice", () => {
    const html = renderToStaticMarkup(<EmbedResult result={PHONE_PASSPORT_RESULT} lang="en" />);

    expect(html).toContain("Number passport");
    expect(html).toContain("Context, not a verdict");
    expect(html).toContain("Visible");
    expect(html).toContain("Number: Uzbekistan (+998)");
    expect(html).toContain("Beeline by prefix 90");
    expect(html).toContain("Next step");
    expect(html).not.toContain("What to do");
    expect(html).not.toContain("998901234567");
  });

  it("keeps high-risk embed results action-first", () => {
    const html = renderToStaticMarkup(
      <EmbedResult
        lang="en"
        result={{
          ...PHONE_PASSPORT_RESULT,
          level: "high_risk",
          score: 90,
          reasons: ["asks_for_sms_code"],
          explanation: "They ask for a confirmation code.",
          phoneIntelligence: null,
        }}
      />,
    );

    expect(html).toContain("High scam risk");
    expect(html).toContain("What to do");
    expect(html).not.toContain("Number passport");
  });
});
