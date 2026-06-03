// Tests for the Telegram response formatter (`format.ts`, task 6.2).
//
// Covers task 6.3 of the telegram-bot-mvp spec:
//   • Property 5 — the reply ALWAYS contains the non-empty ADVICE[level][lang],
//     regardless of `explanation` (AI degradation, R13.1 / R13.2). Single
//     fast-check test, >= 100 runs.
//   • Unit checks (design.md → Testing Strategy):
//       - the explanation block is absent when explanation === null (R13.3);
//       - the Emergency button appears ONLY for level "high_risk" (R20.3),
//         while Report / Check another are always present (R4.6);
//       - the knownReports line appears ONLY when knownReports > 0 (R4.11).
//
// `format.ts` is a pure module, but importing it pulls in `api.server.ts`
// (escapeMarkdownV2). That module reads the bot token only inside its network
// helpers, so merely importing it performs no I/O — and vitest.setup.ts already
// seeds fake secrets, so nothing here touches real config.
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { formatCheckResult, CB, RISK_EMOJI } from "@/lib/telegram/format";
import { ADVICE, REASON_LABELS, type RiskLevel, type ReasonCode } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { InputType } from "@/lib/risk/detect";
import { bt } from "@/lib/telegram/bot-i18n";
import { t, type Lang } from "@/lib/i18n";
import { escapeMarkdownV2 } from "@/lib/telegram/api.server";
import { SCAM_PATTERNS } from "@/lib/scam-patterns";

// ---------------------------------------------------------------------------
// Shared fixtures / generators
// ---------------------------------------------------------------------------

const LANGS = ["ru", "uz", "en"] as const satisfies readonly Lang[];

const RISK_LEVELS = [
  "safe",
  "unknown",
  "suspicious",
  "high_risk",
] as const satisfies readonly RiskLevel[];

const INPUT_TYPES = [
  "phone",
  "telegram",
  "url",
  "text",
  "payment",
  "apk",
  "unknown",
] as const satisfies readonly InputType[];

// The full ReasonCode universe (kept as a runtime array because `ReasonCode`
// is a compile-time-only union; the `satisfies` clause rejects any typo).
const ALL_REASON_CODES = [
  "asks_for_otp",
  "asks_for_sms_code",
  "asks_for_card_cvv",
  "asks_for_pin",
  "asks_to_install_apk",
  "asks_to_share_screen",
  "asks_to_transfer_to_safe_account",
  "impersonates_bank",
  "impersonates_operator",
  "uses_urgency",
  "threatens_legal_action",
  "asks_not_to_hang_up",
  "telegram_bank_contact",
  "fake_loan_offer",
  "suspicious_short_link",
  "apk_download_link",
  "unknown_sender",
  "new_telegram_account",
  "weird_domain",
  "brand_name_typo",
  "payment_before_service",
  "too_good_to_be_true",
  "requests_personal_data",
  "non_uz_phone",
  "valid_uz_phone",
  "verified_official",
  "asks_to_scan_qr",
  "relative_in_distress",
  "requests_card_digits",
  "threatens_account_block",
  "fake_delivery_payment",
  "fake_boss_request",
  "malicious_file_bait",
  "impersonates_official",
  "suspicious_invite_link",
  "hosted_app_platform",
] as const satisfies readonly ReasonCode[];

/** Generator for an arbitrary, valid RunCheckResult (see check-core.ts). */
const runCheckResultArb: fc.Arbitrary<RunCheckResult> = fc.record({
  type: fc.constantFrom(...INPUT_TYPES),
  display: fc.string(),
  level: fc.constantFrom(...RISK_LEVELS),
  score: fc.nat(),
  reasons: fc.subarray([...ALL_REASON_CODES]),
  explanation: fc.option(fc.string()),
  knownReports: fc.nat(),
  verifiedContact: fc.constant(null),
});

/** A concrete result for the unit tests; fields overridable per case. */
function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "masked",
    level: "suspicious",
    score: 35,
    reasons: ["uses_urgency"],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    ...overrides,
  };
}

/** Flatten an inline keyboard to the list of callback_data strings. */
function callbacks(keyboard: { callback_data: string }[][]): string[] {
  return keyboard.flat().map((b) => b.callback_data);
}

// ---------------------------------------------------------------------------
// Property 5 — ADVICE is always present, even with no AI explanation
// ---------------------------------------------------------------------------

