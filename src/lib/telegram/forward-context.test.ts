import { describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  buildForwardSourceBrief,
  enrichForwardSourceContext,
  normalizeForwardSource,
} from "@/lib/telegram/forward-context";

function result(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "masked",
    level: "suspicious",
    score: 35,
    reasons: [],
    explanation: "Проверено по видимому тексту.",
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

describe("Telegram forward source context", () => {
  it("keeps only sanitized public channel/chat fields", () => {
    expect(
      normalizeForwardSource({
        kind: "channel",
        title: "  LUXEBET   Promo  ",
        username: "@luxebet_news",
      }),
    ).toEqual({
      kind: "channel",
      title: "LUXEBET Promo",
      username: "luxebet_news",
    });

    expect(
      normalizeForwardSource({
        kind: "chat",
        title: "Group +998 90 123 45 67",
        username: "group_2026",
      }),
    ).toEqual({
      kind: "chat",
      title: "Group +998•••••67",
      username: "group_2026",
    });
  });

  it("rejects private/hidden-like or invalid source data", () => {
    expect(normalizeForwardSource({ kind: "user", title: "Ali", username: "ali_user" })).toBeNull();
    expect(normalizeForwardSource({ kind: "channel", title: "", username: "bad-name" })).toBeNull();
    expect(normalizeForwardSource({ kind: "chat" })).toBeNull();
  });

  it("adds visible source context without changing deterministic verdict fields", () => {
    const base = result({
      level: "high_risk",
      score: 75,
      reasons: ["crypto_casino_bonus_funnel", "suspicious_invite_link"],
      knownReports: 2,
    });

    const enriched = enrichForwardSourceContext(
      base,
      { kind: "channel", title: "LUXEBET", username: "luxebet_uz" },
      "ru",
    );

    expect(enriched).toMatchObject({
      type: base.type,
      display: base.display,
      level: base.level,
      score: base.score,
      reasons: base.reasons,
      knownReports: base.knownReports,
    });
    expect(enriched.explanation).toContain("Источник: пост переслан из Telegram-канала");
    expect(enriched.explanation).toContain("LUXEBET");
    expect(enriched.explanation).toContain("ставки/казино");
    expect(enriched.explanation).toContain("Я не вижу скрытую SCAM-метку");
  });

  it("does not claim hidden Telegram reputation data", () => {
    const brief = buildForwardSourceBrief(
      { kind: "channel", title: "Public Channel", username: "public_channel" },
      "ru",
      result({ reasons: ["giveaway_engagement_bait"] }),
    );

    expect(brief).toContain("Public Channel");
    expect(brief).not.toMatch(/создан недавно|есть жалобы|спамит|точно мошенник/i);
    expect(brief).toContain("не вижу");
  });
});
