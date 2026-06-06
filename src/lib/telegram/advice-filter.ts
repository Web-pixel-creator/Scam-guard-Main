/**
 * Context-Aware Advice Filter (Result Message UX v2)
 *
 * Maps detected reason codes to relevant, context-specific advice strings.
 * Returns max 3 items. Does NOT include generic advice unless reasons
 * specifically relate to the corresponding category.
 */

import type { Lang } from "@/lib/i18n";
import type { RiskLevel, ReasonCode } from "@/lib/risk/rules";

// ── Advice category definitions ─────────────────────────────────────────────

interface AdviceEntry {
  ru: string;
  uz: string;
  en: string;
}

interface AdviceCategory {
  reasons: Set<ReasonCode>;
  advice: AdviceEntry;
}

const REASON_ADVICE_MAP: AdviceCategory[] = [
  // OTP/code reasons → don't share codes
  {
    reasons: new Set<ReasonCode>([
      "asks_for_otp",
      "asks_for_sms_code",
      "asks_for_pin",
      "asks_for_card_cvv",
      "requests_card_digits",
    ]),
    advice: {
      ru: "Не сообщайте SMS-код или PIN",
      uz: "SMS-kod yoki PIN-ni aytmang",
      en: "Do not share your SMS code or PIN",
    },
  },
  // Link/APK reasons → don't click or install
  {
    reasons: new Set<ReasonCode>([
      "suspicious_short_link",
      "apk_download_link",
      "asks_to_install_apk",
      "weird_domain",
      "malicious_file_bait",
      "asks_to_share_screen",
      "asks_to_scan_qr",
    ]),
    advice: {
      ru: "Не переходите по ссылке и не устанавливайте APK",
      uz: "Havolaga o'tmang va APK o'rnatmang",
      en: "Do not click the link or install the APK",
    },
  },
  // Money transfer reasons → don't send money
  {
    reasons: new Set<ReasonCode>([
      "asks_to_transfer_to_safe_account",
      "payment_before_service",
      "fake_delivery_payment",
      "fake_loan_offer",
      "too_good_to_be_true",
      "relative_in_distress",
    ]),
    advice: {
      ru: "Не переводите деньги на «безопасный счёт»",
      uz: "«Xavfsiz hisob»ga pul o'tkazmang",
      en: "Do not transfer money to a 'safe account'",
    },
  },
  // Pressure/urgency reasons → hang up calmly
  {
    reasons: new Set<ReasonCode>([
      "uses_urgency",
      "threatens_legal_action",
      "asks_not_to_hang_up",
      "threatens_account_block",
    ]),
    advice: {
      ru: "Спокойно положите трубку — давление это признак обмана",
      uz: "Xotirjam go'shakni qo'ying — bosim aldov belgisi",
      en: "Calmly hang up — pressure is a sign of fraud",
    },
  },
  // Impersonation reasons → call back on official number
  {
    reasons: new Set<ReasonCode>([
      "impersonates_bank",
      "impersonates_operator",
      "impersonates_official",
      "telegram_bank_contact",
      "fake_boss_request",
      "brand_name_typo",
      "brand_impersonation",
    ]),
    advice: {
      ru: "Перезвоните в организацию по официальному номеру",
      uz: "Tashkilotga rasmiy raqami orqali qo'ng'iroq qiling",
      en: "Call the organization back on the official number",
    },
  },
];

const ADVICE_PRIORITY = [0, 1, 2, 4, 3] as const;

// ── Non-actionable context codes ────────────────────────────────────────────
// These codes can be useful as observations, but they do not justify generic
// warnings by themselves. The formatter can still add a contextual prompt.

const TOPIC_ONLY_REASONS: Set<string> = new Set([
  "unknown_sender",
  "new_telegram_account",
  "hosted_app_platform",
  "valid_uz_phone",
  "non_uz_phone",
]);

// ── Main filter function ────────────────────────────────────────────────────

/**
 * Returns context-aware advice strings based on detected risk level and reason codes.
 *
 * - safe + no reasons → empty array
 * - unknown + only topic-only codes → single context message
 * - otherwise: maps reasons to advice categories, deduplicates, limits to 3
 */
export function filterAdvice(level: RiskLevel, reasons: string[], lang: Lang): string[] {
  // Safe with no reasons → nothing to advise
  if (level === "safe" && reasons.length === 0) {
    return [];
  }

  // Unknown with only non-actionable context codes → no generic advice.
  if (level === "unknown" && reasons.length > 0) {
    const allTopicOnly = reasons.every((r) => TOPIC_ONLY_REASONS.has(r));
    if (allTopicOnly) {
      return [];
    }
  }

  // Unknown with no reasons at all → empty (not enough data, no specific advice)
  if (level === "unknown" && reasons.length === 0) {
    return [];
  }

  // Map reasons to advice categories, preserving category order
  const matched = new Set<number>();

  for (const reason of reasons) {
    for (let i = 0; i < REASON_ADVICE_MAP.length; i++) {
      if (REASON_ADVICE_MAP[i].reasons.has(reason as ReasonCode)) {
        matched.add(i);
      }
    }
  }

  // Collect advice strings in category order (deduplication is inherent)
  const result: string[] = [];
  for (const idx of ADVICE_PRIORITY) {
    if (!matched.has(idx)) continue;
    result.push(REASON_ADVICE_MAP[idx].advice[lang]);
    if (result.length >= 3) break;
  }

  return result;
}
