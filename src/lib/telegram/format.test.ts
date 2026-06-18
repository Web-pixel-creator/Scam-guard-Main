// Tests for the Telegram response formatter (`format.ts`).
//
// Updated for Result Message UX v2 (template-driven rendering).
// Covers:
//   • Template-driven output structure
//   • Verdict line presence
//   • Emergency button logic (R4.6, R20.3)
//   • Known reports integration in "what_noticed" section
//   • Brief section with truncated explanation
//   • Scam pattern integration in "what_noticed" section
//
// `format.ts` is a pure module, but importing it pulls in `api.server.ts`
// (escapeMarkdownV2). That module reads the bot token only inside its network
// helpers, so merely importing it performs no I/O — and vitest.setup.ts already
// seeds fake secrets, so nothing here touches real config.
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { formatCheckResult, CB, RISK_EMOJI } from "@/lib/telegram/format";
import { REASON_LABELS, type RiskLevel, type ReasonCode } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { InputType } from "@/lib/risk/detect";
import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import type { Lang } from "@/lib/i18n";
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
  "gambling_prediction_promo",
  "giveaway_engagement_bait",
  "crypto_casino_bonus_funnel",
  "fake_captcha_or_voting",
  "task_reward_engagement_bait",
  "wallet_action_urgency",
  "ton_referral_earning_scheme",
  "investment_fast_profit_pitch",
  "hosted_app_platform",
  "brand_impersonation",
  "telegram_account_takeover_phishing",
  "dropper_recruitment",
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
  brandEvidence: fc.constant([]),
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
    brandEvidence: [],
    ...overrides,
  };
}

/** Flatten an inline keyboard to the list of callback_data strings. */
function callbacks(keyboard: { callback_data?: string }[][]): string[] {
  return keyboard.flat().flatMap((b) => (b.callback_data ? [b.callback_data] : []));
}

function isRiskPassportLike(result: RunCheckResult): boolean {
  return (
    result.level === "unknown" &&
    !result.verifiedContact &&
    (result.type === "phone" ||
      result.type === "telegram" ||
      result.reasons.includes("valid_uz_phone") ||
      result.reasons.includes("non_uz_phone") ||
      Boolean(result.phoneIntelligence))
  );
}

// ---------------------------------------------------------------------------
// Property: Verdict line is present except for Risk Passport cards
// ---------------------------------------------------------------------------

