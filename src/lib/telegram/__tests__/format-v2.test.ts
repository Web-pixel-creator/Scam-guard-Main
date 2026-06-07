import { describe, it, expect } from "vitest";
import { formatCheckResult } from "@/lib/telegram/format";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { Lang } from "@/lib/i18n";

// ── Representative fixtures (one per risk level) ────────────────────────────

const safeFixture: RunCheckResult = {
  type: "phone",
  display: "+998901234567",
  level: "safe",
  score: 0,
  reasons: ["valid_uz_phone"],
  explanation: "Номер зарегистрирован в Узбекистане, явных рисков нет.",
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

const unknownFixture: RunCheckResult = {
  type: "text",
  display: "криптовалюта биткоин инвестиции",
  level: "unknown",
  score: 5,
  reasons: ["unknown_sender"],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

const suspiciousFixture: RunCheckResult = {
  type: "url",
  display: "http://example.com/login",
  level: "suspicious",
  score: 35,
  reasons: ["suspicious_short_link", "weird_domain"],
  explanation: null,
  knownReports: 2,
  verifiedContact: null,
  brandEvidence: [],
};

const highRiskFixture: RunCheckResult = {
  type: "text",
  display: "masked sms code request",
  level: "high_risk",
  score: 80,
  reasons: ["asks_for_sms_code", "uses_urgency", "threatens_account_block"],
  explanation: "Сообщение содержит типичные признаки мошенничества.",
  knownReports: 5,
  verifiedContact: null,
  brandEvidence: [],
};

// ── Snapshot tests: 4 risk levels × 3 languages = 12 ───────────────────────

describe("formatCheckResult — UX v2 snapshots", () => {
  const fixtures: Record<string, RunCheckResult> = {
    safe: safeFixture,
    unknown: unknownFixture,
    suspicious: suspiciousFixture,
    high_risk: highRiskFixture,
  };

  describe.each(["ru", "uz", "en"] as const)("lang=%s", (lang) => {
    it("safe level", () => {
      const result = formatCheckResult(fixtures.safe, lang);
      expect(result.text).toMatchSnapshot();
    });

    it("unknown level", () => {
      const result = formatCheckResult(fixtures.unknown, lang);
      expect(result.text).toMatchSnapshot();
    });

    it("suspicious level", () => {
      const result = formatCheckResult(fixtures.suspicious, lang);
      expect(result.text).toMatchSnapshot();
    });

    it("high_risk level", () => {
      const result = formatCheckResult(fixtures.high_risk, lang);
      expect(result.text).toMatchSnapshot();
    });
  });

  it("renders a short brief for suspicious results when an explanation is available", () => {
    const result = formatCheckResult(
      {
        ...suspiciousFixture,
        explanation: "Ссылка ведёт на подозрительный домен.",
      },
      "ru",
    );

    expect(result.text).toContain("💡 *Кратко*");
    expect(result.text).toContain("Ссылка ведёт на подозрительный домен");
  });
});
