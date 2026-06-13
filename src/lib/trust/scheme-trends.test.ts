import { describe, expect, it } from "vitest";
import {
  filterSchemeTrends,
  getSchemeTrendStats,
  PUBLIC_SCHEME_TRENDS,
  SCHEME_TREND_CATEGORIES,
} from "./scheme-trends";

describe("public scheme trends", () => {
  it("has unique stable ids", () => {
    const ids = PUBLIC_SCHEME_TRENDS.map((trend) => trend.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("links every public trend to deterministic reason codes", () => {
    expect(PUBLIC_SCHEME_TRENDS.length).toBeGreaterThan(0);
    for (const trend of PUBLIC_SCHEME_TRENDS) {
      expect(trend.reasonCodes.length).toBeGreaterThan(0);
    }
  });

  it("computes public stats from static entries", () => {
    const stats = getSchemeTrendStats();
    expect(stats.total).toBe(PUBLIC_SCHEME_TRENDS.length);
    expect(stats.activeWatch).toBe(
      PUBLIC_SCHEME_TRENDS.filter((trend) => trend.status === "active_watch").length,
    );
    expect(stats.critical).toBe(
      PUBLIC_SCHEME_TRENDS.filter((trend) => trend.severity === "critical").length,
    );
    expect(stats.categories).toBeGreaterThanOrEqual(4);
    expect(stats.reasonCodes).toBeGreaterThan(stats.categories);
  });

  it("filters by category without leaking other categories", () => {
    for (const category of SCHEME_TREND_CATEGORIES) {
      const results = filterSchemeTrends({ category });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((trend) => trend.category === category)).toBe(true);
    }
  });

  it("searches across localized public text and reason codes", () => {
    expect(filterSchemeTrends({ query: "frispin" }).map((trend) => trend.id)).toContain(
      "casino-free-spins-vip",
    );
    expect(filterSchemeTrends({ query: "SMS-код" }).map((trend) => trend.id)).toContain(
      "bank-sms-code-call",
    );
    expect(
      filterSchemeTrends({ query: "wallet_action_urgency" }).map((trend) => trend.id),
    ).toContain("ton-wallet-earning");
  });

  it("does not expose private-evidence shaped keys", () => {
    const forbiddenKeys = [
      "phone",
      "phoneNumber",
      "username",
      "url",
      "rawReport",
      "reportDescription",
      "ocrText",
      "screenshot",
      "telegramAge",
      "hiddenScamLabel",
    ];

    for (const trend of PUBLIC_SCHEME_TRENDS) {
      for (const key of forbiddenKeys) {
        expect(Object.prototype.hasOwnProperty.call(trend, key)).toBe(false);
      }
    }
  });

  it("has safe next steps and bot input guidance in every language", () => {
    for (const trend of PUBLIC_SCHEME_TRENDS) {
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(trend.safeStep[lang].trim().length).toBeGreaterThan(20);
        expect(trend.sendToBot[lang].trim().length).toBeGreaterThan(10);
      }
    }
  });
});