// Feature: telegram-menu-visual-polish, Property 6: Verdict Line Presence
describe("formatCheckResult — Verdict line except Risk Passport cards", () => {
  it("текст содержит verdict line для любого результата и языка (fast-check, >= 100 прогонов)", () => {
    fc.assert(
      fc.property(runCheckResultArb, (result) => {
        for (const lang of LANGS) {
          const verdictKey = (
            {
              safe: "verdict_safe",
              unknown: "verdict_unknown",
              suspicious: "verdict_suspicious",
              high_risk: "verdict_high_risk",
            } satisfies Record<RiskLevel, BotStringKey>
          )[result.level];
          const expectedVerdict = bt(verdictKey, lang);

          const { text } = formatCheckResult(result, lang);

          if (isRiskPassportLike(result)) {
            expect(text).not.toContain(escapeMarkdownV2(expectedVerdict));
            continue;
          }

          // The verdict line (escaped for MarkdownV2) must always be present
          expect(text).toContain(escapeMarkdownV2(expectedVerdict));
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 1: Message Length Invariant
// For any valid RunCheckResult and any Lang, output.text.length ≤ 4096
// **Validates: Requirements 9.1**
// ---------------------------------------------------------------------------

describe("formatCheckResult — Message length ≤ 4096", () => {
  it("output text never exceeds Telegram 4096 char limit for any result and lang (fast-check, >= 100 runs)", () => {
    fc.assert(
      fc.property(runCheckResultArb, (result) => {
        for (const lang of LANGS) {
          const { text } = formatCheckResult(result, lang);
          expect(text.length).toBeLessThanOrEqual(4096);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: MarkdownV2 Validity
// The output of formatCheckResult contains no unescaped MarkdownV2 special
// characters outside intentional bold marker pairs (*...*).
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
// ---------------------------------------------------------------------------

/**
 * MarkdownV2 special characters that must be escaped in normal text.
 * Bold markers (*) are handled separately since they are intentional formatting.
 */
const MARKDOWN_V2_SPECIAL_CHARS = new Set([
  "_",
  "[",
  "]",
  "(",
  ")",
  "~",
  "`",
  ">",
  "#",
  "+",
  "-",
  "=",
  "|",
  "{",
  "}",
  ".",
  "!",
]);

/**
 * Validates that MarkdownV2 output has no unescaped special characters
 * outside of bold markers (*...*).
 *
 * Strategy:
 * 1. Strip bold marker pairs (*content*) and treat their content separately.
 * 2. In the remaining text (outside bold), check that every special char is
 *    preceded by a backslash (i.e., properly escaped).
 *
 * Note: Inside bold markers, the same escaping rules apply to the content,
 * so we validate the full text uniformly — bold markers are structural only.
 */
function validateMarkdownV2(text: string): { valid: boolean; issue?: string } {
  // We iterate character by character, tracking whether the previous char
  // was a backslash (escape character).
  // Bold markers (*) that are NOT escaped are structural — they open/close bold.
  // All other special chars must be preceded by \.

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === "\\") {
      // Escape character — skip the next character (it's the escaped special)
      i += 2;
      continue;
    }

    if (ch === "*") {
      // Unescaped * is a bold marker (structural) — allowed
      i++;
      continue;
    }

    if (MARKDOWN_V2_SPECIAL_CHARS.has(ch)) {
      return {
        valid: false,
        issue: `Unescaped special char '${ch}' at position ${i} (context: "...${text.slice(Math.max(0, i - 10), i + 10)}...")`,
      };
    }

    i++;
  }

  return { valid: true };
}

describe("formatCheckResult — MarkdownV2 validity", () => {
  it("output has no unescaped special chars for any result and lang (fast-check, >= 100 runs)", () => {
    fc.assert(
      fc.property(runCheckResultArb, (result) => {
        for (const lang of LANGS) {
          const { text } = formatCheckResult(result, lang);
          const validation = validateMarkdownV2(text);
          if (!validation.valid) {
            throw new Error(
              `MarkdownV2 validation failed for level=${result.level}, lang=${lang}: ${validation.issue}`,
            );
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit checks
// ---------------------------------------------------------------------------

describe("formatCheckResult — brief/explanation section (UX v2)", () => {
  it("опускает brief section, когда explanation === null и нет hosted_app_platform", () => {
    // For "safe" template which has "brief" section
    const { text } = formatCheckResult(baseResult({ level: "safe", explanation: null }), "ru");
    // The brief section title should not be present when there's nothing to show
    expect(text).not.toContain(escapeMarkdownV2(bt("section_brief", "ru")));
  });

  it("включает brief section с truncated explanation для уровней с brief в шаблоне", () => {
    const explanation = "Это похоже на попытку мошенничества.";
    // "safe" template includes "brief"
    const { text } = formatCheckResult(baseResult({ level: "safe", explanation }), "ru");
    expect(text).toContain(escapeMarkdownV2(bt("section_brief", "ru")));
    expect(text).toContain(escapeMarkdownV2(explanation));
  });

  it("показывает прочитанные QR-домены для нейтрального меню вместо generic fallback", () => {
    const explanation = [
      "🔎 QR прочитан: chenson.uz/loyalty, chenson.uz, chenson.uz/locations, t.me/chensonuz_bot.",
      "",
      "Похоже на меню, акцию или информационный QR. Я не вижу входа, оплаты, SMS-кода, карты или APK. Риск начинается, если после открытия попросят что-то из этого.",
    ].join("\n");

    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        score: 0,
        reasons: [],
        explanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("QR прочитан: chenson.uz/loyalty"));
    expect(text).toContain(escapeMarkdownV2("t.me/chensonuz_bot"));
    expect(text).toContain(escapeMarkdownV2(bt("risk_qr_info", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("verdict_qr_info", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("risk_unknown", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("verdict_unknown", "ru")));
    expect(text).not.toContain(escapeMarkdownV2("Я не буду утверждать, что прочитал сам QR"));
  });

  it("показывает видимый адрес около QR без заявления, что QR был декодирован", () => {
    const explanation = [
      "🔎 Адрес рядом с QR/на изображении: chenson.uz/menu. Сам QR по пикселям не подтверждён.",
      "",
      "Похоже на меню, акцию или информационный QR. Я не вижу входа, оплаты, SMS-кода, карты или APK.",
    ].join("\n");

    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        score: 0,
        reasons: [],
        explanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("Адрес рядом с QR/на изображении"));
    expect(text).toContain(escapeMarkdownV2("Сам QR по пикселям не подтверждён"));
    expect(text).toContain(escapeMarkdownV2(bt("risk_qr_info", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("brief_unknown_qr_menu", "ru")));
  });

  it("показывает QR-login пояснение без утечки токена в high-risk карточке", () => {
    const explanation = [
      "🔎 QR прочитан: Telegram login QR (token hidden).",
      "",
      "Похоже на QR для входа, подключения устройства или 2FA. Не сканируйте QR, который прислал другой человек.",
    ].join("\n");

    const { text } = formatCheckResult(
      baseResult({
        level: "high_risk",
        score: 65,
        reasons: ["asks_to_scan_qr"],
        explanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("Telegram login QR (token hidden)"));
    expect(text).toContain(escapeMarkdownV2("Не сканируйте QR"));
    expect(text).not.toContain("SECRET_TOKEN_SHOULD_NOT_LEAK");
  });
});

describe("formatCheckResult — calm unknown contexts", () => {
  it("replaces long crypto/investment AI paragraphs with a compact neutral brief", () => {
    const longCryptoExplanation =
      "Представленный текст содержит данные о торгах криптовалютой, операции с которой сопряжены с высокими финансовыми рисками. Подобные графики и обещания быстрого роста часто используются на неофициальных платформах для привлечения граждан в мошеннические инвестиционные схемы. Совершайте любые операции с крипто-активами только через провайдеров услуг, официально лицензированных Национальным агентством перспективных проектов Республики Узбекистан.";

    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        reasons: ["unknown_sender"],
        explanation: longCryptoExplanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(bt("brief_unknown_crypto", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("prompt_more_context_crypto", "ru")));
    expect(text).not.toContain(escapeMarkdownV2("Национальным агентством"));
    expect(text).not.toContain(escapeMarkdownV2("неофициальных платформах"));
  });

  it("treats a restaurant QR/menu as informational unless dangerous requests appear", () => {
    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        reasons: [],
        explanation:
          "Похоже на меню, акцию или информационный QR. Я не вижу входа, оплаты, SMS-кода, карты или APK.",
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(bt("brief_unknown_qr_menu", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("prompt_more_context_qr_menu", "ru")));
    expect(text).not.toContain(escapeMarkdownV2("Высокий риск"));
  });

  it("treats a normal delivery or pickup SMS as insufficient data, not danger", () => {
    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        reasons: [],
        explanation:
          "Похоже на обычное сообщение о доставке или пункте выдачи. В тексте нет ссылки, просьбы оплатить или назвать код.",
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(bt("brief_unknown_delivery", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("prompt_more_context_delivery", "ru")));
    expect(text).not.toContain(escapeMarkdownV2("Не сообщайте SMS-код"));
  });

  it("does not map or over-surface unknown_sender alone", () => {
    const fakeBank = SCAM_PATTERNS.find((p) => p.id === "fake-bank-telegram");
    expect(fakeBank).toBeDefined();

    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        reasons: ["unknown_sender"],
        explanation: null,
      }),
      "ru",
    );

    expect(text).not.toContain(escapeMarkdownV2(REASON_LABELS.unknown_sender.ru));
    expect(text).not.toContain(escapeMarkdownV2(fakeBank!.title.ru));
    expect(text).not.toContain(escapeMarkdownV2("крипто/инвестиций"));
  });

  it("uses Telegram-specific context prompts for profile-only checks", () => {
    const { text, keyboard } = formatCheckResult(
      baseResult({
        type: "telegram",
        level: "unknown",
        reasons: ["unknown_sender"],
        explanation: null,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("📋 Telegram-паспорт"));
    expect(text).toContain(escapeMarkdownV2(bt("brief_unknown_telegram_profile", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("prompt_more_context_telegram_profile", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("prompt_more_context", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("verdict_unknown", "ru")));
    expect(callbacks(keyboard)).toEqual(
      expect.arrayContaining([
        "asked:code",
        "asked:card",
        "asked:transfer",
        "asked:apk",
        "asked:link_qr",
        "asked:call",
      ]),
    );
  });

  it("adds quick requested-action buttons for inconclusive phone checks", () => {
    const { keyboard } = formatCheckResult(
      baseResult({
        type: "phone",
        level: "unknown",
        reasons: ["valid_uz_phone"],
        explanation: null,
      }),
      "ru",
    );

    expect(keyboard[0].map((button) => button.callback_data)).toEqual(["asked:code", "asked:card"]);
    expect(keyboard[1].map((button) => button.callback_data)).toEqual([
      "asked:transfer",
      "asked:apk",
    ]);
    expect(keyboard[2].map((button) => button.callback_data)).toEqual([
      "asked:link_qr",
      "asked:call",
    ]);
    expect(callbacks(keyboard)).toContain(CB.checkAnother);
  });

  it("renders inconclusive phone checks as a number passport, not a generic unknown result", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        level: "unknown",
        reasons: ["valid_uz_phone"],
        explanation: null,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("📋 Паспорт номера"));
    expect(text).toContain(escapeMarkdownV2(bt("brief_unknown_phone", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("verdict_unknown", "ru")));
  });

  it("keeps Telegram passport briefs readable instead of cutting off the limitation", () => {
    const explanation = [
      "📋 Telegram-паспорт: @UiWebWeb",
      "",
      "👁 Что видно",
      "• Bot API не видит этот username",
      "• Это не доказательство скама",
      "",
      "🚫 Что недоступно",
      "• скрытая SCAM-метка, возраст аккаунта, жалобы Telegram и кому он писал",
      "",
      "📌 Вывод",
      "По одному username нельзя честно сказать «безопасно» или «скам».",
      "🛡 Репутация и признаки",
      "• подтвержд. жалоб в Ishonch Guard не найдено",
      "• отправитель не подтверждён",
      "🧭 Следующий шаг",
      "Пришлите сообщение/скрин: что просят — код, деньги, карту, APK или ссылку?",
    ].join("\n");

    const { text } = formatCheckResult(
      baseResult({
        type: "telegram",
        level: "unknown",
        reasons: ["unknown_sender"],
        explanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("Telegram-паспорт: @UiWebWeb"));
    expect(text).toContain(escapeMarkdownV2("Что недоступно"));
    expect(text).toContain(escapeMarkdownV2("скрытая SCAM-метка"));
    expect(text).toContain(escapeMarkdownV2("подтвержд. жалоб в Ishonch Guard не найдено"));
    expect(text).toContain(escapeMarkdownV2("код, деньги, карту, APK"));
    expect(text).not.toContain(escapeMarkdownV2(bt("prompt_more_context_telegram_profile", "ru")));
    expect(text).not.toContain("…");
  });

  it("still shows a scam pattern when a strong linked reason is present", () => {
    const fakeBank = SCAM_PATTERNS.find((p) => p.id === "fake-bank-telegram");
    expect(fakeBank).toBeDefined();

    const { text } = formatCheckResult(
      baseResult({
        level: "unknown",
        reasons: ["impersonates_official"],
        explanation: null,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(fakeBank!.title.ru));
  });
});

describe("formatCheckResult — Emergency button (R4.6, R20.3)", () => {
  it("кнопка Emergency присутствует ТОЛЬКО при high_risk (и есть Report / Check another / Why)", () => {
    const { keyboard } = formatCheckResult(baseResult({ level: "high_risk" }), "ru");
    const cbs = callbacks(keyboard);
    expect(cbs).toContain(CB.emergency);
    expect(cbs).toContain(CB.report);
    expect(cbs).toContain(CB.checkAnother);
    expect(cbs).toContain(CB.why);
    expect(cbs).toContain(CB.notifyTrusted);
  });

  it("для прочих уровней кнопки Emergency нет, но Report / Check another / Why присутствуют", () => {
    for (const level of ["safe", "unknown", "suspicious"] as const) {
      const { keyboard } = formatCheckResult(baseResult({ level }), "ru");
      const cbs = callbacks(keyboard);
      expect(cbs).not.toContain(CB.emergency);
      expect(cbs).toContain(CB.report);
      expect(cbs).toContain(CB.checkAnother);
      expect(cbs).toContain(CB.why);
    }
  });

  it("keyboard layout: Report+CheckAnother in row 1, Why in row 2, Emergency in row 3 for high_risk", () => {
    const { keyboard } = formatCheckResult(baseResult({ level: "high_risk" }), "ru");
    expect(keyboard[0].map((b) => b.callback_data)).toEqual([CB.report, CB.checkAnother]);
    expect(keyboard[1].map((b) => b.callback_data)).toEqual([CB.why]);
    expect(keyboard[2].map((b) => b.callback_data)).toEqual([CB.notifyTrusted, CB.emergency]);
  });

  it("keyboard layout: Report+CheckAnother in row 1, Why in row 2, no row 3 for non-high_risk", () => {
    const { keyboard } = formatCheckResult(baseResult({ level: "safe" }), "ru");
    expect(keyboard[0].map((b) => b.callback_data)).toEqual([CB.report, CB.checkAnother]);
    expect(keyboard[1].map((b) => b.callback_data)).toEqual([CB.why]);
    expect(keyboard).toHaveLength(2);
  });
});

describe("formatCheckResult — known reports line (R4.11)", () => {
  it("строка о подтверждённых жалобах присутствует при knownReports > 0 (в шаблоне с what_noticed)", () => {
    // "safe" template has "what_noticed" section that renders knownReports
    const { text } = formatCheckResult(
      baseResult({ level: "safe", knownReports: 3, reasons: ["valid_uz_phone"] }),
      "ru",
    );
    expect(text).toContain(escapeMarkdownV2(bt("known_reports", "ru", { count: 3 })));
  });

  it("строка о подтверждённых жалобах отсутствует при knownReports === 0", () => {
    const { text } = formatCheckResult(baseResult({ level: "safe", knownReports: 0 }), "ru");
    // Count-independent fragment unique to the known_reports string.
    expect(text).not.toContain(escapeMarkdownV2("подтверждённых жалоб"));
  });

  it("shows phone reputation with source, confidence and limits instead of hidden-data claims", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        display: "+998 90 ••• 67",
        level: "high_risk",
        knownReports: 3,
        reasons: ["known_reported"],
        phoneReputation: {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: 3,
          confidence: "medium",
          riskLevel: "high_risk",
          publicScope: "confirmed_moderated_reports_only",
        },
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("Ishonch Guard"));
    expect(text).toContain(escapeMarkdownV2("3 подтверждённых жалоб"));
    expect(text).toContain(escapeMarkdownV2("Уверенность: средняя"));
    expect(text).toContain(escapeMarkdownV2("не определяет владельца номера"));
    expect(text).not.toMatch(/скрыт(ая|ой).*баз/i);
    expect(text).not.toContain("901234567");
  });
});

describe("formatCheckResult — Phone Directory v1", () => {
  it("shows verified contact details and spoofing warning", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        level: "safe",
        score: 0,
        reasons: ["valid_uz_phone"],
        verifiedContact: {
          orgName: "Капиталбанк",
          orgType: "bank",
          source: "kapitalbank.uz (official contacts)",
          display: "1340",
          contactType: "short_code",
          verificationLevel: "high",
          description: "Колл-центр для физ. лиц",
        },
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("официальном справочнике"));
    expect(text).toContain(escapeMarkdownV2("Капиталбанк"));
    expect(text).toContain(escapeMarkdownV2("Контакт: 1340"));
    expect(text).toContain(escapeMarkdownV2("не доказывает, что входящий звонок безопасен"));
  });

  it("does not infer an owner for unknown Uzbek phone numbers", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        display: "+998 90 ••• 67",
        level: "safe",
        score: 0,
        reasons: ["valid_uz_phone"],
        explanation: null,
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
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("📋 Паспорт номера"));
    expect(text).toContain(escapeMarkdownV2("• Номер: Узбекистан (+998)"));
    expect(text).toContain(escapeMarkdownV2("• Beeline по префиксу 90"));
    expect(text).toContain(
      escapeMarkdownV2("В официальном справочнике Ishonch Guard совпадения нет."),
    );
    expect(text).toContain(escapeMarkdownV2("подтвержд. жалоб в Ishonch Guard не найдено"));
    expect(text).toContain(escapeMarkdownV2("Сам номер не доказывает мошенничество"));
    expect(text).toContain(escapeMarkdownV2("SMS-код"));
    expect(text).toContain(escapeMarkdownV2("QR-вход"));
    expect(text).not.toContain("Uzonline");
    expect(text).not.toContain("Uztelecom");
    expect(text).not.toContain("901234567");
  });

  it("shows foreign phone country without claiming hidden reputation data", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        display: "+49•••••56",
        level: "unknown",
        score: 5,
        reasons: ["non_uz_phone"],
        explanation: null,
        phoneIntelligence: {
          digits: "4930123456",
          normalized: "+49 30 123456",
          kind: "international",
          isValidFormat: true,
          isUzbekistan: false,
          country: {
            iso: "DE",
            callingCode: "49",
            name: { ru: "Германия", uz: "Germaniya", en: "Germany" },
          },
          uzPrefix: null,
          uzOperator: null,
          officialDirectoryStatus: "not_found",
        },
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2("📋 Паспорт номера"));
    expect(text).toContain(escapeMarkdownV2("• Номер: Германия (+49)"));
    expect(text).toContain(escapeMarkdownV2("Это не узбекский номер"));
    expect(text).not.toMatch(/SCAM-метк|возраст аккаунта|истори[яи] жалоб/i);
    expect(text).not.toContain("4930123456");
  });

  it("shows official-number lookalikes as near matches, not accusations", () => {
    const { text } = formatCheckResult(
      baseResult({
        type: "phone",
        display: "+998 90 ••• 40",
        level: "unknown",
        score: 0,
        reasons: [],
        explanation: null,
        phoneIntelligence: {
          digits: "998901231340",
          normalized: "+998901231340",
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
          officialLookalike: {
            org: { ru: "Капиталбанк", uz: "Kapitalbank", en: "Kapitalbank" },
            orgType: "bank",
            display: "1340",
            contactType: "short_code",
            reason: "short_code_suffix",
            confidence: "low",
          },
        },
      }),
      "ru",
    );

    expect(text).toContain(
      escapeMarkdownV2("Похож на официальный контакт, но не совпадает: Капиталбанк — 1340."),
    );
    expect(text).toContain(escapeMarkdownV2("не перезванивайте по входящему номеру"));
    expect(text).toContain(escapeMarkdownV2("Сам номер не доказывает мошенничество"));
    expect(text).not.toMatch(/мошенник|точно фейк|SCAM-метк/i);
    expect(text).not.toContain("998901231340");
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

describe("formatCheckResult — compressed high-risk first card", () => {
  it("keeps high-risk result action-first and hides long detail sections from the first card", () => {
    const explanation =
      "Длинное объяснение: мошенник создаёт ощущение срочности, просит код, давит на пользователя и пытается получить доступ к счёту.";
    const { text } = formatCheckResult(
      baseResult({
        level: "high_risk",
        reasons: ["asks_for_sms_code", "uses_urgency", "threatens_account_block"],
        explanation,
      }),
      "ru",
    );

    expect(text).toContain(escapeMarkdownV2(bt("section_action_now", "ru")));
    expect(text).toContain(escapeMarkdownV2(bt("section_noticed", "ru")));
    expect(text).toContain(escapeMarkdownV2(REASON_LABELS.asks_for_sms_code.ru));
    expect(text).not.toContain(escapeMarkdownV2(bt("section_why_danger", "ru")));
    expect(text).not.toContain(escapeMarkdownV2(bt("section_where_report", "ru")));
    expect(text).not.toContain(escapeMarkdownV2("Cyber Police"));
    expect(text).not.toContain(escapeMarkdownV2(explanation));
  });
});

describe("formatCheckResult - deterministic URL fallback and scam patterns", () => {
  it("shows hosted-platform guidance instead of an AI explanation when AI is skipped", () => {
    // "unknown" template has "brief" section which will show the hosted platform fallback
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

    expect(text).toContain(escapeMarkdownV2("Этот адрес размещён на публичной платформе"));
    expect(text).toContain("…");
  });

  it("shows matching scam-pattern names for detected reason codes in what_noticed section", () => {
    const otpPattern = SCAM_PATTERNS.find((p) => p.id === "otp-code-scam");
    expect(otpPattern).toBeDefined();

    // "safe" template has "what_noticed" section where patterns appear
    const { text } = formatCheckResult(
      baseResult({
        level: "safe",
        reasons: ["asks_for_sms_code"],
        explanation: null,
      }),
      "en",
    );

    // Pattern title should appear in the what_noticed section
    expect(text).toContain(escapeMarkdownV2(otpPattern!.title.en));
  });
});
