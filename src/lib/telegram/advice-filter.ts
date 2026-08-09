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

export type ProtectiveActionId =
  | "protect_secrets"
  | "protect_card_details"
  | "avoid_link_or_apk"
  | "avoid_transfer"
  | "end_pressure_call"
  | "verify_official_channel"
  | "secure_telegram_account"
  | "protect_identity_access"
  | "avoid_casino_deposit"
  | "avoid_betting_payment"
  | "avoid_giveaway_trap"
  | "avoid_reward_chain"
  | "verify_investment"
  | "avoid_wallet_action"
  | "avoid_invite_credentials"
  | "verify_delivery_payment"
  | "avoid_qr"
  | "stop_reported_contact"
  | "protect_personal_data";

/**
 * Exhaustive protective-action policy for every deterministic ReasonCode.
 * `null` is intentional only for context/protective signals that cannot make a
 * result high-risk by themselves. A new ReasonCode is a compile-time error
 * until its user action is selected explicitly.
 */
export const REASON_PROTECTIVE_ACTION: Record<ReasonCode, ProtectiveActionId | null> = {
  asks_for_otp: "protect_secrets",
  asks_for_sms_code: "protect_secrets",
  asks_for_card_cvv: "protect_card_details",
  asks_for_pin: "protect_secrets",
  asks_to_install_apk: "avoid_link_or_apk",
  asks_to_share_screen: "avoid_link_or_apk",
  asks_to_transfer_to_safe_account: "avoid_transfer",
  impersonates_bank: "verify_official_channel",
  impersonates_operator: "verify_official_channel",
  uses_urgency: "end_pressure_call",
  threatens_legal_action: "end_pressure_call",
  asks_not_to_hang_up: "end_pressure_call",
  telegram_bank_contact: "verify_official_channel",
  fake_loan_offer: "avoid_transfer",
  suspicious_short_link: "avoid_link_or_apk",
  apk_download_link: "avoid_link_or_apk",
  unknown_sender: null,
  new_telegram_account: null,
  weird_domain: "avoid_link_or_apk",
  brand_name_typo: "verify_official_channel",
  payment_before_service: "avoid_transfer",
  too_good_to_be_true: "avoid_transfer",
  requests_personal_data: "protect_personal_data",
  non_uz_phone: null,
  valid_uz_phone: null,
  verified_official: null,
  known_reported: "stop_reported_contact",
  asks_to_scan_qr: "avoid_qr",
  relative_in_distress: "avoid_transfer",
  requests_card_digits: "protect_card_details",
  threatens_account_block: "end_pressure_call",
  fake_delivery_payment: "verify_delivery_payment",
  fake_boss_request: "verify_official_channel",
  malicious_file_bait: "avoid_link_or_apk",
  impersonates_official: "verify_official_channel",
  suspicious_invite_link: "avoid_invite_credentials",
  gambling_prediction_promo: "avoid_betting_payment",
  giveaway_engagement_bait: "avoid_giveaway_trap",
  crypto_casino_bonus_funnel: "avoid_casino_deposit",
  fake_captcha_or_voting: "avoid_giveaway_trap",
  task_reward_engagement_bait: "avoid_reward_chain",
  unauthorized_credit_opened: "verify_official_channel",
  coercive_secrecy: "end_pressure_call",
  wallet_action_urgency: "avoid_wallet_action",
  ton_referral_earning_scheme: "avoid_reward_chain",
  investment_fast_profit_pitch: "verify_investment",
  romance_investment_pivot: "verify_investment",
  oneid_government_phishing: "verify_official_channel",
  sim_swap_or_number_transfer: "protect_secrets",
  money_mule_recruitment: "avoid_transfer",
  advance_fee_prize_inheritance: "avoid_transfer",
  external_phishing_url: "avoid_link_or_apk",
  external_malware_url: "avoid_link_or_apk",
  hosted_app_platform: null,
  brand_impersonation: "verify_official_channel",
  telegram_account_takeover_phishing: "secure_telegram_account",
  dropper_recruitment: "protect_identity_access",
};

interface AdviceCategory {
  id: ProtectiveActionId;
  advice: AdviceEntry;
}

