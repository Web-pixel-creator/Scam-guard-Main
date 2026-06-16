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
  // Telegram account takeover phishing -> check sessions, don't press "cancel"
  {
    reasons: new Set<ReasonCode>(["telegram_account_takeover_phishing"]),
    advice: {
      ru: "Не нажимайте «Отмена» и не вводите код — проверьте Telegram → Устройства вручную",
      uz: "«Bekor qilish»ni bosmang va kod kiritmang — Telegram → Qurilmalarni qo'lda tekshiring",
      en: "Do not press “Cancel” or enter codes — check Telegram → Devices manually",
    },
  },
  // Dropper recruitment -> never hand over financial/identity access
  {
    reasons: new Set<ReasonCode>(["dropper_recruitment"]),
    advice: {
      ru: "Не передавайте карту, SIM, аккаунт или OneID третьим лицам",
      uz: "Karta, SIM, akkaunt yoki OneID'ni boshqa odamga bermang",
      en: "Do not hand over your card, SIM, account, or OneID to anyone else",
    },
  },
  // Casino/free-spins promos -> avoid deposit and payment funnels.
  {
    reasons: new Set<ReasonCode>(["crypto_casino_bonus_funnel"]),
    advice: {
      ru: "Не пополняйте баланс и не вводите карту/кошелёк по промо-ссылке с фриспинами или бонусом",
      uz: "Frispin yoki bonus havolasi orqali balans to‘ldirmang, karta/hamyon kiritmang",
      en: "Do not top up a balance or enter card/wallet details through a free-spins or bonus promo link",
    },
  },
  // Betting/prediction promos -> do not pay for closed-channel access or "guaranteed" wins
  {
    reasons: new Set<ReasonCode>(["gambling_prediction_promo"]),
    advice: {
      ru: "Не платите за «прогноз», доступ в закрытый канал или гарантированный выигрыш",
      uz: "«Prognoz», yopiq kanal yoki kafolatlangan yutuq uchun pul to'lamang",
      en: "Do not pay for a “prediction”, closed-channel access, or a guaranteed win",
    },
  },
  // Giveaway / NFT engagement bait -> avoid captcha/vote/wallet traps
  {
    reasons: new Set<ReasonCode>(["giveaway_engagement_bait", "fake_captcha_or_voting"]),
    advice: {
      ru: "Не проходите капчу, голосование, бота или спин ради NFT/Stars/подарка, если дальше просят код, карту или кошелёк",
      uz: "NFT/Stars/sovrin uchun captcha, ovoz, bot yoki spin qilmang, agar keyin kod/karta/hamyon so‘ralsa",
      en: "Do not complete captcha, voting, bot, or spin steps for NFT/Stars/gifts if the next step asks for a code, card, or wallet",
    },
  },
  // Task/reward/referral bait -> avoid engagement loops and referral pressure.
  {
    reasons: new Set<ReasonCode>(["task_reward_engagement_bait", "ton_referral_earning_scheme"]),
    advice: {
      ru: "Не выполняйте цепочку заданий/рефералов ради обещанного TON, Stars, токенов или лёгкого заработка",
      uz: "TON, Stars, token yoki oson pul va’dasi uchun topshiriq/referral zanjiriga kirmang",
      en: "Do not enter task/referral chains for promised TON, Stars, tokens, or easy earnings",
    },
  },
  // Investment fast-profit pitches -> avoid deposit/signal/withdrawal-fee funnels.
  {
    reasons: new Set<ReasonCode>(["investment_fast_profit_pitch"]),
    advice: {
      ru: "Не вносите депозит и не платите за сигналы, пока не проверены лицензия, договор и официальный сайт",
      uz: "Litsenziya, shartnoma va rasmiy sayt tekshirilmaguncha depozit kiritmang va signal uchun to'lamang",
      en: "Do not deposit or pay for signals until the license, contract, and official site are verified",
    },
  },
  // Wallet / DeFi urgency -> avoid signing/seed phrase traps
  {
    reasons: new Set<ReasonCode>(["wallet_action_urgency"]),
    advice: {
      ru: "Не подключайте кошелёк, не подписывайте транзакции и не вводите seed phrase по срочной ссылке",
      uz: "Shoshilinch havola orqali hamyon ulamang, tranzaksiya imzolamang va seed phrase kiritmang",
      en: "Do not connect a wallet, sign transactions, or enter a seed phrase through an urgent link",
    },
  },
  // Private invite links -> avoid joining/paying without context
  {
    reasons: new Set<ReasonCode>(["suspicious_invite_link"]),
    advice: {
      ru: "Не вводите данные карты или Telegram-код после перехода по invite-ссылке",
      uz: "Invite havolasidan keyin karta ma'lumotlari yoki Telegram kodini kiritmang",
      en: "Do not enter card details or a Telegram code after following an invite link",
    },
  },
  // QR login/payment traps -> do not scan codes sent by another person.
  {
    reasons: new Set<ReasonCode>(["asks_to_scan_qr"]),
    advice: {
      ru: "Не сканируйте QR для входа, подключения устройства или оплаты, если его прислал другой человек",
      uz: "Boshqa odam yuborgan QR orqali login, qurilma ulash yoki to'lov qilmang",
      en: "Do not scan QR codes for login, device linking, or payment if someone else sent them",
    },
  },
];

const ADVICE_PRIORITY = [14, 5, 6, 7, 8, 9, 10, 11, 13, 12, 0, 1, 2, 4, 3] as const;

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
