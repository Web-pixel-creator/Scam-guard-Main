import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { REASON_LABELS, type ReasonCode } from "@/lib/risk/rules";

export type InlineEvidenceMethod =
  | "text_pattern"
  | "url_structure"
  | "domain_comparison"
  | "phone_format"
  | "telegram_visible"
  | "official_directory"
  | "local_reports"
  | "external_reputation"
  | "context";

export type InlineEvidenceLimitation =
  | "signal_not_proof"
  | "format_only"
  | "telegram_visible_only"
  | "official_identifier_only"
  | "report_scope"
  | "external_scope"
  | "context_only";

export interface InlineReasonPolicy {
  priority: number;
  evidence: InlineEvidenceMethod;
  limitation: InlineEvidenceLimitation;
}

/**
 * Lower priority numbers win. Every ReasonCode is deliberately classified so a
 * new detector cannot silently inherit a generic Inline explanation or array
 * order.
 */
export const INLINE_REASON_POLICY: Record<ReasonCode, InlineReasonPolicy> = {
  asks_for_otp: { priority: 10, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_for_sms_code: { priority: 10, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_for_card_cvv: { priority: 10, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_for_pin: { priority: 10, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_to_install_apk: { priority: 12, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_to_share_screen: { priority: 12, evidence: "text_pattern", limitation: "signal_not_proof" },
  asks_to_transfer_to_safe_account: {
    priority: 10,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  impersonates_bank: { priority: 25, evidence: "text_pattern", limitation: "signal_not_proof" },
  impersonates_operator: {
    priority: 25,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  uses_urgency: { priority: 55, evidence: "text_pattern", limitation: "signal_not_proof" },
  threatens_legal_action: {
    priority: 35,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  asks_not_to_hang_up: { priority: 35, evidence: "text_pattern", limitation: "signal_not_proof" },
  telegram_bank_contact: {
    priority: 30,
    evidence: "telegram_visible",
    limitation: "telegram_visible_only",
  },
  fake_loan_offer: { priority: 40, evidence: "text_pattern", limitation: "signal_not_proof" },
  suspicious_short_link: {
    priority: 45,
    evidence: "url_structure",
    limitation: "format_only",
  },
  apk_download_link: { priority: 12, evidence: "url_structure", limitation: "format_only" },
  unknown_sender: { priority: 85, evidence: "context", limitation: "context_only" },
  new_telegram_account: {
    priority: 75,
    evidence: "telegram_visible",
    limitation: "telegram_visible_only",
  },
  weird_domain: { priority: 35, evidence: "url_structure", limitation: "format_only" },
  brand_name_typo: { priority: 30, evidence: "domain_comparison", limitation: "format_only" },
  payment_before_service: {
    priority: 40,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  too_good_to_be_true: { priority: 50, evidence: "text_pattern", limitation: "signal_not_proof" },
  requests_personal_data: {
    priority: 20,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  non_uz_phone: { priority: 80, evidence: "phone_format", limitation: "format_only" },
  valid_uz_phone: { priority: 95, evidence: "phone_format", limitation: "context_only" },
  verified_official: {
    priority: 90,
    evidence: "official_directory",
    limitation: "official_identifier_only",
  },
  known_reported: { priority: 5, evidence: "local_reports", limitation: "report_scope" },
  asks_to_scan_qr: { priority: 18, evidence: "text_pattern", limitation: "signal_not_proof" },
  relative_in_distress: { priority: 20, evidence: "text_pattern", limitation: "signal_not_proof" },
  requests_card_digits: {
    priority: 10,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  threatens_account_block: {
    priority: 30,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  fake_delivery_payment: {
    priority: 25,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  fake_boss_request: { priority: 25, evidence: "text_pattern", limitation: "signal_not_proof" },
  malicious_file_bait: { priority: 15, evidence: "text_pattern", limitation: "signal_not_proof" },
  impersonates_official: {
    priority: 25,
    evidence: "telegram_visible",
    limitation: "telegram_visible_only",
  },
  suspicious_invite_link: {
    priority: 35,
    evidence: "telegram_visible",
    limitation: "telegram_visible_only",
  },
  gambling_prediction_promo: {
    priority: 50,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  giveaway_engagement_bait: {
    priority: 50,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  crypto_casino_bonus_funnel: {
    priority: 35,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  fake_captcha_or_voting: {
    priority: 25,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  task_reward_engagement_bait: {
    priority: 35,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  wallet_action_urgency: {
    priority: 12,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  ton_referral_earning_scheme: {
    priority: 40,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  investment_fast_profit_pitch: {
    priority: 25,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  romance_investment_pivot: {
    priority: 20,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  oneid_government_phishing: {
    priority: 10,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  sim_swap_or_number_transfer: {
    priority: 15,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  money_mule_recruitment: {
    priority: 10,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  advance_fee_prize_inheritance: {
    priority: 20,
    evidence: "text_pattern",
    limitation: "signal_not_proof",
  },
  external_phishing_url: {
    priority: 4,
    evidence: "external_reputation",
    limitation: "external_scope",
  },
  external_malware_url: {
    priority: 3,
    evidence: "external_reputation",
    limitation: "external_scope",
  },
  hosted_app_platform: { priority: 99, evidence: "context", limitation: "context_only" },
  brand_impersonation: {
    priority: 15,
    evidence: "domain_comparison",
    limitation: "format_only",
  },
  telegram_account_takeover_phishing: {
    priority: 10,
    evidence: "telegram_visible",
    limitation: "telegram_visible_only",
  },
  dropper_recruitment: { priority: 10, evidence: "text_pattern", limitation: "signal_not_proof" },
};

const EVIDENCE_COPY: Record<InlineEvidenceMethod, Record<Lang, string>> = {
  text_pattern: {
    ru: "Основание: в присланном тексте прямо есть такая просьба или типичный признак этой схемы.",
    uz: "Asos: yuborilgan matnda shunday so'rov yoki ushbu sxemaga xos belgi bor.",
    en: "Basis: the submitted text directly contains this request or a typical sign of this scheme.",
  },
  url_structure: {
    ru: "Основание: проверены видимые структура, формат и назначение ссылки.",
    uz: "Asos: havolaning ko'rinadigan tuzilishi, formati va maqsadi tekshirildi.",
    en: "Basis: the visible URL structure, format and destination were checked.",
  },
  domain_comparison: {
    ru: "Основание: написание и структура домена сравнены с известными вариантами брендов.",
    uz: "Asos: domen yozilishi va tuzilishi ma'lum brend variantlari bilan solishtirildi.",
    en: "Basis: the domain spelling and structure were compared with known brand variants.",
  },
  phone_format: {
    ru: "Основание: проверены формат номера и доступные локальные сигналы.",
    uz: "Asos: raqam formati va mavjud mahalliy signallar tekshirildi.",
    en: "Basis: the phone format and available local signals were checked.",
  },
  telegram_visible: {
    ru: "Основание: проверены только видимые признаки Telegram-ссылки, username или текста.",
    uz: "Asos: faqat Telegram havolasi, username yoki matnning ko'rinadigan belgilari tekshirildi.",
    en: "Basis: only visible Telegram link, username or message signals were checked.",
  },
  official_directory: {
    ru: "Основание: видимый идентификатор точно совпал с записью проверенного официального справочника.",
    uz: "Asos: ko'rinadigan identifikator tekshirilgan rasmiy katalogdagi yozuvga aniq mos keldi.",
    en: "Basis: the visible identifier is an exact match in the verified official directory.",
  },
  local_reports: {
    ru: "Основание: по этому идентификатору есть подтверждённые модерацией жалобы Ishonch Guard.",
    uz: "Asos: bu identifikator bo'yicha Ishonch Guard moderatsiyasi tasdiqlagan shikoyatlar bor.",
    en: "Basis: this identifier has Ishonch Guard reports confirmed by moderation.",
  },
  external_reputation: {
    ru: "Основание: настроенный внешний источник репутации отметил эту ссылку как опасную.",
    uz: "Asos: sozlangan tashqi reputatsiya manbasi bu havolani xavfli deb belgiladi.",
    en: "Basis: a configured external reputation source flagged this URL as dangerous.",
  },
  context: {
    ru: "Основание: это контекстный признак, полученный из видимого формата переданных данных.",
    uz: "Asos: bu yuborilgan ma'lumotning ko'rinadigan formatidan olingan kontekst belgisi.",
    en: "Basis: this is a context signal derived from the visible submitted format.",
  },
};

const REASON_EVIDENCE_COPY: Partial<Record<ReasonCode, Record<Lang, string>>> = {
  weird_domain: {
    ru: "Основание: в адресе видно необычное доменное окончание, IP-адрес вместо имени или ошибка формата ссылки.",
    uz: "Asos: manzilda noodatiy domen oxiri, nom o'rniga IP yoki havola formatida xato ko'rindi.",
    en: "Basis: the address has an unusual domain ending, an IP instead of a name, or an invalid link format.",
  },
  oneid_government_phishing: {
    ru: "Основание: в видимом тексте OneID или госуслуги упомянуты вместе с просьбой войти, подтвердить данные, обновить заявку, назвать код или пароль.",
    uz: "Asos: ko'rinadigan matnda OneID yoki davlat xizmati kirish, ma'lumotni tasdiqlash, arizani yangilash, kod yoki parolni aytish so'rovi bilan birga kelgan.",
    en: "Basis: the visible text combines OneID or a government service with a request to sign in, confirm data, update an application, or provide a code or password.",
  },
};

const LIMITATION_COPY: Record<InlineEvidenceLimitation, Record<Lang, string>> = {
  signal_not_proof: {
    ru: "Это повышает риск, но само по себе не доказывает мошенничество или личность отправителя.",
    uz: "Bu xavfni oshiradi, ammo o'zi firibgarlikni yoki yuboruvchi shaxsini isbotlamaydi.",
    en: "This raises risk but does not by itself prove fraud or the sender's identity.",
  },
  format_only: {
    ru: "Структура и написание сами по себе не доказывают владельца, безопасность или вредоносность.",
    uz: "Tuzilish va yozilishning o'zi egani, xavfsizlikni yoki zararli ekanini isbotlamaydi.",
    en: "Structure and spelling alone do not prove ownership, safety or maliciousness.",
  },
  telegram_visible_only: {
    ru: "Бот не видит скрытый возраст аккаунта, историю жалоб Telegram, спам-метки или личность владельца.",
    uz: "Bot yashirin akkaunt yoshi, Telegram shikoyat tarixi, spam belgisi yoki egasining shaxsini ko'rmaydi.",
    en: "The bot cannot see hidden account age, Telegram report history, spam labels or owner identity.",
  },
  official_identifier_only: {
    ru: "Совпадение относится только к этому идентификатору; окружающее сообщение или ссылка проверяются отдельно.",
    uz: "Moslik faqat shu identifikatorga tegishli; atrofdagi xabar yoki havola alohida tekshiriladi.",
    en: "The match covers only that exact identifier; the surrounding message or link is evaluated separately.",
  },
  report_scope: {
    ru: "Жалобы относятся к идентификатору и не заменяют проверку автора и текущего контекста.",
    uz: "Shikoyatlar identifikatorga tegishli va muallif hamda joriy kontekst tekshiruvini almashtirmaydi.",
    en: "Reports apply to the identifier and do not replace checking the author and current context.",
  },
  external_scope: {
    ru: "Метка источника не подтверждает личность отправителя и не является полным анализом всей страницы.",
    uz: "Manba belgisi yuboruvchi shaxsini tasdiqlamaydi va butun sahifaning to'liq tahlili emas.",
    en: "The source flag does not verify the sender and is not a complete analysis of the whole page.",
  },
  context_only: {
    ru: "Это информационный контекст: он не делает остальные части сообщения безопасными или опасными.",
    uz: "Bu axborot konteksti: u xabarning boshqa qismlarini xavfsiz yoki xavfli qilib qo'ymaydi.",
    en: "This is informational context; it does not make the rest of the message safe or dangerous.",
  },
};

export interface PresentedInlineReason {
  reason: ReasonCode;
  evidence: string;
  limitation: string;
  text: string;
}

export function rankInlineReasonCodes(reasons: readonly ReasonCode[]): ReasonCode[] {
  return [...new Set(reasons)].sort((left, right) => {
    const priorityDifference =
      INLINE_REASON_POLICY[left].priority - INLINE_REASON_POLICY[right].priority;
    if (priorityDifference !== 0) return priorityDifference;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

export type PresentationReasonResult = Pick<
  RunCheckResult,
  "reasons" | "verifiedContact" | "knownReports" | "phoneReputation"
>;

/**
 * Produces the one canonical, ranked reason set used by user-facing result
 * explanations. Result metadata is evidence too: an official-directory match
 * or moderated phone reports must not disappear merely because the scoring
 * reason array did not need an extra code.
 */
export function collectResultReasonCodesForPresentation(
  result: PresentationReasonResult,
): ReasonCode[] {
  const candidates = result.reasons.filter((reason) => Object.hasOwn(INLINE_REASON_POLICY, reason));

  if (result.verifiedContact && !candidates.includes("verified_official")) {
    candidates.push("verified_official");
  }
  if (
    (result.phoneReputation || result.knownReports > 0) &&
    !candidates.includes("known_reported")
  ) {
    candidates.push("known_reported");
  }

  const nonPlatformReasons = candidates.filter((reason) => reason !== "hosted_app_platform");
  return rankInlineReasonCodes(nonPlatformReasons.length > 0 ? nonPlatformReasons : candidates);
}

export function presentInlineReason(
  reasons: readonly ReasonCode[],
  lang: Lang,
): PresentedInlineReason | null {
  const selected = rankInlineReasonCodes(reasons)[0] ?? null;

  if (!selected) return null;

  const policy = INLINE_REASON_POLICY[selected];
  const evidenceCopy =
    REASON_EVIDENCE_COPY[selected]?.[lang] ?? EVIDENCE_COPY[policy.evidence][lang];
  const evidence = `${REASON_LABELS[selected][lang]}. ${evidenceCopy}`;
  const limitation = LIMITATION_COPY[policy.limitation][lang];

  return {
    reason: selected,
    evidence,
    limitation,
    text: `${evidence} ${limitation}`,
  };
}