const REASON_ADVICE_MAP: AdviceCategory[] = [
  // OTP/code reasons → don't share codes
  {
    id: "protect_secrets",
    advice: {
      ru: "Не сообщайте SMS-код или PIN",
      uz: "SMS-kod yoki PIN-ni aytmang",
      en: "Do not share your SMS code or PIN",
    },
  },
  // Card-data reasons → do not share CVV/CVC, card numbers, or other details.
  {
    id: "protect_card_details",
    advice: {
      ru: "Не сообщайте CVV/CVC, номер и другие данные карты",
      uz: "CVV/CVC, karta raqami yoki boshqa karta ma'lumotlarini aytmang",
      en: "Do not share CVV/CVC, card numbers, or other card details",
    },
  },
  // Link/APK reasons → don't click or install
  {
    id: "avoid_link_or_apk",
    advice: {
      ru: "Не переходите по ссылке и не устанавливайте APK",
      uz: "Havolaga o'tmang va APK o'rnatmang",
      en: "Do not click the link or install the APK",
    },
  },
  // Money transfer reasons → don't send money
  {
    id: "avoid_transfer",
    advice: {
      ru: "Не переводите деньги на «безопасный счёт»",
      uz: "«Xavfsiz hisob»ga pul o'tkazmang",
      en: "Do not transfer money to a 'safe account'",
    },
  },
  // Pressure/urgency reasons → hang up calmly
  {
    id: "end_pressure_call",
    advice: {
      ru: "Спокойно положите трубку — давление это признак обмана",
      uz: "Xotirjam go'shakni qo'ying — bosim aldov belgisi",
      en: "Calmly hang up — pressure is a sign of fraud",
    },
  },
  // Impersonation reasons → call back on official number
  {
    id: "verify_official_channel",
    advice: {
      ru: "Перезвоните в организацию по официальному номеру",
      uz: "Tashkilotga rasmiy raqami orqali qo'ng'iroq qiling",
      en: "Call the organization back on the official number",
    },
  },
  // Telegram account takeover phishing -> check sessions, don't press "cancel"
  {
    id: "secure_telegram_account",
    advice: {
      ru: "Не нажимайте «Отмена» и не вводите код — проверьте Telegram → Устройства вручную",
      uz: "«Bekor qilish»ni bosmang va kod kiritmang — Telegram → Qurilmalarni qo'lda tekshiring",
      en: "Do not press “Cancel” or enter codes — check Telegram → Devices manually",
    },
  },
  // Dropper recruitment -> never hand over financial/identity access
  {
    id: "protect_identity_access",
    advice: {
      ru: "Не передавайте карту, SIM, аккаунт или OneID третьим лицам",
      uz: "Karta, SIM, akkaunt yoki OneID'ni boshqa odamga bermang",
      en: "Do not hand over your card, SIM, account, or OneID to anyone else",
    },
  },
  // Casino/free-spins promos -> avoid deposit and payment funnels.
  {
    id: "avoid_casino_deposit",
    advice: {
      ru: "Не пополняйте баланс и не вводите карту/кошелёк по промо-ссылке с фриспинами или бонусом",
      uz: "Frispin yoki bonus havolasi orqali balans to‘ldirmang, karta/hamyon kiritmang",
      en: "Do not top up a balance or enter card/wallet details through a free-spins or bonus promo link",
    },
  },
  // Betting/prediction promos -> do not pay for closed-channel access or "guaranteed" wins
  {
    id: "avoid_betting_payment",
    advice: {
      ru: "Не платите за «прогноз», доступ в закрытый канал или гарантированный выигрыш",
      uz: "«Prognoz», yopiq kanal yoki kafolatlangan yutuq uchun pul to'lamang",
      en: "Do not pay for a “prediction”, closed-channel access, or a guaranteed win",
    },
  },
  // Giveaway / NFT engagement bait -> avoid captcha/vote/wallet traps
  {
    id: "avoid_giveaway_trap",
    advice: {
      ru: "Не проходите капчу, голосование, бота или спин ради NFT/Stars/подарка, если дальше просят код, карту или кошелёк",
      uz: "NFT/Stars/sovrin uchun captcha, ovoz, bot yoki spin qilmang, agar keyin kod/karta/hamyon so‘ralsa",
      en: "Avoid NFT/Stars/gift captcha, voting, bot, or spin steps if they lead to a code, card, or wallet request",
    },
  },
  // Task/reward/referral bait -> avoid engagement loops and referral pressure.
  {
    id: "avoid_reward_chain",
    advice: {
      ru: "Не выполняйте цепочку заданий/рефералов ради обещанного TON, Stars, токенов или лёгкого заработка",
      uz: "TON, Stars, token yoki oson pul va’dasi uchun topshiriq/referral zanjiriga kirmang",
      en: "Do not enter task/referral chains for promised TON, Stars, tokens, or easy earnings",
    },
  },
  // Investment fast-profit pitches -> avoid deposit/signal/withdrawal-fee funnels.
  {
    id: "verify_investment",
    advice: {
      ru: "Не вносите депозит и не платите за сигналы, пока не проверены лицензия, договор и официальный сайт",
      uz: "Litsenziya, shartnoma va rasmiy sayt tekshirilmaguncha depozit kiritmang va signal uchun to'lamang",
      en: "Do not deposit or pay for signals until the license, contract, and official site are verified",
    },
  },
  // Wallet / DeFi urgency -> avoid signing/seed phrase traps
  {
    id: "avoid_wallet_action",
    advice: {
      ru: "Не подключайте кошелёк, не подписывайте транзакции и не вводите seed phrase по срочной ссылке",
      uz: "Shoshilinch havola orqali hamyon ulamang, tranzaksiya imzolamang va seed phrase kiritmang",
      en: "Do not connect a wallet, sign transactions, or enter a seed phrase through an urgent link",
    },
  },
  // Private invite links -> avoid joining/paying without context
  {
    id: "avoid_invite_credentials",
    advice: {
      ru: "Не вводите данные карты или Telegram-код после перехода по invite-ссылке",
      uz: "Invite havolasidan keyin karta ma'lumotlari yoki Telegram kodini kiritmang",
      en: "Do not enter card details or a Telegram code after following an invite link",
    },
  },
  // Fake delivery/payment links -> verify through the official service first.
  {
    id: "verify_delivery_payment",
    advice: {
      ru: "Не оплачивайте доставку по ссылке из чата — откройте сервис вручную через официальное приложение или сайт",
      uz: "Yetkazib berishni chat havolasi orqali to'lamang — xizmatni rasmiy ilova yoki sayt orqali qo'lda oching",
      en: "Do not pay for delivery through a chat link — open the service manually in the official app or website",
    },
  },
  // QR login/payment traps -> do not scan codes sent by another person.
  {
    id: "avoid_qr",
    advice: {
      ru: "Не сканируйте QR для входа, подключения устройства или оплаты, если его прислал другой человек",
      uz: "Boshqa odam yuborgan QR orqali login, qurilma ulash yoki to'lov qilmang",
      en: "Do not scan QR codes for login, device linking, or payment if someone else sent them",
    },
  },
  // Confirmed local reports -> stop interaction and independently verify.
  {
    id: "stop_reported_contact",
    advice: {
      ru: "Прекратите контакт: не платите и не сообщайте коды; проверьте организацию через официальный канал",
      uz: "Muloqotni to'xtating: pul yoki kod bermang; tashkilotni rasmiy kanal orqali tekshiring",
      en: "Stop the interaction: do not pay or share codes; verify the organization through an official channel",
    },
  },
  // Personal data requests -> do not send identity documents or details.
  {
    id: "protect_personal_data",
    advice: {
      ru: "Не отправляйте паспорт, фото документов или другие персональные данные",
      uz: "Pasport, hujjat fotosi yoki boshqa shaxsiy ma'lumotlarni yubormang",
      en: "Do not send a passport, document photos, or other personal data",
    },
  },
];

