import { describe, expect, it } from "vitest";
import {
  EMPTY_PUBLIC_STATS,
  formatUzsCompact,
  normalizePublicStatsRow,
  PUBLIC_STATS_KEYS,
} from "./impact-stats";

describe("impact public stats", () => {
  it("defaults missing RPC fields to zero", () => {
    expect(normalizePublicStatsRow({ total: "12", today: 3 })).toEqual({
      ...EMPTY_PUBLIC_STATS,
      total: 12,
      today: 3,
    });
  });

  it("derives dangerous from high_risk and suspicious when missing", () => {
    expect(
      normalizePublicStatsRow({
        total: 10,
        high_risk: "2",
        suspicious: 4,
      }).dangerous,
    ).toBe(6);
  });

  it("keeps an explicit dangerous aggregate when present", () => {
    expect(
      normalizePublicStatsRow({
        high_risk: 2,
        suspicious: 4,
        dangerous: 9,
      }).dangerous,
    ).toBe(9);
  });

  it("exposes only aggregate-safe public stat keys", () => {
    const forbidden = [
      "input_hash",
      "redacted_input",
      "description",
      "screenshot_url",
      "entity_hash",
      "city",
      "language",
      "phone",
      "username",
      "url",
    ];

    for (const key of forbidden) {
      expect(PUBLIC_STATS_KEYS).not.toContain(key as never);
    }
  });

  it("formats empty and positive UZS amounts conservatively", () => {
    expect(formatUzsCompact(0, "ru")).toBe("нет суммы");
    expect(formatUzsCompact(2_500_000, "ru")).toMatch(/2/);
  });
});
