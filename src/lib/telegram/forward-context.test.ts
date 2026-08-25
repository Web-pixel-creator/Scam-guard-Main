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
    expect(enriched.explanation).toContain("Источник: Telegram-канал");
    expect(enriched.explanation).toContain("LUXEBET");
    expect(enriched.explanation).toContain("Схема: ставки/казино/VIP-бонус");
    expect(enriched.explanation).toContain("Цель: оплата прогноза");
    expect(enriched.explanation).toContain("Шаг: не платите");
    expect(enriched.explanation).toContain("скрытые метки");
  });

  it("does not claim hidden Telegram reputation data", () => {
    const brief = buildForwardSourceBrief(
      { kind: "channel", title: "Public Channel", username: "public_channel" },
      "ru",
      result({ reasons: ["giveaway_engagement_bait"] }),
    );

    expect(brief).toContain("Public Channel");
    expect(brief).not.toMatch(/создан недавно|есть жалобы|спамит|точно мошенник/i);
    expect(brief).toContain("не видны");
  });

  it.each([
    ["ru", /угрожают приехать|физическую силу/iu, /безопасное место.*102/isu],
    ["uz", /jismoniy kuch|tahdid/iu, /xavfsiz joyga.*102/isu],
    ["en", /physical violence/iu, /somewhere safe.*102/isu],
  ] as const)(
    "keeps a forwarded violence threat on the urgent safety path in %s",
    (lang, danger, step) => {
      const enriched = enrichForwardSourceContext(
        result({
          level: "high_risk",
          score: 80,
          reasons: ["asks_for_sms_code", "threatens_physical_violence"],
          explanation: "Generic account-risk explanation that must not lead.",
        }),
        { kind: "channel", title: "Unknown Channel", username: "unknown_source" },
        lang,
      );

      expect(enriched.explanation).toMatch(danger);
      expect(enriched.explanation).toMatch(step);
      expect(enriched.explanation).not.toMatch(/Telegram account takeover|угон Telegram/iu);
    },
  );

  it.each([
    [
      "asks_for_money_transfer",
      "ru",
      /просьба о переводе|непроверенному получателю/iu,
      /не переводите.*проверьте/isu,
    ],
    [
      "asks_for_money_transfer",
      "uz",
      /pul o'tkazish|tekshirilmagan oluvchi/iu,
      /pul o'tkazmang.*mustaqil tekshiring/isu,
    ],
    [
      "asks_for_money_transfer",
      "en",
      /transfer or payment request|unverified recipient/iu,
      /do not transfer.*verify/isu,
    ],
    ["fake_penalty_points_erasure", "ru", /удалить штрафные баллы/iu, /не платите.*официальн/isu],
    [
      "fake_penalty_points_erasure",
      "uz",
      /jarima ballarini.*o'chirish/iu,
      /pul yubormang.*rasmiy/isu,
    ],
    ["fake_penalty_points_erasure", "en", /erase penalty points/iu, /do not pay.*official/isu],
  ] as const)(
    "keeps forwarded payment guidance specific for %s in %s",
    (reason, lang, scenario, step) => {
      const enriched = enrichForwardSourceContext(
        result({ level: "high_risk", score: 80, reasons: [reason] }),
        { kind: "channel", title: "Payment Channel", username: "payment_source" },
        lang,
      );

      expect(enriched.explanation).toMatch(scenario);
      expect(enriched.explanation).toMatch(step);
    },
  );

  it("keeps an APK action ahead of penalty-point payment copy in a forwarded post", () => {
    const enriched = enrichForwardSourceContext(
      result({
        level: "high_risk",
        score: 90,
        reasons: ["fake_penalty_points_erasure", "asks_to_install_apk"],
      }),
      { kind: "channel", title: "ROAD24 Update", username: "road24_update" },
      "ru",
    );

    expect(enriched.explanation).toContain("опасная просьба от имени банка/support");
    expect(enriched.explanation).toContain("APK");
    expect(enriched.explanation).not.toContain("Схема: обещают за деньги удалить штрафные баллы");
  });
});