const ADVICE_PRIORITY = [
  "stop_reported_contact",
  "avoid_qr",
  "secure_telegram_account",
  "protect_identity_access",
  "avoid_casino_deposit",
  "avoid_betting_payment",
  "verify_delivery_payment",
  "avoid_giveaway_trap",
  "avoid_reward_chain",
  "verify_investment",
  "avoid_invite_credentials",
  "avoid_wallet_action",
  "protect_secrets",
  "protect_card_details",
  "protect_personal_data",
  "avoid_link_or_apk",
  "avoid_transfer",
  "verify_official_channel",
  "end_pressure_call",
] as const satisfies readonly ProtectiveActionId[];

const ADVICE_BY_ACTION = Object.fromEntries(
  REASON_ADVICE_MAP.map((category) => [category.id, category.advice]),
) as Record<ProtectiveActionId, AdviceEntry>;

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

  // Resolve the exhaustive typed policy, then preserve action priority.
  const matched = new Set<ProtectiveActionId>();

  for (const reason of reasons) {
    const action = REASON_PROTECTIVE_ACTION[reason as ReasonCode];
    if (action) matched.add(action);
  }

  // Collect advice strings in category order (deduplication is inherent)
  const result: string[] = [];
  for (const action of ADVICE_PRIORITY) {
    if (!matched.has(action)) continue;
    result.push(ADVICE_BY_ACTION[action][lang]);
    if (result.length >= 3) break;
  }

  return result;
}