// Feature: telegram-bot-mvp, Property 5: Ответ всегда содержит ADVICE даже при недоступном AI
describe("formatCheckResult — Property 5: ADVICE всегда присутствует (R13.1, R13.2)", () => {
  it("текст содержит непустой ADVICE[level][lang] для любого результата и языка (fast-check, >= 100 прогонов)", () => {
    fc.assert(
      fc.property(runCheckResultArb, (result) => {
        for (const lang of LANGS) {
          const advice = ADVICE[result.level][lang];

          // The advice list itself must be non-empty for every level/lang.
          expect(advice.length).toBeGreaterThan(0);
          const firstNonEmpty = advice.find((item) => item.trim().length > 0);
          expect(firstNonEmpty).toBeDefined();

          const { text } = formatCheckResult(result, lang);

          // The formatter renders each advice item as `• ${escapeMarkdownV2(item)}`,
          // so the response text — regardless of `explanation` — must contain the
          // MarkdownV2-escaped advice item.
          expect(text).toContain(escapeMarkdownV2(firstNonEmpty as string));
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit checks
// ---------------------------------------------------------------------------

describe("formatCheckResult — explanation block (R13.3)", () => {
  it("опускает блок объяснения, когда explanation === null", () => {
    const { text } = formatCheckResult(baseResult({ explanation: null }), "ru");
    // The explanation block is headed by the i18n `ai_explanation` title.
    expect(text).not.toContain(escapeMarkdownV2(t("ai_explanation", "ru")));
  });

  it("включает блок объяснения, когда explanation задан", () => {
    const explanation = "Это похоже на попытку мошенничества.";
    const { text } = formatCheckResult(baseResult({ explanation }), "ru");
    expect(text).toContain(escapeMarkdownV2(t("ai_explanation", "ru")));
    expect(text).toContain(escapeMarkdownV2(explanation));
  });
});

describe("formatCheckResult — Emergency button (R4.6, R20.3)", () => {
  it("кнопка Emergency присутствует ТОЛЬКО при high_risk (и есть Report / Check another)", () => {
    const { keyboard } = formatCheckResult(baseResult({ level: "high_risk" }), "ru");
    const cbs = callbacks(keyboard);
    expect(cbs).toContain(CB.emergency);
    expect(cbs).toContain(CB.report);
    expect(cbs).toContain(CB.checkAnother);
  });

  it("для прочих уровней кнопки Emergency нет, но Report / Check another присутствуют", () => {
    for (const level of ["safe", "unknown", "suspicious"] as const) {
      const { keyboard } = formatCheckResult(baseResult({ level }), "ru");
      const cbs = callbacks(keyboard);
      expect(cbs).not.toContain(CB.emergency);
      expect(cbs).toContain(CB.report);
      expect(cbs).toContain(CB.checkAnother);
    }
  });
});

describe("formatCheckResult — known reports line (R4.11)", () => {
  it("строка о подтверждённых жалобах присутствует при knownReports > 0", () => {
    const { text } = formatCheckResult(baseResult({ knownReports: 3 }), "ru");
    expect(text).toContain(escapeMarkdownV2(bt("known_reports", "ru", { count: 3 })));
  });

  it("строка о подтверждённых жалобах отсутствует при knownReports === 0", () => {
    const { text } = formatCheckResult(baseResult({ knownReports: 0 }), "ru");
    // Count-independent fragment unique to the known_reports string.
    expect(text).not.toContain(escapeMarkdownV2("подтверждённых жалоб"));
  });
});

describe("formatCheckResult — header (R4.5, R4.4)", () => {
  it("содержит эмодзи уровня и метки обнаруженных reason-кодов", () => {
    const result = baseResult({
      level: "high_risk",
      reasons: ["asks_to_scan_qr", "uses_urgency"],
    });
    const { text } = formatCheckResult(result, "ru");
    expect(text).toContain(RISK_EMOJI[result.level]);
    for (const code of result.reasons) {
      expect(text).toContain(escapeMarkdownV2(REASON_LABELS[code].ru));
    }
  });
});

describe("formatCheckResult - deterministic URL fallback and scam patterns", () => {
  it("shows hosted-platform guidance instead of an AI explanation when AI is skipped", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "url",
        level: "unknown",
        score: 0,
        reasons: ["hosted_app_platform"],
        explanation: null,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(bt("hosted_platform_explanation", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(t("ai_explanation", "ru")));
  });

  it("shows matching scam-pattern names for detected reason codes", () => {
    const otpPattern = SCAM_PATTERNS.find((p) => p.id === "otp-code-scam");
    expect(otpPattern).toBeDefined();

    const { text } = formatCheckResult(
      baseResult({
        reasons: ["asks_for_sms_code"],
        explanation: null,
      }),
      "en",
    );

    expect(text).toContain("💡 Looks like:");
    expect(text).toContain(escapeMarkdownV2(otpPattern!.title.en));
  });
});
