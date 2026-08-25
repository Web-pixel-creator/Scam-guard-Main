import type { InputType } from "./detect";
import { uzbekLatinMatchingVariant } from "./uz-cyrillic-translit";
import type { Database } from "@/integrations/supabase/types";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

export type RiskLevel = Database["public"]["Enums"]["risk_level"];

export type ReasonCode =
  | "asks_for_otp"
  | "asks_for_sms_code"
  | "asks_for_card_cvv"
  | "asks_for_pin"
  | "asks_to_install_apk"
  | "asks_to_share_screen"
  | "asks_for_money_transfer"
  | "asks_to_transfer_to_safe_account"
  | "impersonates_bank"
  | "impersonates_operator"
  | "uses_urgency"
  | "threatens_legal_action"
  | "asks_not_to_hang_up"
  | "telegram_bank_contact"
  | "fake_loan_offer"
  | "suspicious_short_link"
  | "apk_download_link"
  | "unknown_sender"
  | "new_telegram_account"
  | "weird_domain"
  | "brand_name_typo"
  | "payment_before_service"
  | "too_good_to_be_true"
  | "requests_personal_data"
  | "non_uz_phone"
  | "valid_uz_phone"
  | "verified_official"
  | "known_reported"
  | "asks_to_scan_qr"
  | "relative_in_distress"
  | "requests_card_digits"
  | "threatens_account_block"
  | "fake_delivery_payment"
  | "fake_boss_request"
  | "malicious_file_bait"
  | "impersonates_official"
  | "suspicious_invite_link"
  | "gambling_prediction_promo"
  | "giveaway_engagement_bait"
  | "crypto_casino_bonus_funnel"
  | "fake_captcha_or_voting"
  | "task_reward_engagement_bait"
  | "unauthorized_credit_opened"
  | "coercive_secrecy"
  | "wallet_action_urgency"
  | "ton_referral_earning_scheme"
  | "investment_fast_profit_pitch"
  | "romance_investment_pivot"
  | "oneid_government_phishing"
  | "sim_swap_or_number_transfer"
  | "money_mule_recruitment"
  | "advance_fee_prize_inheritance"
  | "external_phishing_url"
  | "external_malware_url"
  | "hosted_app_platform"
  | "brand_impersonation"
  | "telegram_account_takeover_phishing"
  | "dropper_recruitment"
  | "authority_coerced_dangerous_act"
  | "fake_penalty_points_erasure"
  | "threatens_physical_violence";

const WEIGHTS: Record<ReasonCode, number> = {
  asks_for_otp: 45,
  asks_for_sms_code: 45,
  asks_for_card_cvv: 45,
  asks_for_pin: 45,
  asks_to_install_apk: 45,
  asks_to_share_screen: 35,
  asks_for_money_transfer: 40,
  asks_to_transfer_to_safe_account: 40,
  impersonates_bank: 30,
  impersonates_operator: 25,
  uses_urgency: 15,
  threatens_legal_action: 20,
  asks_not_to_hang_up: 20,
  telegram_bank_contact: 25,
  fake_loan_offer: 25,
  suspicious_short_link: 30,
  apk_download_link: 45,
  unknown_sender: 5,
  new_telegram_account: 10,
  weird_domain: 25,
  brand_name_typo: 20,
  payment_before_service: 20,
  too_good_to_be_true: 15,
  requests_personal_data: 20,
  non_uz_phone: 5,
  valid_uz_phone: 0,
  verified_official: 0,
  known_reported: 50,
  asks_to_scan_qr: 50,
  relative_in_distress: 30,
  requests_card_digits: 45,
  threatens_account_block: 20,
  fake_delivery_payment: 35,
  fake_boss_request: 30,
  malicious_file_bait: 35,
  impersonates_official: 35,
  suspicious_invite_link: 25,
  gambling_prediction_promo: 20,
  giveaway_engagement_bait: 20,
  crypto_casino_bonus_funnel: 25,
  fake_captcha_or_voting: 30,
  task_reward_engagement_bait: 20,
  unauthorized_credit_opened: 40,
  coercive_secrecy: 30,
  wallet_action_urgency: 30,
  ton_referral_earning_scheme: 20,
  investment_fast_profit_pitch: 25,
  romance_investment_pivot: 30,
  oneid_government_phishing: 40,
  sim_swap_or_number_transfer: 35,
  money_mule_recruitment: 35,
  advance_fee_prize_inheritance: 30,
  external_phishing_url: 70,
  external_malware_url: 70,
  hosted_app_platform: 0, // informational, no score impact
  brand_impersonation: 40,
  telegram_account_takeover_phishing: 50,
  dropper_recruitment: 35,
  authority_coerced_dangerous_act: 50,
  fake_penalty_points_erasure: 35,
  threatens_physical_violence: 50,
};

export type ReasonTrustImpact = "informational" | "protective" | "risk";

/**
 * Trust-boundary classification for every reason code.
 *
 * A verified contact is evidence about the destination, not proof that the
 * surrounding message or caller is safe. New reason codes must be classified
 * here at compile time; the safe downgrade fails closed for every `risk` code.
 */
export const REASON_TRUST_IMPACT: Record<ReasonCode, ReasonTrustImpact> = {
  asks_for_otp: "risk",
  asks_for_sms_code: "risk",
  asks_for_card_cvv: "risk",
  asks_for_pin: "risk",
  asks_to_install_apk: "risk",
  asks_to_share_screen: "risk",
  asks_for_money_transfer: "risk",
  asks_to_transfer_to_safe_account: "risk",
  impersonates_bank: "risk",
  impersonates_operator: "risk",
  uses_urgency: "risk",
  threatens_legal_action: "risk",
  asks_not_to_hang_up: "risk",
  telegram_bank_contact: "risk",
  fake_loan_offer: "risk",
  suspicious_short_link: "risk",
  apk_download_link: "risk",
  unknown_sender: "risk",
  new_telegram_account: "risk",
  weird_domain: "risk",
  brand_name_typo: "risk",
  payment_before_service: "risk",
  too_good_to_be_true: "risk",
  requests_personal_data: "risk",
  non_uz_phone: "risk",
  valid_uz_phone: "informational",
  verified_official: "protective",
  known_reported: "risk",
  asks_to_scan_qr: "risk",
  relative_in_distress: "risk",
  requests_card_digits: "risk",
  threatens_account_block: "risk",
  fake_delivery_payment: "risk",
  fake_boss_request: "risk",
  malicious_file_bait: "risk",
  impersonates_official: "risk",
  suspicious_invite_link: "risk",
  gambling_prediction_promo: "risk",
  giveaway_engagement_bait: "risk",
  crypto_casino_bonus_funnel: "risk",
  fake_captcha_or_voting: "risk",
  task_reward_engagement_bait: "risk",
  unauthorized_credit_opened: "risk",
  coercive_secrecy: "risk",
  wallet_action_urgency: "risk",
  ton_referral_earning_scheme: "risk",
  investment_fast_profit_pitch: "risk",
  romance_investment_pivot: "risk",
  oneid_government_phishing: "risk",
  sim_swap_or_number_transfer: "risk",
  money_mule_recruitment: "risk",
  advance_fee_prize_inheritance: "risk",
  external_phishing_url: "risk",
  external_malware_url: "risk",
  hosted_app_platform: "informational",
  brand_impersonation: "risk",
  telegram_account_takeover_phishing: "risk",
  dropper_recruitment: "risk",
  authority_coerced_dangerous_act: "risk",
  fake_penalty_points_erasure: "risk",
  threatens_physical_violence: "risk",
};

export function canVerifiedContactMarkSafe(codes: readonly ReasonCode[]): boolean {
  return codes.every((code) => REASON_TRUST_IMPACT[code] !== "risk");
}

const AUTHORITY_REQUEST_RE =
  /(начальник|директор|руководител|бухгалтер|кадр|отдел кадров|прокуратур|мвд|налогов|орган[аы]|rahbar|direktor|boshliq|kadr|buxgalter|soliq|prokuratura|iib).{0,90}(паспорт|анкета|данн|код|карт|перевод|срочно|отправ|pasport|ma['’]lumot|kod|karta|pul|yubor|tez)/i;

const PATTERNS: { code: ReasonCode; re: RegExp }[] = [
  { code: "asks_for_otp", re: /\b(otp|one[\s-]?time\s?(password|code))\b/i },
  { code: "asks_for_sms_code", re: /\bsms\s*code\b/i },
  { code: "asks_for_sms_code", re: /\bkodni\s+(?:kiriting|yozing|tasdiqlang)\b/i },
  {
    code: "asks_for_sms_code",
    re: /(?:sms|otp|code|kod(?:i|ini)?).{0,60}(?:yuborishimni|yuborishni|jo['’]?natishimni|jonatishimni|berishimni|aytishimni).{0,40}(?:so['’]?ra|sora|talab)|(?:so['’]?ra|sora|talab).{0,80}(?:sms|otp|code|kod(?:i|ini)?)/i,
  },
  {
    code: "asks_for_sms_code",
    re: /кодни\s+(?:киритинг|ёзинг|езинг|тасдиқланг|тасдикланг|айтинг|юборинг)/i,
  },
  {
    code: "asks_for_sms_code",
    // Catches explicit "SMS code" wording AND softer real-world asks where the
    // attacker never says "code": "the code from the message/app/Telegram/bot",
    // "the code that will arrive / that arrived / that I sent". See CODING_RULES
    // (new patterns need positives + negatives + tests).
    re: /(?:sms.?код|код(?:ом|а|у)? из (?:смс|sms|сообщени[яюе]|приложени[яюе]|telegram|телеграмма?|бота|уведомлени[яюе])|подтверд(?:и|ите) код|tasdiq(?:lash)? kod|(?<![-\p{L}\p{N}])kodni (?:ayt(?:ing|ib\s+bering)?|yubor(?:ing)?|jo['’]?nat(?:ing)?|ber(?:ing)?)\b|verification code|код подтвер|6.?значн|код,? котор(?:ый|ая|ое|ые).{0,25}(?:прид[её]т|приш(?:л|ёл|е?л)|приходит|пришёл|отправл[её]н|отправлю|пришлю|передам|сброшу|направлю|смс|sms)|код,? что (?:прид[её]т|приш(?:л|ёл))|(?:прид[её]т|приш(?:л|ёл|е?л)).{0,15}код|kod,? (?:keladigan|kelgan|jo['’]?natilgan)|(?:kelgan|keladigan|jo['’]?natilgan).{0,15}kod(?:ni)?.{0,20}(?:ayt(?:ing|ib\s+bering)?|yubor(?:ing)?|jo['’]?nat(?:ing)?|ber(?:ing)?)\b)/iu,
  },
  {
    code: "asks_to_install_apk",
    re: /(установ(и|ите).{0,30}(прилож|apk)|apk.{0,35}(?:скачайте|yuklab|o['’]?rnat)|(?:o['’]?rnat|yukla).{0,35}(?:ilova|apk)|\binstall(?:ed|ing|s)?\b.{0,30}\b(?:app|apk)\b)/i,
  },
  {
    code: "asks_to_transfer_to_safe_account",
    re: /(безопасн.{0,15}(счёт|счет|карт)|safe account|xavfsiz hisob)/i,
  },
  {
    code: "impersonates_bank",
    re: /(служб(а|ы) безопасности банка|сотрудник банка|bank xavfsizlik|bank xodimi|central bank|центральн(ый|ого) банк|markaziy bank|hamkorbank|kapitalbank|uzcard|humo|\bpayme\b|\bclick\b)/i,
  },
  { code: "impersonates_operator", re: /(оператор связи|ucell|beeline|mobiuz|ums|uzmobile)/i },
  {
    code: "impersonates_bank",
    re: /\b(bank security|security department of (the )?bank|bank support|bank employee|bank officer)\b/i,
  },
  {
    code: "impersonates_bank",
    re: /(?:банк|bank).{0,140}(?:сообщите|назовите|пришлите|отправьте|переведите|tell|send|share|transfer|ayting|yuboring|o['’]?tkazing).{0,80}(?:код|sms|смс|otp|парол|password|карт|card|деньг|money|pul)/iu,
  },
  {
    code: "uses_urgency",
    re: /(срочно|немедленно|прямо сейчас|tezda|darhol|hozir(?:ning\s+o['’]?zida|.{0,30}(?:ayt(?:ing)?|yubor(?:ing)?|jo['’]?nat(?:ing)?|kirit(?:ing)?|to['’]?la(?:ng)?|o['’]?tkaz(?:ing)?|qil(?:ing)?)(?![\p{L}\p{N}_]))|urgent|immediately|right now)/iu,
  },
  {
    code: "threatens_legal_action",
    re: /(полици(я|ей)|(?<![\p{L}\p{N}_])(?:суд(?:а|у|ом|е|ы|ов|ебн\p{L}*|га|дан|да|нинг|ни)?|sud(?:ga|dan|da|ning|ni)?)(?![\p{L}\p{N}_])|арест|уголовн|jinoiy|hibsga|police|lawsuit|criminal case)/iu,
  },
  {
    code: "asks_not_to_hang_up",
    re: /(не клад(и|ите) трубку|не отключ|не завершайте|(?:telefonni|go['’]?shakni) qo['’]?yma(?:ng)?|don'?t hang up)/i,
  },
  {
    code: "telegram_bank_contact",
    re: /(банк.{0,20}telegram|telegram.{0,20}банк|bank.{0,20}telegram)/i,
  },
  {
    code: "fake_loan_offer",
    re: /(быстры(й|е) кредит|кредит без|kredit.?bering|tez kredit|easy loan|guaranteed loan|loan without)/i,
  },
  {
    code: "asks_for_money_transfer",
    re: /(переведите.{0,30}(счёт|карту|safe)|pul.{0,30}o['’]tkazing)/i,
  },
  {
    // Broad phrase gate only. `shouldFlagSafeAccountTransferRequest`
    // below still requires an actual transfer/protection instruction and
    // rejects questions and safety warnings.
    code: "asks_to_transfer_to_safe_account",
    re: /(?:безопасн\p{L}*\s+(?:сч[её]т|карт)|xavfsiz\s+hisob|(?:safe|secure)\s+account)/iu,
  },
  {
    code: "relative_in_distress",
    re: /(родственник|сын|дочь|брат|сестра|друг|внук).{0,80}(беда|авари|больниц|задержали|срочно нужны деньги|срочно.{0,20}(деньг|перевести))|(?<![\p{L}\p{N}_])(?:farzand(?:im|ing|ingiz|imiz|lari)?|o['’]g['’]il(?:im|ing|ingiz|imiz|lari)?|qiz(?:im|ing|ingiz|imiz|lari)?|aka(?:m|ngiz)?|uka(?:m|ngiz)?|opa(?:m|ngiz)?|sing(?:il|lim|lingiz)|ona(?:m|ngiz)?|ota(?:m|ngiz)?|do['’]st(?:im|ing|ingiz|imiz|lari)?|qarindosh(?:im|ing|ingiz|imiz|lari)?|yaqin(?:im|ing|ingiz|imiz|lari)?)(?![\p{L}\p{N}_]).{0,140}(?:avariya|kasalxona|shoshilinch.{0,20}pul|zudlik.{0,40}pul|mashina.{0,40}muammo|muammo.{0,60}pul|pul.{0,40}o['’]?tkaz)/iu,
  },
  {
    code: "requests_card_digits",
    re: /(последн(ие|их).{0,10}(4|четыре).{0,10}цифр|подтверд(и|ите).{0,15}цифр.{0,10}карт|karta.{0,20}(raqam|oxirgi).{0,10}(4|to['’]rt).{0,10}(raqam|son))/i,
  },
  {
    code: "threatens_account_block",
    re: /(карт(а|у)|счёт|счет|аккаунт).{0,30}(заблокир|блокиров)|(karta|hisob).{0,30}(bloklan|bloklab)/i,
  },
  {
    code: "fake_delivery_payment",
    re: /((курьер|доставк|посылк|почт[аы]|parcel|delivery|shipping|kuryer|yetkazib|posilka|етказиб|посилка).{0,90}(доплат|пошлин|сбор|комисс|вернут|возврат|ссылк|fee|returned|link|to['’]lov|havola|qaytar|komiss|boj|тўлов|толов|сўра|сура|только.{0,25}(по\s+)?карт|по\s+карте|card\s+only|faqat.{0,25}karta)|(только.{0,25}(по\s+)?карт|по\s+карте|card\s+only|faqat.{0,25}karta).{0,90}(курьер|доставк|посылк|parcel|delivery|shipping|kuryer|yetkazib|posilka|етказиб|посилка)|pay.{0,40}(delivery|shipping|parcel).{0,20}fee)/i,
  },
  {
    // Incremental delivery-payment lures often avoid the literal words
    // "fee" and "доплата": the victim is told to make "one more courier
    // payment", pay a personal/new card, or pay before an already-paid item
    // is released. Keep the extra/unexpected marker mandatory so an ordinary
    // courier payment is not classified as fraud by this supplemental gate.
    code: "fake_delivery_payment",
    re: /(?:(?:ещ[её]\s+(?:один|раз)|another|one\s+more).{0,35}(?:курьер\p{L}*|courier|delivery|shipping|kuryer|y?etkaz\p{L}*|етказ\p{L}*).{0,35}(?:плат[её]ж|оплат|payment|pay|to['’]?lov|тўлов|толов)|(?:курьер\p{L}*|доставк\p{L}*|посылк\p{L}*|courier|delivery|shipping|parcel|kuryer|y?etkaz\p{L}*|етказ\p{L}*).{0,120}(?:(?<!\p{L})личн\p{L}*.{0,18}карт|нов\p{L}*.{0,18}карт|shaxsiy.{0,18}karta|yangi.{0,18}karta|qo['’]?shimcha\s+pul|kutilmaganda|комисс\p{L}*.{0,45}(?:нов\p{L}*.{0,18}карт)|komiss\p{L}*.{0,45}(?:yangi|boshqa).{0,18}karta|personal.{0,18}card|new.{0,18}card|extra\s+(?:money|payment)|additional\s+(?:money|payment))|(?:уже\s+оплачен\p{L}*|already\s+paid).{0,120}(?:курьер\p{L}*|доставк\p{L}*|товар\p{L}*|courier|delivery|item|parcel).{0,45}(?:плат[её]ж|оплат|payment|pay|release))/iu,
  },
  {
    code: "payment_before_service",
    re: /(предоплат|аванс|задаток|оплатите.{0,30}(до|сначала)|брон[ьи].{0,30}(оплат|предоплат|аванс|задаток)|оплат.{0,30}брон|oldindan.{0,20}to['’]lov|avans|zaklad|bron.{0,30}(to['’]lov|tolov|pay|deposit|avans)|xizmatdan oldin|first.{0,20}pay|prepay|deposit|payment.{0,30}(?:requested|required).{0,25}before)/i,
  },
  {
    code: "fake_boss_request",
    re: AUTHORITY_REQUEST_RE,
  },
];

const ORDINARY_PLANNED_SUPPLIER_CONTEXT_RE =
  /(?:поставщик|доставщик|контрагент|supplier|vendor|delivery\s+provider|yetkazib\s+beruvchi|етказиб\s+берувчи)/iu;
const ORDINARY_PLANNED_PAYMENT_RE =
  /(?:плат[её]ж.{0,25}запланирован|оплат\p{L}*.{0,25}запланирован|запланирован\p{L}*.{0,25}(?:плат[её]ж|оплат)|scheduled\s+payment|payment.{0,25}(?:scheduled|planned)|(?:scheduled|planned).{0,25}payment|to['’]?lov.{0,25}rejalashtirilgan|rejalashtirilgan.{0,25}to['’]?lov|тўлов.{0,25}режалаштирилган|толов.{0,25}режалаштирилган|режалаштирилган.{0,25}(?:тўлов|толов))/iu;
const ORDINARY_PAYMENT_CONFIRMED_RE =
  /(?:(?:получател|реквизит|сумм).{0,55}(?:подтвержд|сверен|проверен)|(?:recipient|details|amount).{0,55}(?:confirmed|verified|checked)|(?:oluvchi|rekvizit|summa).{0,55}(?:tasdiqlangan|tekshirilgan|tekshirildi)|(?:олувчи|реквизит|сумма).{0,55}(?:тасдиқланган|текширилган|текширилди))/iu;
const ORDINARY_PLANNED_PAYMENT_SUSPICIOUS_RE =
  /(?:неизвестн|незнаком|ссылк|личн.{0,15}карт|доплат|дополнител.{0,15}(?:сбор|плат[её]ж)|комисс|возврат|сроч|никому\s+не\s+говор|unknown|stranger|link|personal\s+card|extra\s+(?:fee|payment)|commission|refund|urgent|keep\s+it\s+secret|notanish|begona|havola|qo['’]?shimcha.{0,15}(?:to['’]?lov|haq)|komiss|qaytar|shaxsiy.{0,12}karta|darhol|hech\s+kimga\s+aytma)/iu;
const ORDINARY_PLANNED_PAYMENT_PREAGREED_RE =
  /(?:заранее\s+(?:согласован|оговорен)|pre[-\s]?agreed|agreed\s+in\s+advance|avvaldan\s+kelishilgan|олдиндан\s+келишилган|аввалдан\s+келишилган)/iu;
const ORDINARY_CONTRACTED_SUPPLIER_PAYMENT_RE =
  /(?:по\s+(?:подписанн\p{L}*\s+)?договор|предусмотрен\p{L}*.{0,25}(?:договор|бюджет)|contracted\s+supplier|under\s+(?:our\s+)?contract|budgeted|avvaldan\s+kelishilgan|shartnoma.{0,25}(?:bo['’]?yicha|asosida)|аввалдан\s+келишилган|шартнома.{0,25}(?:бўйича|асосида))/iu;
const ORDINARY_PLANNED_PAYMENT_HARD_SUSPICIOUS_RE =
  /(?:неизвестн|незнаком|ссылк|личн.{0,15}карт|возврат|сроч|никому\s+не\s+говор|(?:ещ[её]|снова).{0,45}(?:перев|оплат|доплат|сч[её]т|реквизит)|(?:друг|нов).{0,25}(?:сч[её]т|карт|реквизит)|unknown|stranger|link|personal\s+card|refund|urgent|keep\s+it\s+secret|(?:again|another|extra).{0,40}(?:payment|transfer|account|details)|(?:different|new|changed).{0,30}(?:account|card|details)|notanish|begona|havola|qaytar|shaxsiy.{0,12}karta|darhol|hech\s+kimga\s+aytma|yana.{0,40}(?:to['’]?lov|o['’]?tkaz|hisob|rekvizit)|boshqa.{0,25}(?:hisob|karta|rekvizit))/iu;

function isOrdinaryPlannedSupplierPayment(text: string): boolean {
  return (
    ORDINARY_PLANNED_SUPPLIER_CONTEXT_RE.test(text) &&
    (ORDINARY_PLANNED_PAYMENT_RE.test(text) ||
      ORDINARY_CONTRACTED_SUPPLIER_PAYMENT_RE.test(text)) &&
    ORDINARY_PAYMENT_CONFIRMED_RE.test(text) &&
    !ORDINARY_PLANNED_PAYMENT_HARD_SUSPICIOUS_RE.test(text) &&
    (!ORDINARY_PLANNED_PAYMENT_SUSPICIOUS_RE.test(text) ||
      ORDINARY_PLANNED_PAYMENT_PREAGREED_RE.test(text) ||
      ORDINARY_CONTRACTED_SUPPLIER_PAYMENT_RE.test(text))
  );
}

const TELEGRAM_ACCOUNT_DELETE_CONTEXT_RE =
  /(telegram|телеграм|телеграмм|аккаунт|профил|account|profile|akkaunt|hisob)[\s\S]{0,220}(удал[её]н|удалени|заявк[\s\S]{0,20}удален|заявк[\s\S]{0,20}удалени|заблокир|блокиров|заморож|muzlat|blok|delete|deletion|blocked|o['’]?chir|bekor|noma['’]?lum[\s\S]{0,40}qurilma|qurilmadan[\s\S]{0,30}kirish)|(удал[её]н|удалени|delete|deletion|blocked|muzlat|blok|qurilmadan[\s\S]{0,30}kirish)[\s\S]{0,220}(telegram|телеграм|телеграмм|аккаунт|профил|account|profile|akkaunt|hisob)/i;
const TELEGRAM_ACCOUNT_ACTION_RE =
  /(отмена|отменить|спасти|сохранить|восстанов|нажм|кнопк|перейд|ссылк|введите|укажите|код|sms|otp|парол|номер|cancel|restore|save|button|link|enter|code|password|phone|raqam|kod|parol|havola|bosing|o['’]?ting|kiring|tasdiq|tasdiqlash|yakunlash)/i;

function shouldFlagTelegramAccountTakeoverPhishing(text: string): boolean {
  return TELEGRAM_ACCOUNT_DELETE_CONTEXT_RE.test(text) && TELEGRAM_ACCOUNT_ACTION_RE.test(text);
}

const DROPPER_TARGET_RE =
  /(дроппер|дроп|банковск.{0,20}карт|кар(та|ту|ты)|sim|сим.{0,5}карт|номер|oneid|аккаунт|кошел[её]к|криптокошел|bank card|sim card|phone number|account|wallet|crypto wallet|karta|sim karta|raqam|hisob|hamyon|akkaunt)/i;
const DROPPER_ACTION_RE =
  /(продай|продам|сдам|аренд|оформ.{0,30}(на себя|для нас|на вас)|открой.{0,30}(на себя|для нас|на вас)|передай|дай доступ|доступ.{0,20}(передай|дай)|за.{0,30}(сум|тыс|ming|so['’]?m)|вознагражд|(?<![\p{L}\p{N}_])sot(?:ing|aman|amiz|adi|iladi|moqchi)?(?![\p{L}\p{N}_])|ijara|ochib ber|topshir|berib tur|mukofot|rent|sell|open.{0,30}for us|reward)/iu;
const DROPPER_SAFETY_CONTEXT_RE =
  /(не передавай|не передавайте|не продавай|не продавайте|не сдавай|не сдавайте|нельзя передавать|do not sell|don't sell|do not transfer|sotmang|bermang|topshirmang)/i;

function hasUnsafeClauseDespiteSafetyContext(
  text: string,
  contextRe: RegExp,
  actionRe: RegExp,
): boolean {
  if (!contextRe.test(text) || !actionRe.test(text)) return false;
  if (!DROPPER_SAFETY_CONTEXT_RE.test(text)) return true;

  return text
    .split(
      /[.!?;\r\n]+|(?<![\p{L}\p{N}_])(?:but|however|lekin|ammo|\u043d\u043e|\u043e\u0434\u043d\u0430\u043a\u043e)(?![\p{L}\p{N}_])/iu,
    )
    .some(
      (clause) =>
        contextRe.test(clause) && actionRe.test(clause) && !DROPPER_SAFETY_CONTEXT_RE.test(clause),
    );
}

function shouldFlagDropperRecruitment(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((actionClause, index) => {
    if (
      !DROPPER_ACTION_RE.test(actionClause) ||
      DROPPER_SAFETY_CONTEXT_RE.test(actionClause) ||
      PENALTY_POINTS_CONTEXT_RE.test(actionClause)
    ) {
      return false;
    }
    const contextWindow = [clauses[index - 1], actionClause, clauses[index + 1]]
      .filter((clause) => clause && !PENALTY_POINTS_CONTEXT_RE.test(clause))
      .join(". ");
    return DROPPER_TARGET_RE.test(contextWindow);
  });
}

const GAMBLING_CONTEXT_RE =
  /((?:^|[^a-zа-я])ставк|(?:^|[^a-zа-я])ставлю|матч|прогноз|букмек|бетт?инг|казино|азартн|фри\s?спин|фриспин|депозит|(?:^|[^a-zа-я])деп(?:а|ов)?(?=$|[^a-zа-я])|слот|twin|luxe\s?bet|luxebet|sport\s?bet|sportsbook|betting|odds|prediction|free pick|free\s?spins?|casino|slots?|stavka|prognoz|bukmeker|kazino)/i;
const GAMBLING_ACTION_RE =
  /(t\.me\/\+|telegram\.me\/\+|подпис|канал|закрыт|бесплатн|выигр|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|джекпот|бонус|пополн|ссылк|100[ .]?000|гарантир|доход|прибыл|vip|subscribe|channel|free|win|profit|bonus|deposit|link|guaranteed|obuna|kanal|bepul|yutuq|foyda)/i;
const GAMBLING_NEUTRAL_CONTEXT_RE =
  /(без\s+ставок|без\s+прогнозов|не\s+ставки|не\s+прогноз|новости спорта|спортивные новости|расписание матча|счет матча|счёт матча|смотреть матч|sports news|match schedule|match score|natija|jadval)/i;

function shouldFlagGamblingPredictionPromo(text: string): boolean {
  if (GAMBLING_NEUTRAL_CONTEXT_RE.test(text)) return false;
  return GAMBLING_CONTEXT_RE.test(text) && GAMBLING_ACTION_RE.test(text);
}

const GIVEAWAY_CONTEXT_RE =
  /(розыгрыш|разыгр|random\s*nft|nft|банка подарков|денежн.{0,12}подар|подар|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|prizes?|giveaway|cash\s+gift|bank\s+gift|reward|airdrop|lottery|sovg['’]?a|sovrin|yutuq|yutug|pul\s+yut\p{L}*|bankdan.{0,35}\d+\s+ming.{0,25}ol\p{L}*|pul\s+mukofot|совға|соврин|ютуқ|мукофот)/iu;
const GIVEAWAY_ACTION_RE =
  /(капч|captcha|реакци|reaction|проголос|голос|vote|подпис|subscribe|участв|раздач|выда[еёю]|забир|получ(?:и(?:те)?|ить|ай(?:те)?)(?![\p{L}])|ссылк|кнопк|перейд|нажм|открой|открыл|зарегистр\p{L}*|тороп|claim|get\s+yours?|open(?:ed)?\s+(?:the\s+)?link|click|button|register|sign\s*up|rush|stars?|зв[её]зд|ishtirok|ovoz|obuna|kanal|olib\s+(?:ol(?:ing)?|qol)(?![\p{L}])|havola|link|tugma|shoshir|bos|ro['’]?yxatdan\s+o['’]?t|o['’]?t|och|ҳавол|линк|тугма|шошир|бос|очиб|олинг|обуна|кошел|wallet|hamyon|sms|otp|код|карта|депозит|деп)/iu;
const GIVEAWAY_SAFETY_RE =
  /(?:не\s+(?:переходите|открывайте|забирайте|получайте)|ничего\s+не\s+(?:получ|забрал)|ссылк\p{L}*\s+не\s+откры\p{L}*|мошенник.{0,20}(?:рассыла|обеща)|банк.{0,35}предупред\p{L}*.{0,45}(?:поддельн|ложн|фальшив).{0,20}(?:приз|подар)|do\s+not\s+(?:open|follow|claim)|received\s+nothing|opened\s+no\s+link|scammers?.{0,20}(?:send|promise)|bank.{0,35}warn\p{L}*.{0,45}fake.{0,20}(?:prize|gift)|havolani\s+(?:ochmang|ochmadi)|hech\s+narsa\s+(?:olmadi|olmagan)|(?:tugma|havola|o['’]?tkazma).{0,45}yo['’]?q|sovrinni\s+olmang|firibgar.{0,20}(?:yubor|va['’]?da)|bank.{0,35}(?:soxta|yolg['’]?on).{0,20}(?:sovg['’]?a|sovrin).{0,35}ogohlantir|ҳаволани\s+(?:очманг|очмади)|ҳеч\s+нарса\s+(?:олмади|олмаган)|(?:тугма|ҳавола|ўтказма).{0,45}йўқ|совринни\s+олманг|фирибгар.{0,20}(?:юбор|ваъда))/iu;
const GIVEAWAY_OFFICIAL_DESTINATION_RE =
  /(?:официальн.{0,20}(?:сайт|страниц)|official.{0,20}(?:site|website|page)|rasmiy.{0,20}(?:sayt|sahifa)|расмий.{0,20}(?:сайт|саҳифа))/iu;
const GIVEAWAY_OFFICIAL_RESULTS_RE =
  /(?:официальн.{0,25}(?:итог|победител|результат)|итоги\s+розыгрыша|official.{0,25}(?:results?|winners?)|rasmiy.{0,25}(?:natija|g['’]?olib)|расмий.{0,25}(?:натижа|ғолиб)|ғолиблар.{0,20}эълон\s+қил)/iu;
const GIVEAWAY_INDEPENDENT_NAVIGATION_RE =
  /(?:сохран[её]нн.{0,18}закладк|введ(?:ите|и).{0,28}адрес.{0,20}вручн|через\s+(?:ранее\s+)?сохран[её]нн.{0,25}(?:сайт|прилож)|saved\s+bookmark|type.{0,28}(?:site|website|page)\s+address\s+manually|official\s+app\s+(?:you\s+)?already\s+installed|saqlangan.{0,18}(?:xatcho['’]?p|havola)|(?:sayt|sahifa)\s+manzilini.{0,20}qo['’]?lda|avvaldan\s+o['’]?rnatilgan\s+rasmiy\s+ilova)/iu;
const GIVEAWAY_LIVE_CLAIM_RE =
  /(?:тороп|нажм|забир|получи|перейд|зарегистр\p{L}*|bos|shoshir|olib\s+(?:ol|qol)|ro['’]?yxatdan\s+o['’]?t|o['’]?t|бос|шошир|олиб\s+(?:ол|қол)|ўт|rush|click|claim|register|sign\s*up|get\s+yours?|wants?\s+me\s+to)/iu;
const GIVEAWAY_STRONG_LIVE_CLAIM_RE =
  /(?:тороп|нажм|забир|получи|перейд|bos|shoshir|olib\s+(?:ol|qol)|бос|шошир|олиб\s+(?:ол|қол)|rush|click|claim|get\s+yours?|wants?\s+me\s+to)/iu;
const GIVEAWAY_COMPLETED_PERSONAL_GIFT_RE =
  /(?:(?:получил(?:а|и)?|подарил(?:и|а)?|вручил(?:и|а)?|открыл(?:а|и)?|передал(?:и|а)?).{0,45}(?:день\s+рождени|свадьб|юбиле|лично|от\s+(?:семьи|друга|родных))|(?:день\s+рождени|свадьб|юбиле|лично|от\s+(?:семьи|друга|родных)).{0,45}(?:получил|подарил|вручил|открыл|передал)|(?:oldim|oldik|berdi|berishdi|sovg['’]?a\s+qildi).{0,40}(?:tug['’]?ilgan\s+kun|to['’]?y|nikoh|shaxsan)|(?:tug['’]?ilgan\s+kun|to['’]?y|nikoh|shaxsan).{0,40}(?:oldim|oldik|berdi|berishdi|sovg['’]?a\s+qildi)|(?:олдим|берди|беришди|совға\s+қилди).{0,40}(?:туғилган\s+кун|тўй|никоҳ|шахсан)|(?:туғилган\s+кун|тўй|никоҳ|шахсан).{0,40}(?:олдим|берди|беришди|совға\s+қилди)|(?:got|received|opened|gave\s+me|handed\s+me).{0,40}(?:birthday|wedding|anniversary|in\s+person|from\s+(?:family|a\s+friend))|(?:birthday|wedding|anniversary|in\s+person|from\s+(?:family|a\s+friend)).{0,40}(?:got|received|opened|gave\s+me|handed\s+me))/iu;
const GIVEAWAY_EXPLICIT_NO_LINK_RE =
  /(?:ссыл(?:ок|ки)\s+не\s+было|без\s+ссыл(?:ок|ки)|havola\s+yo['’]?q|ҳавола\s+йўқ|хавола\s+йук|there\s+(?:was|is)\s+no\s+link|no\s+links?)/iu;
const GIVEAWAY_BENIGN_FAMILY_GIFT_RE =
  /(?:(?:семь\p{L}*|родн\p{L}*).{0,45}подар\p{L}*.{0,35}(?:дома|лично).{0,80}(?:без|нет).{0,55}(?:регистрац|кноп|ссыл|перевод)|(?:oilam|oila|qarindosh\p{L}*).{0,45}(?:(?:sovg['’]?a.{0,35}(?:uyda|shaxsan))|(?:(?:uyda|shaxsan).{0,35}sovg['’]?a)).{0,90}(?:ro['’]?yxatdan\s+o['’]?tish|tugma|havola|o['’]?tkazma).{0,55}yo['’]?q|(?:оилам|оила|қариндош\p{L}*).{0,45}(?:(?:совға.{0,35}(?:уйда|шахсан))|(?:(?:уйда|шахсан).{0,35}совға)).{0,90}(?:рўйхатдан\s+ўтиш|тугма|ҳавола|ўтказма).{0,55}йўқ|(?:family|relatives?).{0,45}gift.{0,35}(?:at\s+home|in\s+person).{0,80}(?:without|no).{0,55}(?:registration|buttons?|links?|transfers?))/iu;

const KNOWN_CONTACT_PRIZE_RE =
  /(?:зн(?:а)?ком|друг|подруг|родствен|контакт|при(?:я)?т?ел\p{L}*|т[её]т\p{L}*|брат|сестр|ta(?:n)?i(?:s)?him|tanish|do['’]?st|qarindosh|sinfdosh|aka|uka|opa|kontakt|fr(?:i)?end|coll(?:e)?ague|relative|brother|sister|classmate|someone\s+i\s+know|known\s+contact)/iu;
const KNOWN_CONTACT_PRIZE_LINK_RE =
  /(?:ссыл|кнопк|зарегистр\p{L}*|havola|link|tugma|ro['’]?yxatdan\s+o['’]?t|ҳавол|линк|тугма|button|register|sign\s*up)/iu;
const KNOWN_CONTACT_PRIZE_ACTION_RE =
  /(?:переслал|зов[её]т|тороп|перейд|нажм|забир|получи|откр|зарегистр|утвержда|bos|aytdi|shoshir|olib\s+qol|och|yubor|so['’]?ra|бос|айтди|шошир|олиб\s+қол|оч|юбор|сўра|forwarded|wants?\s+me|rush|click|claim|opened|open|register|sign\s*up|insists?|sent|says?)/iu;

function shouldFlagKnownContactPrizeLink(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((actionClause, index) => {
    if (
      GIVEAWAY_SAFETY_RE.test(actionClause) ||
      GIVEAWAY_EXPLICIT_NO_LINK_RE.test(actionClause) ||
      (GIVEAWAY_COMPLETED_PERSONAL_GIFT_RE.test(actionClause) &&
        !KNOWN_CONTACT_PRIZE_LINK_RE.test(actionClause)) ||
      !KNOWN_CONTACT_PRIZE_LINK_RE.test(actionClause) ||
      !KNOWN_CONTACT_PRIZE_ACTION_RE.test(actionClause)
    ) {
      return false;
    }

    const contextWindow = [clauses[index - 1], actionClause, clauses[index + 1]]
      .filter(Boolean)
      .join(". ");
    if (
      GIVEAWAY_OFFICIAL_DESTINATION_RE.test(actionClause) &&
      GIVEAWAY_OFFICIAL_RESULTS_RE.test(contextWindow) &&
      (GIVEAWAY_INDEPENDENT_NAVIGATION_RE.test(contextWindow) ||
        !GIVEAWAY_LIVE_CLAIM_RE.test(contextWindow))
    ) {
      return false;
    }

    return KNOWN_CONTACT_PRIZE_RE.test(contextWindow) && GIVEAWAY_CONTEXT_RE.test(contextWindow);
  });
}

function shouldFlagGiveawayEngagementBait(text: string): boolean {
  if (shouldFlagKnownContactPrizeLink(text)) return true;
  const clauses = splitRiskClauses(text);
  return clauses.some((actionClause, index) => {
    const contextWindow = [clauses[index - 1], actionClause, clauses[index + 1]]
      .filter(Boolean)
      .join(". ");
    if (
      !GIVEAWAY_ACTION_RE.test(actionClause) ||
      GIVEAWAY_SAFETY_RE.test(actionClause) ||
      GIVEAWAY_EXPLICIT_NO_LINK_RE.test(actionClause) ||
      (GIVEAWAY_BENIGN_FAMILY_GIFT_RE.test(contextWindow) &&
        !GIVEAWAY_STRONG_LIVE_CLAIM_RE.test(actionClause)) ||
      (GIVEAWAY_COMPLETED_PERSONAL_GIFT_RE.test(actionClause) &&
        !KNOWN_CONTACT_PRIZE_LINK_RE.test(actionClause)) ||
      isGeneralSafetyClause(actionClause)
    ) {
      return false;
    }

    if (
      GIVEAWAY_OFFICIAL_DESTINATION_RE.test(actionClause) &&
      GIVEAWAY_OFFICIAL_RESULTS_RE.test(contextWindow) &&
      (GIVEAWAY_INDEPENDENT_NAVIGATION_RE.test(contextWindow) ||
        !GIVEAWAY_LIVE_CLAIM_RE.test(contextWindow))
    ) {
      return false;
    }
    return GIVEAWAY_CONTEXT_RE.test(text);
  });
}

const CRYPTO_CASINO_CONTEXT_RE =
  /(казино|азартн|слот|слоты|фри\s?спин|фриспин|free\s?spins?|casino|slots?|no\s?kyc|no\s?limits?|без\s?kyc|twin|tonplay|luxe\s?bet|luxebet)/i;
const CRYPTO_CASINO_ACTION_RE =
  /(депозит|(?:^|[^a-zа-я])деп(?:а|ов)?(?=$|[^a-zа-я])|пополн|бонус|ссылк|перейти|вход на сайт|без vpn|регистрац|запущ|bonus|deposit|top\s?up|link|signup|register|launched|always here|no registration|mini\s?app|telegram app|первые\s+\d+\s+деп)/i;

function shouldFlagCryptoCasinoBonusFunnel(text: string): boolean {
  if (GAMBLING_NEUTRAL_CONTEXT_RE.test(text)) return false;
  return CRYPTO_CASINO_CONTEXT_RE.test(text) && CRYPTO_CASINO_ACTION_RE.test(text);
}

const FAKE_CAPTCHA_VOTING_ACTION_RE =
  /(капч|captcha|реакци|reaction|проголос|голосован|vote|voting)/i;
const FAKE_CAPTCHA_VOTING_VERIFICATION_RE = /(verify|verification|проверка|подтверд|confirm)/i;
const FAKE_CAPTCHA_VOTING_REWARD_RE =
  /(nft|stars?|зв[её]зд|подар|gift|розыгрыш|разыгр|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|статуэт|награ|award|contest|airdrop|giveaway|lottery|wallet|кошел|ton|seed|login|telegram.{0,20}code|sms|otp|код|sovrin|yutuq|hamyon)/i;
const FAKE_CAPTCHA_VOTING_STRONG_REWARD_RE =
  /(nft|stars?|зв[её]зд|подар|gift|розыгрыш|разыгр|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|статуэт|награ|award|contest|airdrop|giveaway|lottery|wallet|кошел|ton|seed|login|sovrin|yutuq|hamyon)/i;

function shouldFlagFakeCaptchaOrVoting(text: string): boolean {
  return (
    (FAKE_CAPTCHA_VOTING_ACTION_RE.test(text) && FAKE_CAPTCHA_VOTING_REWARD_RE.test(text)) ||
    (FAKE_CAPTCHA_VOTING_VERIFICATION_RE.test(text) &&
      FAKE_CAPTCHA_VOTING_STRONG_REWARD_RE.test(text))
  );
}

const TASK_REWARD_CONTEXT_RE =
  /(reward\s?pool|leaderboard|points?|campaign participants?|easycoin|выполняй|выполн.{0,20}действ|легк.{0,20}действ|задани|апгрейд|кейс|безпроигрышн|невозможно проиграть|топов.{0,20}приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|прокачивай|(?:за\s+(?:лайк|реакци).{0,30}(?:начисл|заплат|выплат|зарплат|деньг|сум)|(?:ставьте|поставьте|ставить|поставить).{0,30}(?:лайк|реакци))|(?:смотрите|посмотрите|просмотр).{0,25}(?:видео|ролик)|(?:пишите|оставьте|размещайте).{0,25}(?:отзыв|комментар)|ochko|topshiriq|vazifa|layk\s+bos|video\s+ko['’]?r|sharh\s+(?:yoz|qoldir)|like\s+(?:videos?|posts?)|watch\s+videos?|(?:post(?:ed|ing)?|write|leave)\s+(?:reviews?|comments?))/iu;
const TASK_REWARD_BENEFIT_RE =
  /(\$\s?\d+|\d+[\s.,]?\d*\s?(usd|usdt|ton|stars?)|tokens?|токен|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|вывод|withdraw|заработ|зарплат|начисл|выплат|reward|earn|yutuq|mukofot|pul)/iu;
const TASK_REWARD_PAYMENT_GATE_RE =
  /(?:пополни|пополнить|пополнение|внести|оплатить|перевести|депозит|баланс|(?:треб\p{L}*|прос\p{L}*|нуж\p{L}*|надо).{0,35}(?:налог|комисс)|top\s*up|add\s+(?:money|funds)|deposit|pay|balance|verification\s+fee|balans(?:ni)?\s+to['’]?ldir|pul\s+o['’]?tkaz|to['’]?la|to['’]?lov|(?:komissiya|soliq).{0,25}(?:kerak|so['’]?ra))/iu;
const TASK_REWARD_WITHDRAWAL_RE =
  /(?:вывод|вывести|снять|получить\s+(?:деньги|заработок)|(?:зарплат|заработ).{0,30}(?:получ|выплат|вывест|снять)|(?:получ|выплат).{0,30}(?:зарплат|заработ)|withdraw|cash(?:ing)?\s*out|release\s+(?:the\s+)?earnings|pulni\s+yech|daromadni\s+ol|ish\s+haq(?:i|ini).{0,30}(?:ol|yech|ber))/iu;
const TASK_REWARD_SAFETY_WARNING_RE =
  /(?:(?:не\s+(?:пополняйте|платите)|(?:do\s+not|don['’]?t|never)\s+(?:top\s*up|pay)|balansni\s+to['’]?ldirmang).{0,120}(?:мошен|обман|опасн|scam|fraud|firib|xavf)|(?:мошен|обман|опасн|scam|fraud|firib|xavf).{0,120}(?:не\s+(?:пополняйте|платите)|(?:do\s+not|don['’]?t|never)\s+(?:top\s*up|pay)|balansni\s+to['’]?ldirmang))/iu;

function shouldFlagTaskRewardEngagementBait(text: string): boolean {
  if (TASK_REWARD_SAFETY_WARNING_RE.test(text)) return false;
  return (
    TASK_REWARD_CONTEXT_RE.test(text) &&
    (TASK_REWARD_BENEFIT_RE.test(text) ||
      (TASK_REWARD_PAYMENT_GATE_RE.test(text) && TASK_REWARD_WITHDRAWAL_RE.test(text)))
  );
}

const UNAUTHORIZED_CREDIT_SUBJECT_RE =
  /(?:на\s+(?:ваше|мо[ёе])\s+имя|на\s+меня|без\s+(?:моего|вашего)\s+(?:ведома|согласия)|sizga|sizning\s+nomingizga|mening\s+nomimga|nomimga|ustimga|in\s+(?:your|my)\s+name|without\s+(?:your|my)\s+(?:knowledge|consent)|using\s+my\s+identity|my\s+identity)/iu;
const UNAUTHORIZED_CREDIT_PRODUCT_RE =
  /(?:кредит|за[ёе]м|микрозайм|рассрочк|kredit|qarz|mikroqarz|nasiya|muddatli\s+to['’]?lov|bo['’]?lib\s+to['’]?lash|loan|credit|buy[\s-]?now[\s-]?pay[\s-]?later|\bbnpl\b|installment|klarna)/iu;
const UNAUTHORIZED_CREDIT_OPENED_RE =
  /(?:оформ(?:или|лен[ао]?|лено)|открыли|взяли|повесили|навесили|rasmiylashtir(?:ildi|ilgan|ishibdi)|och(?:ildi|ilibdi|ishibdi)|olishibdi|was\s+(?:opened|taken\s+out|registered)|has\s+been\s+(?:opened|registered)|opened|registered|appeared)/iu;
const UNAUTHORIZED_CREDIT_DENIAL_RE =
  /(?:котор(?:ый|ого|ую)\s+(?:я\s+)?не\s+(?:брал[аи]?|оформлял[аи]?|открывал[аи]?|заказывал[аи]?)|(?:^|[^\p{L}])я\s+(?:его|это|такого)?\s*не\s+(?:брал[аи]?|оформлял[аи]?|открывал[аи]?|заказывал[аи]?)|(?:^|[^\p{L}])men\s+(?:uni\s+)?(?:ochmaganman|olmaganman|rasmiylashtirmaganman)|(?:^|[^\p{L}])i\s+(?:did\s+not|didn['’]?t|never)\s+(?:open|take\s+out|register|apply\s+for)|not\s+(?:opened|taken\s+out|registered)\s+by\s+me)/iu;
const AUTHORIZED_CREDIT_RE =
  /(?:я\s+сам(?:а)?\s+(?:взял[аи]?|оформил[аи]?|открыл[аи]?).{0,30}(?:кредит|за[ёе]м|рассрочк)|(?:muddatli\s+to['’]?lov|nasiya|kredit|qarz).{0,35}o['’]?zim.{0,25}(?:oldim|ochdim|rasmiylashtirdim)|o['’]?zim.{0,25}(?:muddatli\s+to['’]?lov|nasiya|kredit|qarz).{0,25}(?:oldim|ochdim|rasmiylashtirdim)|i\s+personally\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl)|i\s+myself\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl)|i\s+(?:opened|took\s+out|registered|applied\s+for).{0,35}(?:klarna|installment|loan|credit|bnpl).{0,20}\bmyself\b)/iu;

function splitScenarioAssertionClauses(text: string): string[] {
  return text
    .split(
      /[.!?;\n]+|(?:,\s*|\s+)(?:(?:but|however|но|однако|lekin|biroq)|(?:and|then|а|и|затем|va|keyin)(?=\s+(?:(?:(?:now|теперь|endi)\s+)?(?:(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)|мошенник|звонивш\p{L}*|незнаком\p{L}*|собеседник|firibgar|qo['’]?ng['’]?iroq\s+qiluvchi|notanish\s+kontakt)(?!\p{L})|(?:i|we|я|мы|men|biz)(?!\p{L})|(?:this|that|the|этот|эта|это|тот|та|bu|shu)\s+(?:(?:second|another|второй|другой|ikkinchi|boshqa)\s+)?(?:loan|credit|installment|bnpl|кредит|за[ёе]м|рассрочк\p{L}*|kredit(?:ni)?|qarz(?:ni)?|nasiya)(?!\p{L}))))\s+/iu,
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
}

const EXPLICIT_RISK_SOURCE_PREFIX_RE =
  /^(?:(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)\b|(?:i|we)\s+(?:received|got|was\s+sent).{0,60}\b(?:from\s+)?(?:the\s+)?(?:caller|scammer|fraudster|attacker|stranger|unknown\s+contact)\b|(?:мошенник|звонивш\p{L}*|незнаком\p{L}*|собеседник)(?!\p{L})|(?:firibgar|qo['’]?ng['’]?iroq\s+qiluvchi|notanish\s+kontakt)\b)/iu;
const EDUCATIONAL_EXAMPLE_PREFIX_RE =
  /^(?:(?:the\s+)?(?:article|documentation|guide|manual)\s+(?:says|states|shows|explains|describes)(?:\s*:|\s+that(?!\p{L})|\s*,?\s*["“‘])|(?:support\s+)?documentation\s+(?:gives|shows|contains)\s+(?:this\s+)?(?:example|hypothetical)\s*:|(?:(?:for\s+)?example|hypothetical\s+example)\s*:|(?:статья|документация|инструкция|руководство)\s+(?:говорит|гласит|показывает|объясняет)\s*:|(?:пример|гипотетический\s+пример)\s*:|(?:maqola|hujjat|qo['’]?llanma)\s+(?:deydi|ko['’]?rsatadi|tushuntiradi)\s*:|(?:misol|faraziy\s+misol)\s*:)/iu;
const STRONG_EDUCATIONAL_EXAMPLE_PREFIX_RE =
  /^(?:(?:support\s+)?documentation\s+(?:gives|shows|contains)\s+(?:this\s+)?(?:example|hypothetical)\s*:|(?:(?:for\s+)?example|hypothetical\s+example)\s*:|(?:пример|гипотетический\s+пример)\s*:|(?:misol|faraziy\s+misol)\s*:)/iu;
const DOCUMENT_ATTRIBUTED_QUOTE_PREFIX_RE =
  /^\s*(?:(?:the\s+)?(?:article|documentation|guide|manual)|(?:статья|документация|инструкция|руководство)|(?:maqola|hujjat|qo['’]?llanma))\s+\p{L}{2,32}\s*(?::|,)\s*(?<opener>["“„«])/iu;
const PROTECTIVE_COVER_STORY_INSTRUCTION_RE =
  /(?:(?:never|do\s+not|don['’]?t|must\s+not|should\s+not)\s+(?:tell|ask|instruct).{0,90}(?:customer|user|person|someone).{0,90}(?:tell|say)|(?:не|никогда\s+не)\s+(?:говорите|просите|инструктируйте).{0,90}(?:клиент|пользовател|человек).{0,90}(?:сказать|говорить)|(?:hech\s+qachon|aslo).{0,45}(?:mijoz|odam).{0,90}(?:deb\s+ayt|aytishni))/iu;

function isNonUserEducationalExample(text: string): boolean {
  const normalized = text.trim();
  return (
    !EXPLICIT_RISK_SOURCE_PREFIX_RE.test(normalized) &&
    EDUCATIONAL_EXAMPLE_PREFIX_RE.test(normalized)
  );
}

function withoutDocumentAttributedQuote(text: string): string {
  const match = DOCUMENT_ATTRIBUTED_QUOTE_PREFIX_RE.exec(text);
  const opener = match?.groups?.opener;
  if (!match || !opener) return text;

  const closer = opener === "«" ? "»" : opener === "„" ? "“" : opener === "“" ? "”" : '"';
  const closeAt = text.indexOf(closer, match[0].length);
  return closeAt === -1 ? text : text.slice(closeAt + closer.length).trimStart();
}

const EXPLICIT_INCIDENT_OWNER_PREFIX_RE = /^(?:i|we|я|мы|men|biz)(?!\p{L})/iu;

function isEducationalContinuation(previous: string, current: string): boolean {
  const normalizedCurrent = current.trim().replace(/^[\s"'“”‘’([\]-]+/u, "");
  return (
    isNonUserEducationalExample(previous) &&
    !EXPLICIT_RISK_SOURCE_PREFIX_RE.test(normalizedCurrent) &&
    (!EXPLICIT_INCIDENT_OWNER_PREFIX_RE.test(normalizedCurrent) ||
      STRONG_EDUCATIONAL_EXAMPLE_PREFIX_RE.test(previous.trim()))
  );
}

function shouldFlagUnauthorizedCreditOpened(text: string): boolean {
  const scenarioText = withoutDocumentAttributedQuote(text);
  if (!UNAUTHORIZED_CREDIT_PRODUCT_RE.test(scenarioText)) return false;
  const selfAuthorizedIdentityUse =
    /(?:^|[^\p{L}])i\s+(?:opened|took\s+out|registered|applied\s+for).{0,50}using\s+my\s+identity/iu;
  const clauses = splitScenarioAssertionClauses(scenarioText);
  return clauses.some((clause, index) => {
    if (
      isNonUserEducationalExample(clause) ||
      AUTHORIZED_CREDIT_RE.test(clause) ||
      selfAuthorizedIdentityUse.test(clause)
    ) {
      return false;
    }
    const previous = clauses[index - 1] ?? "";
    const previousIsSelfAuthorized =
      AUTHORIZED_CREDIT_RE.test(previous) || selfAuthorizedIdentityUse.test(previous);
    const adjacent = previous && !previousIsSelfAuthorized ? `${previous} ${clause}` : clause;
    if (isEducationalContinuation(previous, clause)) return false;
    return (
      UNAUTHORIZED_CREDIT_PRODUCT_RE.test(adjacent) &&
      ((UNAUTHORIZED_CREDIT_SUBJECT_RE.test(adjacent) &&
        UNAUTHORIZED_CREDIT_OPENED_RE.test(adjacent)) ||
        UNAUTHORIZED_CREDIT_DENIAL_RE.test(adjacent))
    );
  });
}

const COERCIVE_SECRECY_RE =
  /(?:никому\s+не\s+(?:говор|расскаж|сообщ)|держите\s+(?:это|операци|расследовани|дело).{0,20}в\s+тайне|hech\s+kimga\s+(?:aytmang|gapirmang)|sir\s+saqla|(?:not\s+to|do\s+not|don['’]?t)\s+tell\s+anyone|keep\s+(?:this|the\s+(?:operation|investigation|case|transaction)).{0,20}secret)/iu;
const COERCIVE_SECRECY_CONTEXT_RE =
  /(?:операци[яию]|спецопераци|расследовани|следстви|уголовн.{0,20}дел|мвд|полици|прокуратур|iib|ichki\s+ishlar|politsiya|prokuratura|maxsus\s+operatsiya|tergov|jinoyat\s+ishi|police\s+operation|law[\s-]?enforcement\s+operation|investigation|criminal\s+case)/iu;
const COERCIVE_SECRECY_SAFETY_WARNING_RE =
  /(?:(?:полици|мвд|госорган).{0,50}(?:никогда\s+не|не\s+(?:просит|требует|должн)).{0,70}(?:никому\s+не\s+говор|держать.{0,20}в\s+тайне)|(?:iib|iiv|politsiya).{0,50}(?:hech\s+qachon|talab\s+qilmaydi).{0,70}(?:hech\s+kimga\s+ayt|sir\s+saqla)|(?:police|law[\s-]?enforcement).{0,50}(?:never|do(?:es)?\s+not).{0,30}(?:ask|demand|require).{0,70}(?:tell\s+no\s+one|not\s+tell\s+anyone|keep.{0,20}secret)|(?:(?:не\s+(?:скрывайте|утаивайте)|никогда\s+не\s+(?:скрывайте|утаивайте)|(?:do\s+not|don['’]?t|never|should\s+not)\s+(?:hide|conceal)|(?:yashirmang|sir\s+saqlamang)).{0,80}(?:перевод|операци|плат[её]ж|банк|transfer|transaction|payment|bank|o['’]?tkaz|to['’]?lov|bank)|(?:o['’]?tkazma|to['’]?lov).{0,60}(?:yashirmang|sir\s+saqlamang)))/iu;
const COERCIVE_TRANSACTION_CONTEXT_RE =
  /(?:перевод|операци[яию]|плат[её]ж|деньг|банк|transfer|transaction|payment|money|bank|o['’]?tkaz|to['’]?lov|pul)/iu;
const COERCIVE_TRANSACTION_SECRECY_RE =
  /(?:не\s+(?:говорить|говорите|сообщать|сообщайте|рассказывать|рассказывайте)\s+(?:банку|семье|близким)|скры(?:ть|вать|вайте)\s+(?:этот\s+)?(?:перевод|операци[юя]|плат[её]ж).{0,50}(?:от\s+(?:банка|семьи|близких))?|(?:перевод|операци[юя]|плат[её]ж).{0,60}(?:держ(?:ать|ите)\s+в\s+тайне|скры(?:ть|вать)|никому\s+не\s+(?:говорить|сообщать))|(?:not\s+to|do\s+not|don['’]?t)\s+(?:tell|inform)\s+(?:the\s+)?(?:bank|family).{0,80}(?:transfer|transaction|payment|money)|(?:hide|conceal)\s+(?:this\s+|the\s+)?(?:transfer|transaction|payment).{0,50}(?:from\s+(?:the\s+)?(?:bank|family))|keep\s+(?:this\s+|the\s+)?(?:transfer|transaction|payment).{0,30}secret|(?:bankka|oilaga|yaqinlarga)\s+(?:bu\s+)?(?:o['’]?tkazma|to['’]?lov|pul).{0,45}(?:haqida\s+)?(?:aytma|gapirma)|(?:o['’]?tkazma|to['’]?lov).{0,55}(?:bankdan|oiladan|yaqinlardan)\s+(?:yashir|sir\s+saqla))/iu;
const COERCIVE_COVER_STORY_BANK_RE = /(?:банк|bank)/iu;
const COERCIVE_COVER_STORY_TRANSACTION_RE =
  /(?:перевод|плат[её]ж|деньг|transfer|payment|money|o['’]?tkaz|to['’]?lov|pul)/iu;
const COERCIVE_COVER_STORY_FAMILY_RE = /(?:семь|родствен|family|relative|oila|qarindosh)/iu;
const COERCIVE_COVER_STORY_INSTRUCTION_RE =
  /(?:скаж(?:и|ите)|говор(?:и|ите)|(?:сказали|велел[аи]?|приказали|требуют|просят).{0,35}(?:сказать|говорить)|(?:deb\s+ayt(?:ing)?|ayt(?:ing)?.{0,20}\s+deb)|(?:tell|say)\s+(?:the\s+)?bank|(?:told|asked|instructed)\s+(?:me\s+)?to\s+(?:tell|say))/iu;
const COERCIVE_COVER_STORY_TRUTH_RE =
  /(?:правд\p{L}*\s+не\s+(?:говор|расскаж|сообщ)|не\s+(?:говор|расскаж|сообщ).{0,20}правд|rost(?:ini)?\s+(?:aytma|gapirma)|haqiqat\p{L}*\s+(?:aytma|gapirma)|(?:do\s+not|don['’]?t)\s+(?:tell|say).{0,25}(?:the\s+)?truth|hide\s+the\s+truth)/iu;
const COERCIVE_COVER_STORY_TRUTH_ADVICE_RE =
  /(?:(?:честно|правду).{0,25}(?:скаж|говор)|(?:скаж|говор).{0,25}(?:честно|правду)|rostini\s+ayt(?:ing)?|haqiqat\p{L}*\s+ayt(?:ing)?|(?:tell|say).{0,25}(?:the\s+truth|honestly|truthfully)|(?:honestly|truthfully).{0,25}(?:tell|say))/iu;

function shouldFlagCoerciveSecrecy(text: string): boolean {
  const clauses = splitScenarioAssertionClauses(withoutDocumentAttributedQuote(text));
  return clauses.some((clause, index) => {
    if (
      isNonUserEducationalExample(clause) ||
      PROTECTIVE_COVER_STORY_INSTRUCTION_RE.test(clause) ||
      COERCIVE_SECRECY_SAFETY_WARNING_RE.test(clause) ||
      (COERCIVE_COVER_STORY_TRUTH_ADVICE_RE.test(clause) &&
        !COERCIVE_COVER_STORY_TRUTH_RE.test(clause))
    ) {
      return false;
    }
    const previous = clauses[index - 1] ?? "";
    const next = clauses[index + 1] ?? "";
    const adjacent = previous ? `${previous} ${clause}` : clause;
    if (isEducationalContinuation(previous, clause)) return false;
    const officialSecrecy =
      COERCIVE_SECRECY_RE.test(clause) &&
      (COERCIVE_SECRECY_CONTEXT_RE.test(adjacent) ||
        (EXPLICIT_RISK_SOURCE_PREFIX_RE.test(clause) && COERCIVE_SECRECY_CONTEXT_RE.test(next)));
    const transactionSecrecy =
      COERCIVE_TRANSACTION_SECRECY_RE.test(clause) &&
      COERCIVE_TRANSACTION_CONTEXT_RE.test(adjacent);
    const deceptiveCoverStory =
      COERCIVE_COVER_STORY_BANK_RE.test(adjacent) &&
      COERCIVE_COVER_STORY_TRANSACTION_RE.test(adjacent) &&
      COERCIVE_COVER_STORY_FAMILY_RE.test(adjacent) &&
      COERCIVE_COVER_STORY_INSTRUCTION_RE.test(clause);
    return officialSecrecy || transactionSecrecy || deceptiveCoverStory;
  });
}

const WALLET_CONTEXT_RE =
  /(wallet|кошел[её]к|hamyon|tonkeeper(?:\s+battery)?|hot wallet|earn tab|defi|lending|liquidation|transaction fees?|gas fees?|seed phrase|private key|connect wallet|подключ.{0,20}кошел|подпис.{0,20}транзакц|rhea finance|px holders?|\$\s?px\b)/i;
const WALLET_URGENCY_ACTION_RE =
  /(security incident|24[\s-]?hour|grace period|act now|reopened|reactivated|settle|open positions?|top\s?up|пополн|сроч|успей|ликвидац|реактив|перевед|transfer|pay fees?|open app|link|manage|баланс|balance|connect|подключ|оплат|комисс)/i;

function shouldFlagWalletActionUrgency(text: string): boolean {
  return WALLET_CONTEXT_RE.test(text) && WALLET_URGENCY_ACTION_RE.test(text);
}

const TON_REFERRAL_CONTEXT_RE =
  /(ton|telegram|mini\s?app|ton dating|stars?|зв[её]зд|crypto|крипт)/i;
const TON_REFERRAL_REWARD_RE =
  /(earn|заработ|получа[йе]|приглаш|invited friend|invite friends?|referral link|реферальн|за каждого|per invited|за приглаш|друз|do['’]st|taklif)/i;

function shouldFlagTonReferralEarningScheme(text: string): boolean {
  return TON_REFERRAL_CONTEXT_RE.test(text) && TON_REFERRAL_REWARD_RE.test(text);
}

const INVESTMENT_FAST_PROFIT_CONTEXT_RE =
  /(инвест|трейд|торг|trading|trade|forex|gold|золото|валютн|бирж|рынок|крипт|crypto|investment|investits|daromad|foyda|ton|usdt|wallet|кошел|hamyon)/i;
const INVESTMENT_FAST_PROFIT_HOOK_RE =
  /(\+?\s?\d+(?:[.,]\d+)?\s?\$|\$\s?\d+|\d+\s?(?:usd|usdt|у\.?е\.?)|за\s+(?:день|сутки|час|недел|5\s+дней)|новичок|beginner|бесплатн|free|прям[о]?й эфир|механик|начать.{0,20}торг|гарантир|guaranteed|доходн|прибыл|profit|earn.{0,24}(?:\d|profit|return|daily|day|week|month)|заработ)/i;
const INVESTMENT_NEUTRAL_CONTEXT_RE =
  /(новост|обзор|аналитик|котировк|учебн|словар|истори[яи]\s+рынк|не\s+является\s+инвестиц|market\s+news|education|tutorial)/i;

function shouldFlagInvestmentFastProfitPitch(text: string): boolean {
  const hasFastProfitHook = INVESTMENT_FAST_PROFIT_HOOK_RE.test(text);
  if (INVESTMENT_NEUTRAL_CONTEXT_RE.test(text) && !hasFastProfitHook) {
    return false;
  }
  return INVESTMENT_FAST_PROFIT_CONTEXT_RE.test(text) && hasFastProfitHook;
}

const ROMANCE_TRUST_RE =
  /(люблю|скучаю|будем вместе|будущее вместе|отношени[яй]|доверяй|любимый|любимая|romance|dating|love|together|future|ishon|sevgi|sog['’]?indim)/i;
const ROMANCE_INVESTMENT_RE =
  /(инвест|крипт|бирж|доход|заработ|прибыл|депозит|usdt|wallet|кошел|ton|crypto|trading|invest|daromad|sarmoya|hamyon|kripto)/i;

function shouldFlagRomanceInvestmentPivot(text: string): boolean {
  return ROMANCE_TRUST_RE.test(text) && ROMANCE_INVESTMENT_RE.test(text);
}

const ONEID_CONTEXT_RE =
  /(one\s?id|единый\s?id|id\.gov\.uz|my\.gov\.uz|my\.soliq\.uz|soliq\.uz|электронн.{0,20}правительств|госуслуг|давлат хизмат|pinfl|пинфл|jshshir|myid|digital passport|цифров.{0,15}паспорт)/i;
const ONEID_ACTION_RE =
  /(войд|вход|авториз|подтверд|вериф|обнов|разблок|заявк|субсид|пособ|налог|штраф|кредит|код|парол|логин|паспорт|pinfl|пинфл|login|verify|confirm|password|code|subsidiya|jarima|soliq|kod|parol)/i;
const ONEID_OFFICIAL_SELF_SERVICE_RE =
  /(?:(?:обжал|оспор|апелляц|оплатил|оплатила|оплачен).{0,90}(?:через\s+(?:официальн\p{L}*\s+)?(?:портал\s+)?госуслуг|на\s+(?:официальн\p{L}*\s+)?(?:гос)?портал)|(?:через\s+(?:официальн\p{L}*\s+)?(?:портал\s+)?госуслуг|на\s+(?:официальн\p{L}*\s+)?(?:гос)?портал).{0,90}(?:обжал|оспор|апелляц|оплатил|оплатила|оплачен)|(?:сам(?:а)?\s+открыл\p{L}*|сохран[её]нн\p{L}*\s+закладк\p{L}*).{0,120}(?:жалоб|обжал|апелляц)|(?:appeal|contest|paid).{0,90}(?:official\s+(?:government\s+)?(?:portal|app)|government\s+services|one\s?id)|(?:i\s+opened|saved\s+bookmark).{0,120}(?:appeal|complaint)|(?:one\s?id).{0,120}(?:myself|o['’]?zim|ўзим|узим)|(?:o['’]?zim\s+och|saqlangan\s+(?:manzil|xatcho['’]?p)).{0,120}(?:shikoyat|apellyatsiya)|(?:rasmiy\s+(?:davlat\s+)?(?:portal|ilova)|davlat\s+xizmat).{0,90}(?:shikoyat|apellyatsiya|to['’]?ladim|to['’]?langan))/iu;
const ONEID_PROTECTIVE_NO_SECRET_RE =
  /(?:без\s+ссылок|парол\p{L}*.{0,30}(?:не\s+(?:сообщ|переда|даю)|никому\s+не)|parolni\s+hech\s+kimga\s+bermayman|паролни\s+ҳеч\s+кимга\s+бермайман|паролни\s+хеч\s+кимга\s+бермайман|shared?\s+no\s+(?:password|code)|did\s+not\s+share.{0,25}(?:password|code)|no\s+(?:password|code).{0,15}(?:shared|sent))/iu;
const ONEID_ACTIVE_PHISHING_LURE_RE =
  /(?:(?:прислал|отправил|пришл|просят|требуют|велят|перейд|открой|введ|сообщ|назов).{0,100}(?:ссылк|линк|вложен|файл|код|парол|логин|pinfl|пинфл)|(?:sent|asked|asks|requires?|open|click|follow|enter|tell|share).{0,100}(?:link|attachment|(?<!\p{L})f[іi]les?(?!\p{L})|code|password|login|pinfl)|(?:yubor|so['’]?ra|talab\s+qil|och|bos|o['’]?t|kirit|ayt).{0,100}(?:havola|fayl|kod|parol|jshshir)|https?:\/\/)/iu;

function shouldFlagOneIdGovernmentPhishing(text: string): boolean {
  const clauses = splitRiskClauses(text);
  const clauseMatch = clauses.some((clause, index) => {
    const contextWindow = [clauses[index - 1], clause, clauses[index + 1]]
      .filter(Boolean)
      .join(". ");
    if (ONEID_ACTIVE_PHISHING_LURE_RE.test(clause)) {
      if (ONEID_PROTECTIVE_NO_SECRET_RE.test(clause)) return false;
      return ONEID_CONTEXT_RE.test(contextWindow) && ONEID_ACTION_RE.test(contextWindow);
    }
    if (!ONEID_CONTEXT_RE.test(clause) || !ONEID_ACTION_RE.test(clause)) return false;
    return !(
      ONEID_OFFICIAL_SELF_SERVICE_RE.test(clause) &&
      (!ONEID_ACTIVE_PHISHING_LURE_RE.test(clause) || ONEID_PROTECTIVE_NO_SECRET_RE.test(clause))
    );
  });
  if (clauseMatch) return true;
  if (!ONEID_CONTEXT_RE.test(text) || !ONEID_ACTION_RE.test(text)) return false;
  if (!ONEID_OFFICIAL_SELF_SERVICE_RE.test(text)) return true;
  return clauses.some(
    (clause) =>
      ONEID_ACTIVE_PHISHING_LURE_RE.test(clause) && !ONEID_PROTECTIVE_NO_SECRET_RE.test(clause),
  );
}

const SIM_SWAP_CONTEXT_RE =
  /(перевыпуск|перевыпуст|замена|дубликат|восстанов|перенести номер|перенос номера|sim.{0,10}swap|sim.{0,25}(almashtir|tiklash|dublikat|replace|reissue|restore|duplicate|transfer)|(?:almashtir|tiklash|dublikat|replace|reissue|restore|duplicate|transfer).{0,25}(?:sim|esim|number|raqam)|номер.{0,30}(перенос|перевыпуск))/i;
const SIM_SWAP_ASK_RE =
  /(назов(и|ите)(?![а-яёa-z])|скаж(и|ите)(?![а-яёa-z])|сообщ(и|ите)(?![а-яёa-z])|подтверд(и|ите)(?![а-яёa-z])|отправь(те)?(?![а-яёa-z])|введите(?![а-яёa-z])|пришл(и|ите)(?![а-яёa-z])|прос(?:ит|ят)|требу(?:ет|ют)|ayting|yuboring|kiriting|tasdiq|so['’]?ra(?:yapti|moqda|di|shdi|shyapti)?|talab\s+qil|send|enter|confirm|tell|ask(?:s|ed|ing)?|request(?:s|ed|ing)?)/i;
const SIM_SWAP_NEGATION_RE =
  /(не\s+(?:просит|просят|требует|требуют)|so['’]?ramaydi|talab\s+qilmaydi|does\s+not\s+(?:ask|request|require))/i;
const SIM_SWAP_ACTION_RE =
  /(сим|sim|номер|raqam).{0,40}(код|смс|sms|подтверд|паспорт|pinfl|пинфл|доступ|operator|оператор|tasdiq|kod|pasport)|((код|смс|sms|подтверд|паспорт|pinfl|пинфл|tasdiq|kod|pasport).{0,40}(сим|sim|номер|raqam))/i;
const SIM_SWAP_EN_DIRECT_REQUEST_RE =
  /\b(?:ask|asks|request|requests)\b.{0,40}\b(?:code|otp|pin)\b.{0,50}\b(?:replace|reissue|restore|duplicate|transfer)\b.{0,30}\b(?:sim|esim)\b/i;

function shouldFlagSimSwapOrNumberTransfer(text: string): boolean {
  return (
    !SIM_SWAP_NEGATION_RE.test(text) &&
    SIM_SWAP_CONTEXT_RE.test(text) &&
    SIM_SWAP_ASK_RE.test(text) &&
    (SIM_SWAP_ACTION_RE.test(text) || SIM_SWAP_EN_DIRECT_REQUEST_RE.test(text))
  );
}

const MONEY_MULE_CONTEXT_RE =
  /(принимай|принимать|получай|зачисл|придут деньги|отправь дальше|перешли дальше|обналич|за\s+процент|10\s*%|15\s*%|20\s*%|вознаграждени|pul qabul|pul keladi|foiz|mukofot|o['’]?tkazib yubor|receive money|send it on|for a percent|commission)/i;
const MONEY_MULE_OBJECT_RE =
  /(перевод|деньги|сум|so['’]?m|sum|на карту|карта|karta|hisob|account|transfer|money|card)/i;

function shouldFlagMoneyMuleRecruitment(text: string): boolean {
  return hasUnsafeClauseDespiteSafetyContext(text, MONEY_MULE_CONTEXT_RE, MONEY_MULE_OBJECT_RE);
}

const ADVANCE_FEE_CONTEXT_RE =
  /(выигрыш|приз|лотере|наследств|компенсац|грант|пособ|виза|работа в (росси|коре)|корею|россию|хадж|умра|паломнич|тур|пут[её]вк|yutuq|sovrin|meros|lotereya|grant|viza|koreya|rossiya|haj|umra|tour|visa|inheritance|lottery|prize)/i;
const ADVANCE_FEE_PAYMENT_RE =
  /(налог|комисси[яю]|сбор|пошлин|залог|предоплат|аванс|страхов|обучени|провер|регистрац|оформлен|бронь|оплат|to['’]?lov|komissiya|soliq|garov|avans|sug['’]?urta|registration|fee|tax|deposit|prepay|processing)/i;
const ADVANCE_FEE_ACTION_RE =
  /(оплат(и|ите)|внес(и|ите)|перевед(и|ите)|заплат(и|ите)|отправь(те)?|пришл(и|ите)|to['’]?la(?:ng|sh(?:im)?)|o['’]?tkazing|yuboring|pay|transfer|send)/i;

function shouldFlagAdvanceFeePrizeInheritance(text: string): boolean {
  return (
    ADVANCE_FEE_CONTEXT_RE.test(text) &&
    ADVANCE_FEE_PAYMENT_RE.test(text) &&
    ADVANCE_FEE_ACTION_RE.test(text)
  );
}

const SOFT_CARD_CVV_ASK_RE =
  /(назов(и|ите)(?![а-яёa-z])|скаж(и|ите)(?![а-яёa-z])|продиктуй(те)?(?![а-яёa-z])|сообщ(и|ите)(?![а-яёa-z])|укажите(?![а-яёa-z])|введ(и|ите)(?![а-яёa-z])|скинь(те)?(?![а-яёa-z])|пришл(и|ите)(?![а-яёa-z])|отправь(те)?(?![а-яёa-z])|просят|просит|требуют|требует|попросил(?:и|а)?|просил(?:и|а)?|(?<![\p{L}\p{N}_])(?:ayt(?:ing|ishni)?|kirit(?:ing|ishni)?|yubor(?:ing|ishni)?|so['’]?ra(?:di|shdi|shyapti|yapti))(?![\p{L}\p{N}_])|\b(?:send|enter|tell|forward|reveal|share|show|give|provide|submit|ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?|want(?:ed|s|ing)?)\b)/iu;
const SOFT_CARD_CVV_OBJECT_RE =
  /(cvv|cvc|код безопасности|xavfsizlik kodi|security code|код.{0,20}(на обороте|с обратной стороны)|оборот.{0,20}карт|back of (the )?card|((три|3|уч|uch).{0,14}(цифр|рақам|raqam|xonali).{0,30}(карт|card|karta|оборот|orqa|back))|((карт|card|karta|оборот|orqa|back).{0,30}(три|3|уч|uch).{0,14}(цифр|рақам|raqam|xonali)))/i;

function shouldFlagSoftCardCvvRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previous = clauses[index - 1] ?? "";
    const carriesCvv = SOFT_CARD_CVV_OBJECT_RE.test(previous) && PRONOUN_REQUEST_RE.test(clause);
    const candidate = carriesCvv ? `${clause} CVV` : clause;
    return (
      SOFT_CARD_CVV_ASK_RE.test(candidate) &&
      SOFT_CARD_CVV_OBJECT_RE.test(candidate) &&
      !SENSITIVE_PIN_CVV_SAFETY_RE.test(candidate) &&
      !SENSITIVE_PIN_CVV_NEUTRAL_RE.test(candidate) &&
      !isGeneralSafetyClause(clause)
    );
  });
}

const SOFT_PIN_PASSWORD_OBJECT_RE =
  /(pin|пин|тайн.{0,12}код|секретн.{0,12}код|kod.{0,20}(ilova|bank)|bank.{0,20}kodi|maxfiy kod|ilova kodi|парол.{0,30}(банк|аккаунт|кабинет|прилож|telegram|oneid)|password.{0,30}(bank|account|app|telegram|oneid)|(банк|аккаунт|кабинет|прилож|telegram|oneid).{0,30}парол|(bank|account|app|telegram|oneid).{0,30}password)/i;

function shouldFlagSoftPinOrPasswordRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previous = clauses[index - 1] ?? "";
    const carriesPin =
      SOFT_PIN_PASSWORD_OBJECT_RE.test(previous) && PRONOUN_REQUEST_RE.test(clause);
    const candidate = carriesPin ? `${clause} PIN` : clause;
    return (
      SOFT_CARD_CVV_ASK_RE.test(candidate) &&
      SOFT_PIN_PASSWORD_OBJECT_RE.test(candidate) &&
      !SENSITIVE_PIN_CVV_SAFETY_RE.test(candidate) &&
      !SENSITIVE_PIN_CVV_NEUTRAL_RE.test(candidate) &&
      !isGeneralSafetyClause(clause)
    );
  });
}

const SENSITIVE_PIN_CVV_SAFETY_RE =
  /(?:не\s+(?:сообща|говори|называ|передава|показыва|отправля|вводи)|(?:do\s+not|don['’]?t|never|not\s+to)\s+(?:share|tell|send|show|give|enter|provide|submit)|(?:pin|cvv|cvc|пин).{0,35}(?:hech\s+kimga|aytmang|yubormang|kiritmang|ko['’]?rsatmang))/iu;
const SENSITIVE_PIN_CVV_NEUTRAL_RE =
  /(?:password\s+policy|change\s+(?:a|the|your)\s+password|create\s+(?:a|the|your)\s+password|requires?\s+(?:a\s+)?password\s+to\s+(?:sign|log)\s+in|(?:pin|cvv|cvc).{0,30}(?:remain|keep|should).{0,20}secret|what\s+is\s+(?:a\s+)?(?:pin|cvv|cvc))/iu;

const SCREEN_SHARE_REQUEST_RE =
  /(?:демонстр.{0,20}экран|покаж(?:и|ите|ать).{0,25}экран|поделит(?:есь|ься).{0,25}экран|(?:прос(?:ят|ит)|попросил(?:и|а)?|требу(?:ют|ет)).{0,35}(?:показать|включить).{0,25}экран|(?:дай(?:те)?|просят\s+дать).{0,25}доступ\s+к\s+экран|включ(?:и|ите).{0,25}(?:показ|трансляц).{0,15}экран|дай(?:те)?\s+удал[её]нн.{0,20}доступ.{0,30}(?:телефон|устройств|компьютер)|\bshare\b.{0,30}(?:your\s+|the\s+|phone\s+)?screen\b|let\s+(?:me|us)\s+see\s+(?:your\s+|the\s+)?screen\b|(?:ask(?:ed|s|ing)?|want(?:ed|s|ing)?|need(?:ed|s|ing)?).{0,35}screen\s+sharing|start\s+screen\s+sharing|give\s+(?:me\s+|us\s+)?remote\s+access.{0,30}(?:phone|device|computer)|allow\s+remote\s+(?:control|access).{0,30}(?:phone|device|computer)|(?:install|download|open|use|connect).{0,30}(?:anydesk|teamviewer|rustdesk|quick\s*support)|ekran(?:im|ingiz|ni)?.{0,30}(?:ko['’]?rsat(?:ing)?|ulash(?:ing)?|ko['’]?rmoqchi)|(?:telefon|qurilma)(?:ingiz|ga)?.{0,35}masofaviy\s+kirish.{0,20}ber(?:ing)?)/iu;
const SCREEN_SHARE_SAFETY_RE =
  /(?:не\s+(?:показыва|делись|делитесь|включай|включайте|давай|давайте|устанавливай|скачивай)|(?:do\s+not|don['’]?t|never|not\s+to)\s+(?:share|show|start|give|install|download|open|use|connect)|(?:ekran|masofaviy\s+kirish|anydesk|teamviewer|rustdesk).{0,35}(?:ko['’]?rsatmang|ulashmang|bermang|o['’]?rnatmang|yuklamang))/iu;

function shouldFlagScreenShareRequest(text: string): boolean {
  return splitRiskClauses(text).some(
    (clause) =>
      SCREEN_SHARE_REQUEST_RE.test(clause) &&
      !SCREEN_SHARE_SAFETY_RE.test(clause) &&
      !isGeneralSafetyClause(clause),
  );
}

const TRANSFER_DESTINATION_RE =
  /(?:(?:перевед(?:и|ите)|сделай(?:те)?\s+перевод|оплат(?:и|ите)|to['’]?lang|o['’]?tkazing|transfer|pay)\b.{0,60}(?:на\s+(?:эт(?:от|у)\s+)?(?:номер|карту)|по\s+номеру|qr|qr.?код|karta|raqam|hisob|card|number|wallet)|(?:перевед(?:и|ите)|оплат(?:и|ите)).{0,20}(?:оплат|плат[её]ж|деньг|сумм)|отправь(?:те)?\s+(?:мне\s+)?(?:перевод|деньги|сумму)|send\s+(?:me\s+)?(?:money|funds?|payment)|(?:make|complete)\s+(?:the|this)\s+payment|yuboring\s+(?:menga\s+)?(?:pul|to['’]?lov)|to['’]?lovni\s+qiling|(?:отправь(?:те)?|yuboring|send)\b.{0,25}(?:на\s+(?:карту|номер)|to\s+(?:the\s+|this\s+)?(?:card|number|wallet|account)|karta|hisob|wallet)|(?:просят|просит|попросил(?:и|а)?|просил(?:и|а)?|требуют|требует|велят).{0,45}(?:перевести|отправить|заплатить|оплатить).{0,30}(?:деньги|средства|сумму)|\b(?:ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b.{0,45}(?:(?:send|transfer|pay).{0,20}(?:money|funds?)|(?:a\s+)?money\s+transfer|payment)|(?:so['’]?ra(?:di|shdi|yapti)|talab\s+qil).{0,45}(?:pul|to['’]?lov).{0,30}(?:yubor|o['’]?tkaz|to['’]?la)|(?:pulni|pul|to['’]?lovni).{0,45}(?:o['’]?tkazish|yuborish|to['’]?lash)(?:ni)?.{0,45}(?:so['’]?ra(?:di|shdi|shyapti|yapti)|talab\s+qil)|(?:pulni|pul|to['’]?lovni).{0,25}(?:o['’]?tkaz(?:ing)?|yubor(?:ing)?|to['’]?la(?:ng)?)(?![\p{L}]))/iu;
const TRANSFER_SAFETY_RE =
  /(?:не\s+(?:плати|оплачивай|переводи|отправляй)|(?:do\s+not|don['’]?t|never|not\s+to)\s+(?:pay|make\s+(?:(?:a|the|this)\s+)?payment|send\s+(?:money|funds)|transfer)|(?:pul|to['’]?lov).{0,24}(?:yubormang|o['’]?tkazmang|to['’]?lamang))/iu;
const SAFE_ACCOUNT_TRANSFER_REQUEST_RE =
  /(?:(?:перевед\p{L}*|отправ\p{L}*|полож\p{L}*|перемест\p{L}*).{0,80}(?:деньг|средств|сумм).{0,60}безопасн.{0,20}(?:сч[её]т|карт)|(?:деньг|средств|сумм).{0,70}(?:перевед\p{L}*|отправ\p{L}*|полож\p{L}*|перемест\p{L}*).{0,60}безопасн.{0,20}(?:сч[её]т|карт)|(?:деньг|средств|сумм).{0,60}безопасн.{0,20}(?:сч[её]т|карт).{0,60}(?:перевед\p{L}*|отправ\p{L}*|полож\p{L}*|перемест\p{L}*)|(?:перевод|плат[её]ж).{0,60}(?:на\s+)?(?:безопасн\p{L}*\s+(?:сч[её]т|карт)|safe\s+account)|(?:накоплен|сбережен).{0,80}(?:защит|сохран).{0,80}(?:перевод|безопасн\p{L}*\s+сч[её]т)|(?:transfer|send|move|wire|deposit).{0,80}(?:money|funds).{0,60}(?:safe|secure)\s+account|(?:money|funds).{0,70}(?:transfer|send|move|wire|deposit).{0,60}(?:safe|secure)\s+account|(?:money|funds).{0,60}(?:safe|secure)\s+account.{0,60}(?:transfer|send|move|wire|deposit)|(?:transfer|payment).{0,60}(?:to\s+)?(?:a\s+)?(?:safe|secure)\s+account|(?:pul|mablag['’]?).{0,70}(?:o['’]?tkaz|yubor|ko['’]?chir).{0,60}xavfsiz\s+hisob|(?:o['’]?tkaz|yubor|ko['’]?chir).{0,70}(?:pul|mablag['’]?).{0,60}xavfsiz\s+hisob|(?:pul|mablag['’]?).{0,60}xavfsiz\s+hisob.{0,60}(?:o['’]?tkaz|yubor|ko['’]?chir)|xavfsiz\s+hisob.{0,60}(?:pul|mablag['’]?).{0,60}(?:o['’]?tkaz|yubor|ko['’]?chir)|(?:jamg['’]?arma|mablag['’]?).{0,80}(?:saqla|himoya).{0,80}xavfsiz\s+hisob|xavfsiz\s+hisob.{0,50}(?:kerak|talab).{0,50}(?:ayt|dey))/iu;
const SAFE_ACCOUNT_TRANSFER_RU_INFINITIVE_RE =
  /перевест\p{L}*.{0,80}(?:деньг|средств|сумм).{0,60}безопасн\p{L}*.{0,20}(?:сч[её]т|карт)/iu;
const PERSONAL_CARD_MONEY_CONTEXT_RE =
  /(?:donations?|funds?|money|payment|charity|пожертвован|средств|деньг|помощ|xayriya|ehson|yordam\s+(?:puli|mablag['’]?i)|mablag['’]?(?:lar)?|pul(?:i|ni)?)/iu;
const PERSONAL_CARD_DESTINATION_RE = /(?:personal\s+cards?|личн.{0,12}карт|shaxsiy.{0,12}karta)/iu;
const PERSONAL_CARD_TRANSFER_REQUEST_RE =
  /(?:(?:must|should|need(?:s)?\s+to|have\s+to|required\s+to|(?:is|are)\s+requested\s+to).{0,40}(?:be\s+)?(?:sent|send|transferred|transfer|paid|pay)|(?:нужно|надо|необходимо|требуется|просят).{0,35}(?:перевести|отправить|внести|оплатить)|(?:перевести|отправить|внести|оплатить).{0,35}(?:нужно|надо|необходимо|требуется|просят)|(?:yuboril(?:ishi|ish)|o['’]?tkazil(?:ishi|ish)|to['’]?lan(?:ishi|ish)|yuborish|o['’]?tkazish|to['’]?lash).{0,35}(?:kerak|lozim|shart|deyish|so['’]?ral|talab\s+qil)|(?:kerak|lozim|shart|so['’]?ral|talab\s+qil).{0,35}(?:yubor|o['’]?tkaz|to['’]?la))/iu;
const PERSONAL_CARD_TRANSFER_SAFETY_RE =
  /(?:\b(?:must|should)\s+not\s+be\s+(?:sent|transferred|paid)\b|\b(?:do\s+not|don['’]?t|never)\s+(?:send|transfer|pay)\b|\b(?:is|are)\s+not\s+required\s+to\s+(?:be\s+)?(?:sent|transferred|paid)\b|\b(?:do|does)\s+not\s+need\s+to\s+(?:be\s+)?(?:sent|transferred|paid)\b|\bneed\s+not\s+be\s+(?:sent|transferred|paid)\b|\bthere\s+is\s+no\s+need\s+to\s+(?:send|transfer|pay)\b|(?:не|нельзя)\s+(?:переводить|отправлять|вносить|оплачивать)|не\s+(?:переводите|отправляйте|вносите|оплачивайте)|(?:не\s+(?:нужно|надо|требуется|необходимо)|нет\s+необходимости).{0,28}(?:переводить|отправлять|вносить|оплачивать)|(?:kerak|lozim|shart)\s+emas|(?:talab\s+qilinmaydi|so['’]?ralmaydi)|(?:yubor|o['’]?tkaz|to['’]?la).{0,24}(?:mang|kerak\s+emas|lozim\s+emas|shart\s+emas))/iu;
const PRESSURED_TRANSFER_RE =
  /(?:\bpressur(?:e|es|ed|ing)\s+(?:me|us|you)\s+to\b.{0,60}\b(?:transfer|send|pay)\b|\b(?:transfer|send|pay)\b.{0,60}\bunder\s+pressure\b)/iu;
const TRANSFER_SCAM_CONTEXT_RE =
  /(?:неизвестн|незнаком|чуж(?:ой|ая|ую)|треть(?:ему|ей)\s+лиц|личн.{0,12}карт|(?:другую|новую)\s+карт|срочно|немедленно|давят|угрожа|застав|никому\s+не\s+говор|секрет|ссылк|скриншот|из\s+(?:чата|мессенджер)|безопасн.{0,20}(?:сч[её]т|карт)|приз|выигрыш|комисси|разблок|возврат.{0,20}(?:на\s+друг|через\s+карт)|unknown|stranger|third[-\s]?party|personal\s+card|(?:another|new)\s+card|urgent|immediately|pressure|threat|forc(?:e|ed|ing)|do\s+not\s+tell|keep\s+it\s+secret|link|screenshot|from\s+(?:a\s+)?(?:chat|messenger)|safe\s+account|prize|winnings?|fee|unlock|notanish|begona|uchinchi\s+shaxs|shaxsiy\s+karta|(?:boshqa|yangi)\s+karta|zudlik|darhol|bosim|tahdid|majburl|hech\s+kimga\s+aytma|havola|skrinshot|chatdan|xavfsiz\s+hisob|sovrin|yutuq|komissiya)/iu;
const SCAM_CONTEXT_TRANSFER_REQUEST_RE =
  /(?:(?:send|transfer|pay).{0,55}(?:money|funds?|payment|personal\s+card)|(?:money|funds?|payment|personal\s+card).{0,55}(?:send|transfer|pay)|(?:перевед|отправ|оплат).{0,55}(?:деньг|средств|сумм|личн.{0,12}карт)|(?:деньг|средств|сумм|личн.{0,12}карт).{0,55}(?:перевед|отправ|оплат)|(?:pul|to['’]?lov|shaxsiy\s+karta).{0,65}(?:o['’]?tkaz|yubor|to['’]?la)|(?:o['’]?tkaz|yubor|to['’]?la).{0,65}(?:pul|to['’]?lov|shaxsiy\s+karta))/iu;
const TRANSFER_ARTIFACT_CAPABILITY_RE =
  /^(?:can|could|may|should)\s+i\s+(?:send|upload|share|show)\s+(?:you\s+)?(?:a\s+)?(?:screenshot|screen\s*shot|image|photo)\s+of\s+(?:a\s+)?(?:payment|money\s+transfer|transfer)\s+request[\s?.!]*$/iu;
const ORDINARY_TRANSFER_CONTEXT_RE =
  /(?:обычн\p{L}*\s+(?:зарплат|сч[её]т)|зарплатн\p{L}*\s+ведомост|по\s+(?:подписанн\p{L}*\s+)?договор|аренд\p{L}*|за\s+(?:ужин|такси|покупк)|normal\s+(?:salary|payroll|invoice|company\s+bill)|under\s+(?:our\s+)?(?:signed\s+)?(?:contract|lease)|scheduled\s+(?:salary|payroll)|shared\s+(?:bill|dinner|taxi)|store\s+checkout|odatiy\s+(?:maosh|hisob)|maosh\s+vedomost|rasmiy\s+hisob-faktura|shartnoma\s+bo['’]?yicha|ijara\s+to['’]?lovi|ovqat|taksi)/iu;

const SAFETY_BASE_CLAUSE_SPLIT_RE =
  /[,.!?;،:\u2013\u2014\n]+|\s+(?:but|however|then|and\s+now|after\s+that|after\s+which|но|однако|зато|затем|потом|после\s+чего|теперь|а\s+(?:сегодня|теперь|потом)|lekin|biroq|keyin|va\s+endi)\s+|(?<!(?:not|don['’]?t|never|shouldn['’]?t|mustn['’]?t|can['’]?t|cannot|won['’]?t))\s+yet\s+/iu;
const SAFETY_COORDINATION_RE = /\s+(?:and|и|va)\s+/giu;
const SAFETY_COORDINATION_ACTION_RE =
  /(?:send|share|reveal|provide|submit|tell|enter|install|download|transfer|pay|scan|give|show|forward|read|open|пришл|присыл|отправ|сообщ|говор|скаж|назов|переда|введ|установ|скач|перевед|оплат|скан|покаж|открой|yubor|jo['’]?nat|ayt|kirit|ber|o['’]?rnat|yukla|o['’]?tkaz|to['’]?la|skaner|ko['’]?rsat|och)/giu;

/**
 * Split a coordinating conjunction only when its following coordination
 * segment contains another action. This preserves object lists such as
 * "send a note and a passport photo", while a long neutral bridge cannot hide
 * a later action. Both regular expressions are scanned once, so the work stays
 * linear in the clause length.
 */
function splitCoordinatedRiskClause(clause: string): string[] {
  const actions = Array.from(
    clause.matchAll(SAFETY_COORDINATION_ACTION_RE),
    (match) => match.index,
  );
  const coordinations = Array.from(clause.matchAll(SAFETY_COORDINATION_RE));
  if (actions.length === 0 || coordinations.length === 0) return [clause];

  const parts: string[] = [];
  let partStart = 0;
  let actionCursor = 0;
  for (let index = 0; index < coordinations.length; index += 1) {
    const match = coordinations[index];
    const delimiterEnd = match.index + match[0].length;
    const nextDelimiterStart = coordinations[index + 1]?.index ?? clause.length;

    while (actionCursor < actions.length && actions[actionCursor] < delimiterEnd) {
      actionCursor += 1;
    }
    if (actionCursor >= actions.length || actions[actionCursor] >= nextDelimiterStart) continue;

    parts.push(clause.slice(partStart, match.index));
    partStart = delimiterEnd;
  }
  parts.push(clause.slice(partStart));
  return parts;
}

function splitRiskClauses(text: string): string[] {
  return text
    .replace(/,?\s*(?:please|пожалуйста|iltimos)\s*,?/giu, " ")
    .split(SAFETY_BASE_CLAUSE_SPLIT_RE)
    .flatMap(splitCoordinatedRiskClause)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

const PRONOUN_REQUEST_RE =
  /(?:\bask(?:ed|s|ing)?\b.{0,14}\bfor\s+it\b|\b(?:want(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?)\b.{0,14}\bit\b|\b(?:send|forward|share|tell|read(?:\s+out)?|give|show|reveal|provide|submit)\s+it\b|\b(?:told|asked|instructed)\b.{0,22}\b(?:send|forward|share|tell|read(?:\s+out)?|give|show|reveal|provide|submit)\s+it\b|(?:его|е[её]|их|это)\s+(?:просят|просит|попросил(?:и|а)?|требуют|требует).{0,22}(?:отправить|прислать|назвать|сообщить|передать|показать|открыть|сканировать)|(?:назов(?:и|ите)|скаж(?:и|ите)|сообщ(?:и|ите)|пришл(?:и|ите)|отправь(?:те)?|передай(?:те)?|покаж(?:и|ите)|открой(?:те)?)\s+(?:его|е[её]|их|это)(?:\s+мне)?|(?:uni|ularni)\s+(?:menga\s+)?(?:ayt(?:ing)?|yubor(?:ing)?|jo['’]?nat(?:ing)?|ko['’]?rsat(?:ing)?|och(?:ing)?|skaner(?:lang|lash))|(?:uni|ularni).{0,24}(?:so['’]?ra(?:di|shdi|shyapti|yapti)|talab\s+qil))/iu;

const GENERAL_SAFETY_ACTION_RE =
  /(?:(?:do\s+not|don['’]?t|never|should\s+not|shouldn['’]?t|must\s+not|mustn['’]?t)\s+(?:(?:ever|yet)\s+)?(?:send|share|reveal|provide|submit|tell|enter|install|download|transfer|pay|scan|give|show|forward|read)|never\b.{0,35}\b(?:send|share|reveal|provide|submit|tell|enter|install|download|transfer|pay|scan|give|show|forward|read)|(?:unsafe|dangerous|risky)\s+to\s+(?:send|share|reveal|provide|submit|tell|enter|install|download|transfer|pay|scan|give|show|forward|read)|avoid\s+(?:sending|sharing|revealing|providing|submitting|telling|entering|installing|downloading|transferring|paying|scanning|giving|showing|forwarding|reading)|(?:не|никогда\s+не|нельзя)\s+(?:отправля|присыла|сообща|говори|называ|передава|показыва|вводи|устанавлива|скачива|переводи|оплачива|сканиру)|(?:опасно|нельзя)\s+(?:отправлять|присылать|сообщать|передавать|показывать|вводить|устанавливать|скачивать|переводить|оплачивать|сканировать)|(?:yubormang|aytmang|kiritmang|bermang|ko['’]?rsatmang|o['’]?rnatmang|yuklamang|o['’]?tkazmang|to['’]?lamang|skanerlamang))/iu;

function isGeneralSafetyClause(clause: string): boolean {
  return GENERAL_SAFETY_ACTION_RE.test(clause);
}

function adjacentRiskWindows(text: string): string[] {
  const clauses = splitRiskClauses(text);
  return clauses.map((clause, index) =>
    [clauses[index - 1], clause, clauses[index + 1]].filter(Boolean).join(". "),
  );
}

const AUTHORITY_DANGEROUS_ACTOR_RE =
  /(?:налогов|полици|мвд|фсб|прокуратур|следо(?:в)?ател|оперативник|участков|правоохранител|госорган|госслужб|сотрудник.{0,20}(?:ведомств|орган|служб)|tax\s+(?:office|authority|inspector)|law[-\s]+enforcement|police|prosecutor|detective|federal\s+agent|security\s+agent|(?<!\p{L})(?:officer|fbi)(?!\p{L})|[iі]nvesti?gator|government\s+official|security\s+service|sol(?:iq|i|q)chi|soliq|tergovchi|prokuratura|profilaktika\s+inspektor\p{L}*|ichki\s+ishlar|huquq.{0,20}(?:organ|muhofaza)|терговчи|иив|прокурор(?:ман|дан|миз)?|профилактика\s+инспектор\p{L}*|ички\s+ишлар|ҳуқуқ.{0,20}(?:орган|муҳофаза)|(?<![\p{L}\p{N}_])iib(?:b|dan|danman|danmiz|xodimi|xodimlari)?(?![\p{L}\p{N}_]))/iu;
const AUTHORITY_DANGEROUS_DIRECTIVE_RE =
  /(?:приказ|вел(?:ел|ит|ят)|застав|принужд|требу|угрожа|шантаж|уголовн.{0,20}дел|иначе.{0,45}(?:посад|арест|обвин|уголовн|дело)|(?:или|либо).{0,35}(?:посад|арест|обвин|уголовн|дело)|если.{0,80}(?:не|иначе).{0,80}(?:посад|арест|обвин|уголовн)|(?:долж|обязан)\p{L}*.{0,35}(?:сделать|забрать|отнести|оставить|сломать|сжечь|поджечь)|\b(?:order(?:ed|s|ing)?|forc(?:e|ed|es|ing)|instruct(?:ed|s|ing)?|demand(?:ed|s|ing)?|threaten(?:ed|s|ing)?|told|said|says)\b|\bmust\b(?!\s+not\b)|\bgo\s+to\s+jail\b|\bface\s+arrest\b|(?:or|otherwise).{0,40}(?:arrest|jail|criminal\s+case)|put\s+(?:me|you|us)\s+in\s+jail|unless.{0,80}arrest|arrest.{0,80}\bunless\b|\bcriminal\s+case\b|\bor\s+else\b|avoid\s+being\s+accused|buyur|majburl|talab\s+qil|tahdid|jinoiy.{0,20}ish|ish\s+och|bo['’]?lmasa|aks\s+holda|qama|талаб\s+қил|мажбурл|буйур|таҳдид|жиноий.{0,20}иш|иш\s+оч|бўлмаса|булмаса|акс\s+ҳолда|қама)/iu;
const AUTHORITY_DANGEROUS_FIRE_RE =
  /(?:(?:п[оo]дж(?:ечь|иг|ог)|п[оo]дож(?:г|ж)\p{L}*|сжечь|взорвать|устроить.{0,20}пожар|set.{0,12}(?:fire|alight)|burn\s+down|torch|blow\s+up|yoqib\s+yubor|yoq(?:masa|ish|moq|ib)?|o['’]?t\s+qo['’]?y|portlat).{0,80}(?:заправ|азс|zapravk|машин|автомоб|здани|офис|школ|магазин|склад|дом|gas\s+station|petrol\s+station|car|vehicle|building|office|school|shop|warehouse|uy|bino|maktab|do['’]?kon|ombor)|(?:заправ|азс|zapravk|машин|автомоб|здани|офис|школ|магазин|склад|дом|gas\s+station|petrol\s+station|car|vehicle|building|office|school|shop|warehouse|uy|bino|maktab|do['’]?kon|ombor|yoqilg['’]?i\s+shoxobcha).{0,80}(?:п[оo]дж|п[оo]дож(?:г|ж)\p{L}*|сжечь|взорвать|set.{0,12}fire|burn|torch|blow\s+up|yoq|o['’]?t\s+qo['’]?y|portlat))/iu;
const AUTHORITY_DANGEROUS_PACKAGE_RE =
  /(?:(?:отнес|остав|полож|спряч|перенес|достав|carry|leave|place|hide|deliver|olib\s+bor|tashlab\s+ket|qoldir|qo['’]?y|yashir).{0,55}(?:пакет|сумк|рюкзак|коробк|посылк|package|bag|backpack|box|paket|sumka|quti).{0,80}(?:заправ|азс|подъезд|школ|вокзал|аэропорт|метро|здани|людн|public\s+place|gas\s+station|petrol\s+station|entrance|school|station|airport|building|yoqilg['’]?i\s+shoxobcha|maktab|bekat|bino)|(?:пакет|сумк|рюкзак|коробк|посылк|package|bag|backpack|box|paket|sumka|quti).{0,80}(?:заправ|азс|подъезд|школ|вокзал|аэропорт|метро|здани|людн|public\s+place|gas\s+station|petrol\s+station|entrance|school|station|airport|building|yoqilg['’]?i\s+shoxobcha|maktab|bekat|bino).{0,80}(?:отнес|остав|полож|спряч|перенес|достав|carry|leave|place|hide|deliver|olib\s+bor|tashlab\s+ket|qoldir|qo['’]?y|yashir)|(?:пакет|сумк|рюкзак|package|bag|backpack|paket|sumka).{0,70}(?:не\s+открыва|никому\s+не\s+говор|don['’]?t\s+open|tell\s+no\s+one|ochma|hech\s+kimga\s+aytma))/iu;
const AUTHORITY_DANGEROUS_DAMAGE_RE =
  /(?:(?:слом|разб|повред|перерез|перереж|отключ|вывед.{0,15}строя|damage|destroy|smash|cut|disable|buz|sindir|shikast|kes|uzib\s+tashla|(?<!\p{L})уз(?:иш|иб\s+ташла)\p{L}*|буз|синдир|кес).{0,70}(?:оборудован|техник|камер|кабел|провод|трубопровод|связ|электр|сигнализац|equipment|machine|camera|cable|wire|pipeline|communications?|power|alarm|uskuna|kamera|kabel|sim|quvur|signalizatsiya|ускуна|сим|қувур)|(?:оборудован|техник|камер|кабел|equipment|machine|camera|cable|uskuna|kamera|kabel|ускуна|сим).{0,50}(?:uzib\s+tashla|buz|sindir|shikast|kes|уз(?:иш|иб\s+ташла)\p{L}*|буз|синдир|кес))/iu;
const AUTHORITY_DANGEROUS_PACKAGE_ORDER_RE =
  /(?:(?:пакет|сумк|рюкзак|коробк|package|bag|backpack|box|paket|sumka|quti).{0,55}(?:отнес|отнести|достав|остав|полож|carry|take|leave|deliver|olib\s+bor|qoldir|tashlab\s+ket).{0,65}(?:вокзал|станци|школ|метро|аэропорт|подъезд|station|school|airport|public\s+place|maktab|bekat|yoniga)|(?:вокзал|станци|школ|метро|аэропорт|подъезд|station|school|airport|public\s+place|maktab|bekat|yoniga).{0,55}(?:пакет|сумк|рюкзак|коробк|package|bag|backpack|box|paket|sumka|quti).{0,45}(?:отнес|остав|полож|carry|take|leave|deliver|olib\s+bor|qoldir|tashlab\s+ket))/iu;
const AUTHORITY_DANGEROUS_SAFETY_RE =
  /(?:(?<!\p{L})(?:не|никогда\s+не|нельзя)\s+(?:поджиг|сжиг|взрыва|оставля|перенос|лома|поврежда|перереза)|(?:do\s+not|don['’]?t|never)\s+(?:set\s+fire|burn|carry|leave|place|damage|destroy|cut|disable)|(?:yoqmang|o['’]?t\s+qo['’]?ymang|tashlab\s+ketmang|buzmang|sindirmang|ёқманг|ўт\s+қўйманг|ташлаб\s+кетманг|бузманг|синдирманг))/iu;
const AUTHORITY_DANGEROUS_SAFETY_NOTICE_RE =
  /(?:предупрежден|предупрежда|памятк|официальн.{0,25}(?:совет|рекомендац)|safety\s+notice|safety\s+advisory|official\s+warning|warning\s+(?:notice|article)|ogohlantirish|огоҳлантириш|xavfsizlik.{0,20}(?:eslatma|tavsiya)|хавфсизлик.{0,20}(?:эслатма|тавсия))/iu;
const LEGAL_AUTHORITY_PUBLIC_SAFETY_RE =
  /(?:(?:police|law[-\s]+enforcement).{0,55}(?:warn|advis|remind).{0,100}(?:never|do\s+not|don['’]?t|not\s+to|avoid)|(?:полици|мвд|правоохранител).{0,55}(?:предупрежд|напомина|совету).{0,100}(?:не\s+|никогда\s+не|нельзя|избег)|(?:полици|мвд|ииб|ички\s+ишлар|прокуратура).{0,55}(?:огоҳлантир|эслат).{0,100}(?:манг|қилманг)|(?:iib|ichki\s+ishlar|prokuratura).{0,55}(?:ogohlantir|eslat).{0,100}(?:-?mang|qilmang))/iu;
const NEUTRAL_LAW_ENFORCEMENT_NEWS_RE =
  /(?:(?:police|law[-\s]+enforcement|detective|investigator|prosecutor).{0,45}(?:report|reports|reported|say|says|said|announced|told\s+reporters).{0,90}(?:a\s+|the\s+)?suspect.{0,110}(?:(?:was|has\s+been)\s+(?:arrested|detained)|set\s+fire|damaged)|police.{0,30}(?:arrested|detained).{0,35}(?:a\s+|the\s+)?(?:man|woman|person|suspect).{0,110}(?:set\s+fire|burned|damaged)|(?:полици|мвд|правоохранител).{0,35}(?:сообщ|заяв|рассказ).{0,90}(?:подозреваем\p{L}*|мужчин\p{L}*|женщин\p{L}*).{0,90}(?:задерж|арестован|подж[её]г)|(?:в\s+новост|новост).{0,45}(?:полици|мвд).{0,70}(?:задерж|арест).{0,90}(?:подж[её]г|поджог)|(?:в\s+полици|полици).{0,35}(?:сообщ|заяв).{0,100}(?:мужчин\p{L}*|подозреваем\p{L}*).{0,100}(?:задерж|арестован|подж[её]г)|(?:iib|ichki\s+ishlar).{0,35}(?:xabar|ma['’]?lum).{0,90}(?:gumondor|shubhali).{0,90}(?:ushlandi|hibsga\s+olindi)|(?:ииб|ички\s+ишлар).{0,35}(?:хабар|маълум).{0,90}(?:гумондор|шубҳали).{0,90}(?:ушланди|ҳибсга\s+олинди))/iu;
const LEGAL_NEUTRAL_PUBLIC_LIABILITY_RE =
  /(?:(?:мвд|полици|правоохранител).{0,45}предупрежд.{0,100}за\s+(?:поджог|поврежден|нарушен).{0,70}(?:грозит|предусмотрен).{0,35}(?:уголовн|административн).{0,20}(?:ответствен|наказан)|(?:police|law[-\s]+enforcement).{0,45}(?:warn|remind).{0,100}(?:arson|damage|offence).{0,70}(?:criminal|legal)\s+(?:liability|penalty))/iu;
const LAW_ENFORCEMENT_CONTACT_INFO_RE =
  /(?:(?:the\s+)?police\s+emergency\s+number\s+is\s+\d{2,5}|official\s+(?:notice|website|page).{0,45}(?:lists?|shows?|gives?)\s+\d{2,5}.{0,35}police\s+(?:number|contact)|(?:номер\s+(?:полиции|милиции)|телефон\s+полиции)\s*[:—-]?\s*\d{2,5}|(?:полиция|милиция)\s+рақами\s*[:—-]?\s*\d{2,5}|(?:politsiya|militsiya)\s+raqami\s*[:—-]?\s*\d{2,5})/iu;
const LAW_ENFORCEMENT_EDUCATIONAL_EXAMPLE_RE =
  /(?:(?:police|law[-\s]+enforcement).{0,40}(?:shared|gave|provided).{0,40}(?:an?\s+)?(?:example\s+threat|threat\s+example)|(?:полици|мвд|правоохранител).{0,40}(?:привел\p{L}*|показал\p{L}*|опубликовал\p{L}*).{0,40}пример\p{L}*.{0,20}угроз\p{L}*)/iu;
const LAW_ENFORCEMENT_NEUTRAL_LEAD_RE =
  /^(?:(?:полици\p{L}*|мвд|правоохранител\p{L}*).{0,24}(?:сообщ\p{L}*|заяв\p{L}*|рассказ\p{L}*|предупрежд\p{L}*)|(?:в\s+)?новост\p{L}*.{0,24}(?:сказан\p{L}*|сообщ\p{L}*)|(?:police|law[-\s]+enforcement).{0,24}(?:report\p{L}*|say|says|said|announce\p{L}*|warn\p{L}*)|(?:iib|ichki\s+ishlar).{0,24}(?:xabar\p{L}*|ma['’]?lum\p{L}*|ogohlantir\p{L}*))$/iu;
const LEGAL_LIVE_COERCION_RE =
  /(?:(?:если|иначе|за\s+отказ|а\s+то).{0,100}(?:не\s+)?(?:перевед|оплат|отправ|сообщ|назов|введ).{0,100}(?:арест|посад|уголовн|суд)|(?:перевед|оплат|отправ|сообщ|назов|введ).{0,80}(?:иначе|или|а\s+то).{0,80}(?:арест|посад|уголовн|суд)|(?:if|unless).{0,100}(?:transfer|pay|send|share|tell|enter).{0,100}(?:arrest|jail|criminal\s+case|lawsuit)|(?:transfer|pay|send|share|tell|enter).{0,80}(?:or|otherwise).{0,80}(?:arrest|jail|criminal\s+case|lawsuit)|(?:agar|bo['’]?lmasa|aks\s+holda).{0,100}(?:o['’]?tkaz|to['’]?la|yubor|ayt|kirit).{0,100}(?:qama|jinoiy|sud)|(?:агар|бўлмаса|акс\s+ҳолда).{0,100}(?:ўтказ|тўла|юбор|айт|кирит).{0,100}(?:қама|жиноий|суд))/iu;
const AUTHORITY_DANGEROUS_CONDITIONAL_THREAT_RE =
  /(?:если.{0,45}(?:не|иначе).{0,80}(?:арест|посад|уголовн)|if.{0,45}(?:do\s+not|don['’]?t)|unless.{0,80}arrest|yoqmasa|bajarmasang|aks\s+holda|qama)/iu;
const AUTHORITY_DANGEROUS_EDUCATIONAL_RE =
  /(?:учебн.{0,20}(?:пример|материал)|uchebn.{0,20}(?:primer|material)|памятк|pamyatk|инструктаж|instruktazh|security\s+training|training\s+example|awareness\s+material|o['’]?quv.{0,20}(?:misol|material))/iu;
const AUTHORITY_DANGEROUS_HYPOTHETICAL_RE =
  /(?:якобы.{0,90}(?:так\s+действуют\s+мошенник|пример)|(?:может|могут)\s+(?:приказ|застав|потреб)|fake.{0,35}(?:may|might|can)\s+(?:order|force|demand)|(?:may|might|can)\s+(?:order|force|demand).{0,35}(?:fake|scammer)|soxta.{0,45}(?:buyur|majburl|talab).{0,35}mumkin|(?:buyur|majburl|talab).{0,35}mumkin)/iu;
const AUTHORITY_DANGEROUS_EDUCATIONAL_FOLLOWUP_RE =
  /(?:якобы|может|могут|fake|may|might|can|soxta|mumkin)/iu;

function isAuthorityDangerEducationalClause(clause: string): boolean {
  return (
    AUTHORITY_DANGEROUS_EDUCATIONAL_RE.test(clause) ||
    AUTHORITY_DANGEROUS_HYPOTHETICAL_RE.test(clause)
  );
}

function shouldFlagAuthorityCoercedDangerousAct(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((actionClause, index) => {
    const hasDangerousAct =
      AUTHORITY_DANGEROUS_FIRE_RE.test(actionClause) ||
      AUTHORITY_DANGEROUS_PACKAGE_RE.test(actionClause) ||
      AUTHORITY_DANGEROUS_PACKAGE_ORDER_RE.test(actionClause) ||
      AUTHORITY_DANGEROUS_DAMAGE_RE.test(actionClause);
    if (
      !hasDangerousAct ||
      (AUTHORITY_DANGEROUS_SAFETY_RE.test(actionClause) &&
        !AUTHORITY_DANGEROUS_CONDITIONAL_THREAT_RE.test(actionClause)) ||
      NEUTRAL_LAW_ENFORCEMENT_NEWS_RE.test(actionClause) ||
      isAuthorityDangerEducationalClause(actionClause) ||
      (AUTHORITY_DANGEROUS_EDUCATIONAL_RE.test(clauses[index - 1] ?? "") &&
        AUTHORITY_DANGEROUS_EDUCATIONAL_FOLLOWUP_RE.test(actionClause))
    ) {
      return false;
    }

    const contextWindow = clauses
      .slice(Math.max(0, index - 2), Math.min(clauses.length, index + 3))
      .filter((clause) => !isAuthorityDangerEducationalClause(clause))
      .join(". ");
    return (
      AUTHORITY_DANGEROUS_ACTOR_RE.test(contextWindow) &&
      AUTHORITY_DANGEROUS_DIRECTIVE_RE.test(contextWindow)
    );
  });
}

const VIOLENCE_THREAT_ACTION_RE =
  /(?:(?<![\p{L}\p{N}_])(?:я|мы)(?![\p{L}\p{N}_]).{0,32}(?:убью|убь[её]м|изобью|изобь[её]м|побью|побь[её]м|зарежу|зарежем|порежу|порежем).{0,20}(?:тебя|вас|твою?\s+(?:семью|ребёнка)|вашу?\s+(?:семью|ребёнка))|(?<![\p{L}\p{N}_])(?:я|мы)(?![\p{L}\p{N}_]).{0,32}(?:сломаю\s+(?:тебе|вам)\s+(?:ног|рук)|сожгу\s+(?:тебя|вас|твой|ваш))|(?:убью|убь[её]м|изобью|изобь[её]м|побью|побь[её]м|зарежу|зарежем|порежу|порежем).{0,20}(?:тебя|вас)|(?:тебя|вас|тебе|вам).{0,24}(?:убью|убь[её]м|изобью|изобь[её]м|побью|побь[её]м|зарежу|зарежем|порежу|порежем)|\b(?:i|we)\b.{0,20}(?:will|'ll|am\s+going\s+to|are\s+going\s+to).{0,12}(?:beat|kill|hurt|stab)\s+(?:you|your\s+(?:family|child))|(?:seni|sizni).{0,24}(?:o['’]?ldir(?:aman|amiz)|o['’]?ldirib\s+tashla(?:yman|ymiz)|ur(?:aman|amiz)|urib\s+tashla(?:yman|ymiz)|kaltaklay(?:man|miz)|do['’]?pposlay(?:man|miz)|pichoqlay(?:man|miz))|(?:o['’]?ldir(?:aman|amiz)|o['’]?ldirib\s+tashla(?:yman|ymiz)|ur(?:aman|amiz)|urib\s+tashla(?:yman|ymiz)|kaltaklay(?:man|miz)|do['’]?pposlay(?:man|miz)|pichoqlay(?:man|miz)).{0,20}(?:seni|sizni)|(?:сени|сизни).{0,24}(?:ўлдир(?:аман|амиз)|улдир(?:аман|амиз)|(?:ўлдириб|улдириб)\s+ташла(?:йман|ймиз)|ур(?:аман|амиз)|уриб\s+ташла(?:йман|ймиз)|калтаклай(?:ман|миз)|дўппослай(?:ман|миз)|дуппослай(?:ман|миз)|пичоқлай(?:ман|миз)))/iu;
const VIOLENCE_THREAT_EXTENDED_ACTION_RE =
  /(?:(?:я|мы).{0,24}(?:застрел|пристрел|утопл|закопа|покалеч|сожг|сожж|выбью.{0,12}зуб|сломаю\s+(?:тебе|вам)\s+шею).{0,24}(?:тебя|вас|твой|ваш)?|(?:тебя|вас|тебе|вам).{0,24}(?:застрел|пристрел|утопл|закопа|покалеч|выбью.{0,12}зуб|сломаю.{0,12}шею)|(?<!\p{L})(?:застрелю|пристрелю|утоплю|покалечу|сломаю|сломаем).{0,18}(?:тебе|вам)?.{0,12}(?:шею)?(?!\p{L})|(?:сожг|сожж)\p{L}*.{0,20}(?:твой|ваш).{0,12}(?:дом|квартир)|\b(?:i|we)\b.{0,18}(?:will|'ll).{0,18}(?:shoot\s+you|break\s+your\s+neck|make\s+you\s+disappear|cut\s+your\s+throat|burn\s+your\s+house\s+down|cripple\s+you)|\bi(?:['’]?m|\s+am)\s+(?:gonna|going\s+to)\s+(?:shoot\s+you|cut\s+your\s+throat|kill\s+you|cripple\s+you)|(?:seni|sizni).{0,24}(?:ot(?:aman|amiz)|otib\s+tashla(?:yman|ymiz)|yo['’]?q\s+qil(?:aman|amiz)|mayib\s+qil(?:aman|amiz))|(?:oyog['’]?ingni|qo['’]?lingni|bo['’]?yningni).{0,24}sindir(?:aman|amiz)|(?:uyingni|uyingizni).{0,24}yoqib\s+yubor(?:aman|amiz)|(?:сени|сизни).{0,24}(?:от(?:аман|амиз)|отиб\s+ташла(?:йман|ймиз)|йўқ\s+қил(?:аман|амиз)|йук\s+кил(?:аман|амиз)|майиб\s+қил(?:аман|амиз))|(?:оёғингни|оёгингни|қўлингни|кулингни|бўйнингни|буйнингни).{0,24}синдир(?:аман|амиз)|(?:уйингни|уйингизни).{0,24}ёқиб\s+юбор(?:аман|амиз))/iu;
const VIOLENCE_REPORTED_THREAT_RE =
  /(?:(?:он|она|они).{0,30}(?:угрожа|обеща|говор|пиш).{0,45}(?:убь|зареж|изобь|побь|застрел|пристрел|утоп|выбь).{0,24}(?:меня|нас)|(?:угрожа|обеща).{0,40}(?:избить|убить|зарезать|застрелить|утопить)|(?:he|she|they).{0,30}(?:say|says|said|threaten|threatens|threatened|promise|promises|promised).{0,45}(?:kill|beat|stab|shoot|hurt|cut).{0,20}(?:me|us)|(?:threaten|threatens|threatened).{0,30}(?:to\s+)?(?:kill|beat|stab|shoot|hurt|cut).{0,20}(?:me|us)|(?:meni|bizni).{0,35}(?:pichoqlash|o['’]?ldirish|urish|otish|kaltaklash).{0,35}(?:qo['’]?rqit|tahdid)|(?:qo['’]?rqit|tahdid).{0,35}(?:pichoqlash|o['’]?ldirish|urish|otish|kaltaklash)|(?:мени|бизни).{0,35}(?:пичоқлаш|ўлдириш|улдириш|уриш|отиш|калтаклаш).{0,35}(?:қўрқит|куркит|таҳдид))/iu;
const VIOLENCE_REPORTED_EXTENDED_THREAT_RE =
  /(?:(?:он|она|они).{0,35}(?:пиш|говор|обеща|угрожа).{0,55}(?:сожг|сожж).{0,24}(?:мой|наш).{0,14}(?:дом|квартир)|(?:he|she|they).{0,35}(?:say|says|said|promise|promises|promised|threaten|threatens|threatened).{0,55}(?:burn).{0,24}(?:my|our).{0,14}(?:home|house)|(?<!\p{L})(?:u|ular)(?!\p{L}).{0,35}(?:(?:va['’]?da\s+qil|ayt|yoz|tahdid).{0,55}(?:meni|bizni).{0,30}(?:otish|o['’]?ldirish|urish|pichoqlash)|(?:meni|bizni).{0,30}(?:otish|o['’]?ldirish|urish|pichoqlash).{0,35}(?:va['’]?da\s+qil|ayt|yoz|tahdid))|(?<!\p{L})(?:у|улар)(?!\p{L}).{0,35}(?:(?:ваъда\s+қил|ваъда\s+кил|айт|ёз|таҳдид).{0,55}(?:мени|бизни).{0,30}(?:отиш|ўлдириш|улдириш|уриш|пичоқлаш)|(?:мени|бизни).{0,30}(?:отиш|ўлдириш|улдириш|уриш|пичоқлаш).{0,35}(?:ваъда\s+қил|ваъда\s+кил|айт|ёз|таҳдид)))/iu;
const VIOLENCE_CONDITIONAL_EXTORTION_RE =
  /(?:(?:заплат|перевед|отправ).{0,35}(?:иначе|а\s+то).{0,45}(?:перелом|сломают|изобьют|покалечат|убьют|зарежут)|(?:иначе|а\s+то).{0,45}(?:перелом|сломают|изобьют|покалечат|убьют|зарежут)|(?:pay|transfer|send).{0,35}(?:or|otherwise).{0,45}(?:break|smash|cripple|beat|kill|stab).{0,20}(?:your\s+)?(?:legs?|arms?|you)|(?:pul\s+ber|to['’]?la|o['’]?tkaz).{0,35}(?:bo['’]?lmasa|aks\s+holda).{0,45}(?:oyog|qo['’]?l|sindir|ur|o['’]?ldir)|(?:пул\s+бер|тўла|ўтказ).{0,35}(?:бўлмаса|акс\s+ҳолда).{0,45}(?:оёқ|қўл|синдир|ур|ўлдир))/iu;
const VIOLENCE_THREAT_LOCATION_RE =
  /(?:приед(?:у|ем|ут)|прид(?:у|ем|ут)|найд(?:у|ем|ут)|вычисл(?:ю|им)|(?:знаю|знаем).{0,24}(?:твой|ваш)\s+адрес|(?:знаю|знаем).{0,24}где\s+(?:ты|вы)\s+жив|твой\s+адрес.{0,28}(?:у\s+меня|знаю|наш[её]л)|come\s+to\s+(?:your\s+)?(?:home|house)|coming\s+to\s+(?:your\s+)?(?:home|house)|find\s+you|know\s+your\s+address|know\s+where\s+you\s+live|uyingga\s+(?:bor|kel)|manzilingni\s+bil|qayerda\s+yashashingni\s+bil|seni\s+top|уйингга\s+(?:бор|кел)|манзилингни\s+бил|қаерда\s+яшашингни\s+бил|сени\s+топ)/iu;
const VIOLENCE_ADDRESS_MENACE_RE =
  /(?:(?:знаю|знаем|наш[её]л).{0,28}(?:твой|ваш)\s+адрес.{0,40}(?:приед|прид|найд|пожале|тебе\s+конец)|(?:твой|ваш)\s+адрес.{0,28}(?:знаю|знаем|наш[её]л|у\s+меня).{0,40}(?:приед|прид|найд|пожале|тебе\s+конец)|know\s+(?:your\s+address|where\s+you\s+live).{0,55}(?:coming|come\s+(?:to\s+your\s+(?:home|house)|for\s+you)|find\s+you|you['’]?ll\s+be\s+sorry|watch\s+your\s+back)|(?:manzilingni\s+bil|qayerda\s+yashashingni\s+bil).{0,40}(?:kel|bor|top|pushaymon)|(?:манзилингни\s+бил|қаерда\s+яшашингни\s+бил).{0,40}(?:кел|бор|топ|пушаймон))/iu;
const VIOLENCE_LOCATION_HARM_RE =
  /(?:убью|убь[её]м|изобью|изобь[её]м|побью|побь[её]м|зарежу|зарежем|порежу|порежем|beat\s+you|kill\s+you|hurt\s+you|stab\s+you|o['’]?ldir(?:aman|amiz)|ur(?:aman|amiz)|kaltaklay(?:man|miz)|do['’]?pposlay(?:man|miz)|pichoqlay(?:man|miz)|ўлдир(?:аман|амиз)|улдир(?:аман|амиз)|ур(?:аман|амиз)|калтаклай(?:ман|миз)|дўппослай(?:ман|миз)|дуппослай(?:ман|миз)|пичоқлай(?:ман|миз))/iu;
const VIOLENCE_THREAT_NEGATION_RE =
  /(?:(?:не|никогда\s+не)\s+(?:приед|прид|убь|изобь|побь|зареж|пореж|застрел|закоп|сломаю|сожгу)|(?:do\s+not|don['’]?t|never|will\s+not|won['’]?t|would\s+never|(?:i\s+)?(?:am|['’]?m)\s+not\s+going\s+to|(?:we|you|they)\s+are\s+not\s+going\s+to)\s+(?:come|find|beat|kill|hurt|stab|shoot|break|make)|(?:o['’]?ldirmay|urmay|otmay|yo['’]?q\s+qilmay|kaltaklamay|kelmay|bormay|топмай|келмай|бормай|ўлдирмай|улдирмай|урмай|отмай|йўқ\s+қилмай))/iu;
const VIOLENCE_THREAT_DENIAL_RE =
  /(?:(?:неправда|это\s+ложь).{0,90}(?:убь|изобь|зареж|застрел|пристрел|утоп).{0,90}(?:не\s+сделаю|не\s+говорил|не\s+угрожал)|(?:не\s+говорил|не\s+писал).{0,45}(?:убью|изобью|зарежу|застрелю|пристрелю)|(?:not\s+true|false).{0,90}(?:kill|beat|stab|shoot|hurt).{0,90}(?:never|would\s+not|wouldn['’]?t|did\s+not|didn['’]?t)|(?:did\s+not|didn['’]?t)\s+say.{0,55}(?:kill|beat|stab|shoot|hurt).{0,90}(?:never|would\s+not|wouldn['’]?t)|(?:noto['’]?g['’]?ri|yolg['’]?on).{0,90}(?:o['’]?ldir|ur|pichoql|ot).{0,65}(?:deganim\s+yo['’]?q|qilmayman)|(?:нотўғри|ното['’]?ғри|ёлғон|йолгон).{0,90}(?:ўлдир|улдир|ур|пичоқл|от).{0,65}(?:деганим\s+йўқ|деганим\s+йук|қилмайман))/iu;
const VIOLENCE_DENIAL_LIVE_CONTRAST_RE =
  /(?:\b(?:but|lekin|ammo)\b|(?<!\p{L})(?:но|однако|лекин|аммо)(?!\p{L})).{0,80}(?:убью|изобью|зарежу|застрелю|пристрелю|kill\s+you|beat\s+you|stab\s+you|shoot\s+you|seni.{0,20}(?:o['’]?ldir|ur|ot|pichoql)|сени.{0,20}(?:ўлдир|улдир|ур|от|пичоқл))/iu;
const VIOLENCE_THREAT_BENIGN_RE =
  /(?:beat\s+(?:the\s+)?(?:game|record|score|team|boss)|beat\s+(?:you|him|her|them)\s+(?:at|in)\s+(?:chess|a\s+game|the\s+game|tennis|football|sports?)|kill\s+(?:the\s+)?(?:process|app|program|virus|bug|time|monster|game\s+boss)|побью\s+(?:рекорд|соперника\s+в\s+игре)|убью\s+(?:монстра|босса\s+в\s+игре)|убить\s+(?:процесс|время|программу|вирус)|o['’]?yinda.{0,20}(?:yut|ur)|sport.{0,20}(?:ur|beat))/iu;
const VIOLENCE_THREAT_EDUCATIONAL_RE =
  /(?:памятк|учебн.{0,18}(?:пример|материал)|инструктаж|цитат.{0,20}(?:фильм|книг|роман)|training\s+(?:example|material)|awareness\s+(?:example|material|notice)|fiction|novel|movie\s+quote|o['’]?quv.{0,18}(?:misol|material)|eslatma|filmdan\s+olingan|tahdid\s+emas|огоҳлантириш|ўқув.{0,18}(?:мисол|материал)|фильмдан\s+олинган|таҳдид\s+эмас)/iu;
const VIOLENCE_THREAT_SAFETY_FRAME_RE =
  /(?:если\s+(?:вам|тебе)\s+(?:пишут|говорят|угрожают)|если\s+незнакомец\s+пишет|if\s+someone\s+(?:writes|says|threatens)|if\s+a\s+stranger\s+(?:writes|says|threatens)|agar\s+kimdir|agar.{0,100}(?:yozsa|aytsa|tahdid)|агар\s+кимдир|агар.{0,100}(?:ёзса|айтса|таҳдид)|не\s+отвечайте\s+на\s+такие\s+угрозы|do\s+not\s+reply\s+to\s+such\s+threats|bunday\s+tahdidga\s+javob\s+bermang|бундай\s+таҳдидга\s+жавоб\s+берманг|(?:police|law[-\s]+enforcement).{0,45}(?:warn|advis).{0,100}(?:do\s+not|don['’]?t|not\s+to|never)|(?:полици|мвд).{0,45}(?:предупрежд|совету).{0,100}(?:не\s+|нельзя|никогда\s+не))/iu;
const VIOLENCE_QUOTED_SAFETY_FRAME_RE =
  /(?:если\s+пишут|if\s+(?:they|people)\s+(?:write|say)|agar\s+(?:yozishsa|aytishsa)|агар\s+(?:ёзишса|айтишса))/iu;
const VIOLENCE_PROTECTIVE_FOLLOWUP_RE =
  /(?:не\s+отвечайте|звоните\s+102|сохраните\s+сообщение|do\s+not\s+reply|call\s+102|save\s+the\s+message|javob\s+bermang|102.{0,15}qo['’]?ng['’]?iroq|xabarni\s+saqlang|жавоб\s+берманг|102.{0,15}қўнғироқ|хабарни\s+сақланг)/iu;

function isContextualViolenceSafetyClause(clauses: readonly string[], index: number): boolean {
  const clause = clauses[index] ?? "";
  if (VIOLENCE_THREAT_SAFETY_FRAME_RE.test(clause)) return true;
  if (!VIOLENCE_QUOTED_SAFETY_FRAME_RE.test(clause)) return false;

  const previous = [clauses[index - 2], clauses[index - 1]].filter(Boolean).join(". ");
  const next = [clauses[index + 1], clauses[index + 2]].filter(Boolean).join(". ");
  return (
    (VIOLENCE_THREAT_EDUCATIONAL_RE.test(previous) ||
      LAW_ENFORCEMENT_EDUCATIONAL_EXAMPLE_RE.test(previous)) &&
    VIOLENCE_PROTECTIVE_FOLLOWUP_RE.test(next)
  );
}

function shouldFlagViolenceThreat(text: string): boolean {
  if (VIOLENCE_THREAT_DENIAL_RE.test(text) && !VIOLENCE_DENIAL_LIVE_CONTRAST_RE.test(text)) {
    return false;
  }
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    if (
      VIOLENCE_THREAT_EDUCATIONAL_RE.test(clause) ||
      isContextualViolenceSafetyClause(clauses, index) ||
      LAW_ENFORCEMENT_EDUCATIONAL_EXAMPLE_RE.test(clause)
    ) {
      return false;
    }
    const window = [index - 1, index, index + 1]
      .filter((candidateIndex) => candidateIndex >= 0 && candidateIndex < clauses.length)
      .filter((candidateIndex) => {
        const candidate = clauses[candidateIndex] ?? "";
        return (
          !VIOLENCE_THREAT_EDUCATIONAL_RE.test(candidate) &&
          !isContextualViolenceSafetyClause(clauses, candidateIndex) &&
          !LAW_ENFORCEMENT_EDUCATIONAL_EXAMPLE_RE.test(candidate) &&
          !VIOLENCE_THREAT_NEGATION_RE.test(candidate)
        );
      })
      .map((candidateIndex) => clauses[candidateIndex])
      .join(". ");
    if (VIOLENCE_THREAT_NEGATION_RE.test(clause) || VIOLENCE_THREAT_BENIGN_RE.test(window)) {
      return false;
    }
    return (
      VIOLENCE_ADDRESS_MENACE_RE.test(window) ||
      ((VIOLENCE_THREAT_ACTION_RE.test(window) || VIOLENCE_LOCATION_HARM_RE.test(window)) &&
        VIOLENCE_THREAT_LOCATION_RE.test(window)) ||
      VIOLENCE_THREAT_ACTION_RE.test(clause) ||
      VIOLENCE_THREAT_EXTENDED_ACTION_RE.test(clause) ||
      VIOLENCE_CONDITIONAL_EXTORTION_RE.test(clause) ||
      VIOLENCE_REPORTED_THREAT_RE.test(clause) ||
      VIOLENCE_REPORTED_THREAT_RE.test(window) ||
      VIOLENCE_REPORTED_EXTENDED_THREAT_RE.test(clause) ||
      VIOLENCE_REPORTED_EXTENDED_THREAT_RE.test(window)
    );
  });
}

const PENALTY_POINTS_CONTEXT_RE =
  /(?:(?:штрафн|штран|дорожн|водительск).{0,25}балл|балл.{0,25}(?:штрафн|штран|нарушен|пдд)|traffic\s+(?:pen(?:a)?lty|violation)\s+points?|(?:driving\s+)?(?:pen(?:a)?lty|violation)\s+points?|points?.{0,35}driving\s+record|ja(?:r)?ima\s+ball|yo['’]?l.{0,20}qoida.{0,25}ball|qoida(?:buzarlik)?.{0,25}ball|қоида(?:бузарлик)?.{0,25}балл|ballar(?:im|i)?ni|баллар(?:им|и)?ни)/iu;
const PENALTY_POINTS_ERASURE_RE =
  /(?:обнул|аннулир|удал|спис|спиш|сним|уменьш|сократ|уб(?:ер|ра)|сброс|erase|delete|remove|reduce|lower|clear|wipe|cancel|reset|take.{0,30}off|knock.{0,30}off|o['’]?chir|yo['’]?q\s+qil|bekor\s+qil|nol(?:ga)?\s+qil|nolga\s+tushir|olib\s+tashla|kamaytir|tozala|олиб\s+ташла|камайтир|тозала)/iu;
const PENALTY_POINTS_PAYMENT_RE =
  /(?:за\s+деньги|за\s+оплат|за\s+комисс|за\s+вознагражден|вознагражден|за\s+\d[\d\s.,]{1,}.{0,12}(?:тыс|сум)|заплат|оплат|перевед|наличн|аванс|депозит|комисс|от\s*500.{0,12}(?:тыс|000)|\b\d[\d\s.,]{2,}\s*(?:ming\s+)?(?:сум|so['’]?m|soums?)|for\s+(?:money|cash|a\s+(?:cash\s+)?fee|payment)|cash\s+fee|pay\s+(?:us|me|a\s+fee|cash)|paid\s+(?:a\s+)?(?:deposit|fee)|(?:wants?|asks?|demands?)\s+(?:a|another)?\s*fee|transfer.{0,30}(?:money|payment|\d)|naqd\s+pul(?:ga)?|pul\s+evaziga|pul\s+ber|pul\s+to['’]?la|to['’]?lov|pul(?:ni)?.{0,30}(?:o['’]?tkaz|so['’]?ra)|haq\s+so['’]?ra|komissiya\s+talab|нақд\s+пул(?:га)?|пул\s+бер|пул(?:ни)?.{0,30}(?:ўтказ|сўра|утказ|сура))/iu;
const PENALTY_POINTS_PAYMENT_REQUEST_RE =
  /(?:заплат(?:и|ите)(?!\p{L})|оплат(?:и|ите)(?!\p{L})|перевед(?:и|ите)(?!\p{L})|прос(?:ит|ят).{0,35}(?:оплат|перев)|pay\s+(?:us|me)|transfer.{0,35}(?:money|payment|\d)|(?:asks?|wants?|demands?)\s+(?:a|another)?\s*fee|\d[\d\s.,]*\s*soums?\s+payment|(?:pul|to['’]?lov).{0,35}(?:o['’]?tkaz|to['’]?la)|(?:o['’]?tkaz|to['’]?la).{0,35}(?:pul|to['’]?lov)|haq\s+so['’]?ra|komissiya\s+talab)/iu;
const PENALTY_POINTS_PAYMENT_LINK_RE =
  /(?:\b(?:us|me|fee|commission)\b|\b\d[\d\s.,]*\s*(?:soums?|uzs)\b|нам|мне|комисс|личн.{0,12}карт|на\s+карт|на\s+сч[её]т|\d[\d\s.,]*\s*(?:тыс|сум)|bizga|menga|komissiya|shaxsiy.{0,12}karta|kartaga|hisobga|\d[\d\s.,]*\s*(?:ming\s+)?so['’]?m)/iu;
const PENALTY_POINTS_REFERENTIAL_PAYMENT_RE =
  /(?:(?<!\p{L})тому(?!\p{L})|(?<!\p{L})этому\s+человеку(?!\p{L})|\b(?:that\s+person|the\s+fixer|the\s+intermediary)\b|(?<!\p{L})(?:o['’]?sha|shu)\s+odamga(?!\p{L}))/iu;
const PENALTY_POINTS_REFERENTIAL_ACTION_RE =
  /^(?:(?:кто|котор(?:ый|ая|ые))(?!\p{L})|(?:who|that)\b|(?:kim|u)\b)/iu;
const PENALTY_POINTS_CAUSAL_PAYMENT_RE =
  /(?:(?:(?:buning|shuning)\s+uchun|(?:бунинг|шунинг)\s+учун|за\s+(?:это|такую\s+услугу)|for\s+(?:this|that|doing\s+so)).{0,40}(?:pul|пул|деньг|оплат|fee|cash|money).{0,30}(?:so['’]?ra|сўра|сура|прос|ask|want|demand)|если.{0,35}(?:заплач|оплач|перевед)|if.{0,35}(?:pay|transfer)|(?:narxi|narx|цена|стоимост).{0,20}\d[\d\s.,]*(?:ming|минг|тыс|сум|so['’]?m)?)/iu;
const PENALTY_POINTS_SAFETY_RE =
  /(?:невозможно|нельзя|никто\s+не\s+(?:спиш|удал|обнул|аннулир|уменьш)|не\s+(?:можем|могут|удал|обнул|аннулир)|не\s+платите|do\s+not\s+pay|nobody\s+can\s+(?:erase|remove|delete|reduce|lower|cancel)|cannot\s+be\s+(?:erased|removed|deleted|cancelled|reduced)|impossible\s+to\s+(?:erase|remove|delete|reduce)|o['’]?chirib\s+bo['’]?lmaydi|bekor\s+qilib\s+bo['’]?lmaydi|iloji\s+yo['’]?q|pul\s+to['’]?lamang)/iu;
const PENALTY_POINTS_SAFETY_LIVE_CONTRAST_RE =
  /(?:(?:но|кроме|однако).{0,80}(?:я|посредник|человек).{0,45}(?:могу|может|обеща).{0,45}(?:спис|удал|обнул|уменьш)|(?:but|except|however).{0,80}(?:i|the\s+fixer|the\s+intermediary|someone).{0,45}(?:can|will|promise).{0,45}(?:erase|remove|delete|reduce|lower)|(?:lekin|ammo).{0,80}(?:men|vositachi|kimdir).{0,45}(?:o['’]?chir|kamaytir|va['’]?da))/iu;
const PENALTY_POINTS_OFFICIAL_PROCESS_RE =
  /(?:обжалован|обжаловать|апелляц|судебн.{0,15}решен|истекают\s+автоматически|official\s+appeal|appeal\s+process|court\s+decision|expire\s+automatically|rasmiy\s+shikoyat|sud\s+qarori)/iu;

function shouldFlagFakePenaltyPointsErasure(text: string): boolean {
  // Thousands separators are part of one amount, not clause boundaries.
  const clauses = splitRiskClauses(text.replace(/(?<=\d),(?=\d{3}(?:\D|$))/gu, ""));
  return clauses.some((actionClause, index) => {
    if (
      !PENALTY_POINTS_ERASURE_RE.test(actionClause) ||
      !PENALTY_POINTS_CONTEXT_RE.test(actionClause) ||
      PENALTY_POINTS_OFFICIAL_PROCESS_RE.test(actionClause)
    ) {
      return false;
    }
    const localWindow = [clauses[index - 1], actionClause, clauses[index + 1]]
      .filter(Boolean)
      .join(". ");
    if (
      PENALTY_POINTS_SAFETY_RE.test(actionClause) &&
      !PENALTY_POINTS_SAFETY_LIVE_CONTRAST_RE.test(localWindow)
    ) {
      return false;
    }
    if (PENALTY_POINTS_PAYMENT_RE.test(actionClause)) return true;
    const previousClause = clauses[index - 1];
    if (
      previousClause !== undefined &&
      PENALTY_POINTS_PAYMENT_RE.test(previousClause) &&
      PENALTY_POINTS_REFERENTIAL_PAYMENT_RE.test(previousClause) &&
      PENALTY_POINTS_REFERENTIAL_ACTION_RE.test(actionClause)
    ) {
      return true;
    }
    return [clauses[index - 1], clauses[index + 1]].some(
      (clause) =>
        clause !== undefined &&
        (PENALTY_POINTS_CAUSAL_PAYMENT_RE.test(clause) ||
          (PENALTY_POINTS_PAYMENT_REQUEST_RE.test(clause) &&
            PENALTY_POINTS_PAYMENT_LINK_RE.test(clause))),
    );
  });
}

const GENERIC_MALICIOUS_FILE_BAIT_RE =
  /(?:(?:откр\p{L}*|скач\p{L}*|нажм\p{L}*|установ\p{L}*|посмотр\p{L}*|получи(?:те|л[аи]?)?|open(?:ed|ing|s)?|download(?:ed|ing|s)?|click(?:ed|ing|s)?|install(?:ed|ing|s)?|ko['’]?r|och\p{L}*|yukla\p{L}*|bos\p{L}*|o['’]?rnat\p{L}*).{0,90}(?:gif|гиф|стикер|sticker|stiker|greeting\s+card|открытк|fayl|(?<!\p{L})f[іi]les?(?!\p{L})|файл|attachment|вложени|archive|архив|arxiv|apk|player|viewer|codec|проигрывател|кодек|recording)|(?:gif|гиф|стикер|sticker|stiker|greeting\s+card|открытк|fayl|(?<!\p{L})f[іi]les?(?!\p{L})|файл|attachment|вложени|archive|архив|arxiv|apk|player|viewer|codec|проигрывател|кодек|recording).{0,90}(?:откр\p{L}*|скач\p{L}*|нажм\p{L}*|установ\p{L}*|посмотр\p{L}*|получи(?:те|л[аи]?)?|open(?:ed|ing|s)?|download(?:ed|ing|s)?|click(?:ed|ing|s)?|install(?:ed|ing|s)?|ko['’]?r|och\p{L}*|yukla\p{L}*|bos\p{L}*|o['’]?rnat\p{L}*))/iu;
const NEIGHBOR_VIDEO_CONTEXT_RE =
  /(?:сосед|соседск|жи(?:л)?ец|домов.{0,15}чат|чат.{0,20}подъезд|pod['’]?ezd|podiezd|камер.{0,30}(?:подъезд|дом|двор|наблюден)|(?:подъезд|дом|двор).{0,30}камер|видео.{0,30}(?:подъезд|двор|сосед)|домофон|neighb[оo]r|neighbour|res(?:i)?dent|building\s+chat|security\s+camera|door\s+camera|doorbell|courtyard.{0,20}camera|cctv|video.{0,30}(?:neighb[оo]r|neighbour)|qo['’]?shni|yashovchi|kuzatuv\s+kamer|hovli.{0,25}(?:video|kamer)|kirishdagi\s+video|қўшни|таниш|яшовчи|кузатув\s+камер|ҳовли.{0,25}(?:видео|камер)|киришдаги\s+видео)/iu;
const NEIGHBOR_VIDEO_ATTACHMENT_RE =
  /(?:вложени|прикрепл|скинул|скинули|кинул|кинули|отправил|отдельн.{0,30}(?:файл|видео|запис)|архив|(?<!\p{L})(?:zip|rar|7z)(?!\p{L})|\.\s*(?:zip|rar|7z)|ссылк|проигрывател|кодек|attachment|attached.{0,25}(?:f[іi]le|video|recording|zip|rar|7z)|download\s+link|archive|external\s+link|separate.{0,30}(?:file|video|recording|viewer)|viewer|codec|biriktir\p{L}*|бириктир\p{L}*|alohida.{0,30}(?:fayl|video|yozuv)|arxiv|havola|player)/iu;
const NEIGHBOR_VIDEO_OPEN_RE =
  /(?:откр\p{L}*|скач\p{L}*|установ\p{L}*|перейд\p{L}*|нажм\p{L}*|распак\p{L}*|глян\p{L}*|посмотр\p{L}*|open(?:ed|ing|s)?|download(?:ed|ing|s)?|install(?:ed|ing|s)?|click(?:ed|ing|s)?|unpack|extract|watch|view|follow|och\p{L}*|yukla\p{L}*|ko['’]?r\p{L}*|o['’]?rnat\p{L}*|o['’]?t|bos\p{L}*|(?<!\p{L})(?:оч(?:инг|иш|манг)|юклаб|ўрнат\p{L}*)(?!\p{L}))/iu;
const NEIGHBOR_VIDEO_SOCIAL_BAIT_RE =
  /(?:это\s+ты|узна[её]шь\s+себя|похож\p{L}*\s+на\s+тебя|is\s+this\s+you|caught\s+(?:me|you)|looks?\s+like\s+you|bu\s+senmi|senga\s+o['’]?xshaydi|бу\s+сенми|сенга\s+ўхшайди)/iu;
const OWNED_VIDEO_ARCHIVE_RE =
  /(?:(?:я\s+сам|сама|сво(?:ей|я|ю)).{0,70}(?:экспортир|создал|сохранил|архив|резервн.{0,15}коп)|(?:my\s+own|i\s+(?:made|created|exported|sent)|i\s+had\s+sent).{0,70}(?:camera|archive|backup|video)|(?:archive|backup|video).{0,70}(?:that\s+)?i\s+(?:had\s+)?sent|(?:o['’]?zim|o['’]?z\s+kameram|men\s+yuborgan).{0,70}(?:eksport|yarat|arxiv|zaxira|video)|(?:arxiv|zaxira|video).{0,70}men\s+yuborgan|(?:ўзим|узим|ўз\s+камерам|уз\s+камерам|мен\s+юборган).{0,70}(?:экспорт|ярат|архив|захира|видео)|(?:архив|захира|видео).{0,70}мен\s+юборган)/iu;
const NEIGHBOR_VIDEO_UNTRUSTED_DELIVERY_RE =
  /(?:неизвестн|незнаком|домов.{0,15}чат|чат.{0,20}подъезд|мне\s+(?:прислал|отправил|скинул|приш[её]л)|(?:сосед|жилец).{0,35}(?:мне\s+)?(?:прислал|отправил|скинул|кинул|прикрепил)|(?:появил|приш[её]л).{0,35}(?:чат|zip|rar|7z)|unknown|stranger|building\s+chat|sent\s+me|received|appeared|attached|(?:resident|neighb[оo]r|neighbour).{0,35}(?:sent\s+me|sent.{0,20}to\s+me|forwarded\s+me|attached)|notanish|begona|(?:qo['’]?shni|yashovchi).{0,35}(?:menga\s+)?(?:yubordi|jo['’]?natdi|biriktirdi)|kelib\s+qol|(?:қўшни|яшовчи).{0,35}(?:менга\s+)?(?:юборди|жўнатди|бириктирди)|келиб\s+қол)/iu;
const NATIVE_VIDEO_CONTEXT_RE =
  /(?:прямо\s+в\s+чате|видеосообщени|видеозвон|кружок|native\s+video|in[-\s]?app\s+video|video\s+message|chat\s+player|inside\s+telegram|telegram\s+(?:ichida|ичида)|телеграм\s+ичида|videoqo['’]?ng['’]?iroq|video\s+xabar)/iu;
const STRONG_EXTERNAL_FILE_ARTIFACT_RE =
  /(?:\.\s*(?:zip|rar|7z|apk)(?!\p{L})|download\s+link|external\s+link|внешн\p{L}*.{0,18}ссылк|скачать.{0,18}(?:архив|файл)|yuklab\s+olish.{0,18}(?:havola|arxiv|fayl))/iu;
const FILE_BAIT_SAFETY_RE =
  /(?:(?:не|никогда\s+не|нельзя)\s+(?:открыва|скачива|переходи|нажима|устанавлива)|(?:do\s+not|don['’]?t|never|did\s+not|didn['’]?t)\s+(?:open|download|click|follow|install)|(?:ochmang|yuklamang|o['’]?tmang|bosmang|o['’]?rnatmang|ochmadim|yuklamadim|o['’]?rnatmadim))/iu;
const BENIGN_OPENED_DOCUMENT_RE =
  /(?:quarterly|annual|monthly|work|school)\s+(?:report|document)|(?:квартальн|годов|месячн|рабоч|школьн).{0,25}(?:отч[её]т|документ)|(?:chorak|yillik|oylik|ish).{0,25}(?:hisobot|hujjat)/iu;
const ROAD_CASHBACK_APK_CONTEXT_RE =
  /(?:roa(?:d)?\s*24|роад\s*24|\.\s*apk(?:ni|ga)?|\bapk(?:ni|ga)?\b|apk[-\s]?(?:file|файл|fayl)|приложен\p{L}*|(?<!\p{L})(?:ilova|dastur)\p{L}*|илова|дастур|\bapp\b)/iu;
const ROAD_CASHBACK_FINE_RE =
  /(?:штраф|ja(?:r)?ima|жарима|traffic\s+(?:fine|ticket)|\bfines?\b|\bticket\b|penalty)/iu;
const ROAD_CASHBACK_ACTION_RE =
  /(?:предлага|прос(?:ят|ит)|прислал|отправил|приш[её]л|получил|шлют|тороп|скач\p{L}*|загруз|установ|постав\p{L}*|откр\p{L}*|удалить|yubor|kel|ol|taklif|deyish|shoshir|yukla|o['’]?rnat|ochdim|ochish|o['’]?chirish|юбор|кел|таклиф|шошир|юклаб|ўрнат|очдим|ўчириш|sent|received|got|pushing|rush|download|install|put\s+(?:it\s+)?on\s+(?:the\s+|your\s+)?(?:phone|device)|opened|open|remove|asked|offered)/iu;
const ROAD_CASHBACK_UNTRUSTED_SOURCE_RE =
  /(?:неизвестн|незнаком|из\s+(?:чата|telegram|телеграма?|мессенджер)|в\s+(?:чате|telegram|телеграме?|мессенджере)|прислал|отправил|вложени|файл|ссылк|unknown|stranger|from\s+(?:(?:a|this)\s+)?(?:chat|message|telegram|messenger)|this\s+message|sent|messag(?:e|ed|ing)|attachment|file|link|notanish|begona|chatdan|telegramdan|yubor|fayl|havola|чатдан|телеграмдан|юбор|файл|ҳавола)/iu;
const ROAD_CASHBACK_PROMO_RE =
  /(?:кешб[эе]к|cashback|keshbek|скидк|chegirma|discount|стопроцент\p{L}*|100\s*(?:%|процент\p{L}*|foiz)|one\s+hundred\s+percent|yuz\s+foiz|юз\s+фоиз|верн\p{L}*\s+100|верн\p{L}*.{0,25}(?:всю|полную)\s+сумм|верн\p{L}*.{0,25}весь\s+штраф|(?:весь\s+штраф|полн\p{L}*\s+сумм).{0,25}верн\p{L}*|полност\p{L}*\s+верн|полн\p{L}*\s+возврат|to['’]?liq\s+qaytar\p{L}*|to['’]?la[-\s]?to['’]?kis\s+qaytar\p{L}*|(?:hammasini|barchasini|bari).{0,25}qayt\p{L}*|тўлиқ\s+қайтар\p{L}*|тўла[-\s]?тўкис\s+қайтар\p{L}*|бутунлай\s+қайтар\p{L}*|(?:ҳаммасини|барчасини|бари).{0,25}қайт\p{L}*|refund\p{L}*.{0,25}(?:the\s+)?(?:full\s+amount|whole\s+(?:fine|amount)|entire\s+(?:fine|amount))|reimburse\p{L}*.{0,25}(?:the\s+)?(?:entire|whole|full).{0,12}(?:ticket|fine|amount)|full\s+(?:amount\s+)?refund|every\s+penny\s+back|(?:get|give).{0,30}(?:fine\s+)?money\s+back|fine\s+money\s+back)/iu;
const ROAD24_APK_ARTIFACT_RE =
  /(?:(?:roa(?:d)?\s*24|роад\s*24).{0,24}(?:\.\s*apk(?:ni|ga)?|\bapk(?:ni|ga)?\b)|(?:\.\s*apk(?:ni|ga)?|\bapk(?:ni|ga)?\b).{0,24}(?:roa(?:d)?\s*24|роад\s*24))/iu;
const ROAD_CASHBACK_NO_FILE_INTERACTION_RE =
  /(?:никак\p{L}*\s+файл\p{L}*.{0,35}не\s+откры|файл\p{L}*.{0,35}не\s+(?:открывал|скачивал|устанавливал)|hech\s+qanday\s+fayl.{0,35}(?:ochmadim|yuklamadim|o['’]?rnatmadim)|no\s+files?.{0,35}(?:opened|downloaded|installed)|i\s+(?:did\s+not|didn['’]?t)\s+(?:open|download|install).{0,25}(?:the\s+)?file)/iu;
const OFFICIAL_FINE_APP_CONTEXT_RE =
  /(?:(?:официальн|государственн|government|official|rasmiy|давлат).{0,35}(?:прилож|app|ilova|илова|сайт|site|portal|портал)|(?:my\.?gov(?:\.uz)?|mygov|единый\s+портал|ягона\s+портал).{0,35}(?:прилож|app|ilova|илова|сайт|site|portal|портал)?)/iu;
const OFFICIAL_APP_STORE_RE =
  /(?:google\s+play|play\s+market|app\s+store|официальн.{0,18}магазин\s+прилож|rasmiy.{0,18}ilovalar\s+do['’]?koni|расмий.{0,18}иловалар\s+дўкони)/iu;
const FINE_PAYMENT_RESULT_OR_PROCESS_RE =
  /(?:штраф.{0,55}(?:оплачен|оплатил|оплатила|оплачивать|проверить|квитанц|начислен)|(?:оплачен|оплатил|оплатила|квитанц).{0,55}штраф|(?:paid|pay|check).{0,30}(?:traffic\s+)?fine|(?:traffic\s+)?fine.{0,30}(?:paid|payment|receipt|official\s+app)|jarima.{0,45}(?:to['’]?ladim|to['’]?langan|to['’]?lash|tekshir|kvitansiya)|(?:to['’]?ladim|to['’]?langan|kvitansiya).{0,45}jarima|жарима.{0,45}(?:тўладим|тўланган|тўлаш|текшир|квитанция))/iu;

function isOrdinaryOfficialFineAppPayment(text: string): boolean {
  if (
    !ROAD_CASHBACK_FINE_RE.test(text) ||
    !FINE_PAYMENT_RESULT_OR_PROCESS_RE.test(text) ||
    !(OFFICIAL_FINE_APP_CONTEXT_RE.test(text) || OFFICIAL_APP_STORE_RE.test(text))
  ) {
    return false;
  }
  const explicitlyNoExternalArtifact =
    /(?:apk|файл|вложен|сообщени).{0,45}(?:не\s+было|не\s+приходил|не\s+присылал|нет)|(?:без|никак(?:ого|их))\s+(?:apk|файл|вложен)|(?:apk|fayl|xabar).{0,45}(?:kelmadi|yo['’]?q)|hech\s+narsa\s+yuklamadim|(?:apk|файл|хабар).{0,45}(?:келмади|йўқ)|ҳеч\s+нарса\s+юкламадим|no\s+(?:apk|chat\s+attachment|message\s+attachment)|(?:apk|chat\s+attachment).{0,35}(?:was\s+not|wasn['’]?t)\s+(?:involved|sent|received)/iu.test(
      text,
    );
  const noPositiveExternalArtifact =
    !ROAD_CASHBACK_UNTRUSTED_SOURCE_RE.test(text) &&
    !/(?:\.\s*apk|\bapk\b|apk[-\s]?(?:file|файл|fayl))/iu.test(text);

  return (
    !ROAD_CASHBACK_PROMO_RE.test(text) &&
    (explicitlyNoExternalArtifact || noPositiveExternalArtifact)
  );
}

function shouldFlagRoadCashbackFineApk(text: string): boolean {
  const hasSpecificRoad24Apk = ROAD24_APK_ARTIFACT_RE.test(text);
  const hasRoad24Brand = /(?:roa(?:d)?\s*24|роад\s*24)/iu.test(text);
  const hasCashbackExternalApp =
    ROAD_CASHBACK_PROMO_RE.test(text) &&
    (/(?:\.\s*apk(?:ni|ga)?|\bapk(?:ni|ga)?\b)/iu.test(text) ||
      ((hasRoad24Brand ||
        /(?:приложен\p{L}*|(?<!\p{L})(?:ilova|dastur)\p{L}*|илова|дастур|\bapp\b)/iu.test(text)) &&
        ROAD_CASHBACK_UNTRUSTED_SOURCE_RE.test(text)));
  if (
    FILE_BAIT_SAFETY_RE.test(text) ||
    ROAD_CASHBACK_NO_FILE_INTERACTION_RE.test(text) ||
    isOrdinaryOfficialFineAppPayment(text) ||
    !ROAD_CASHBACK_APK_CONTEXT_RE.test(text) ||
    (!ROAD_CASHBACK_FINE_RE.test(text) && !hasRoad24Brand) ||
    (!hasSpecificRoad24Apk && !hasCashbackExternalApp) ||
    !ROAD_CASHBACK_ACTION_RE.test(text)
  ) {
    return false;
  }

  return true;
}

function shouldFlagMaliciousFileBait(text: string): boolean {
  const isOwnedArchiveOnly = (value: string): boolean =>
    OWNED_VIDEO_ARCHIVE_RE.test(value) && !NEIGHBOR_VIDEO_UNTRUSTED_DELIVERY_RE.test(value);
  const isNativeVideoOnly = (value: string): boolean =>
    NATIVE_VIDEO_CONTEXT_RE.test(value) && !STRONG_EXTERNAL_FILE_ARTIFACT_RE.test(value);
  return (
    splitRiskClauses(text).some(
      (clause) =>
        GENERIC_MALICIOUS_FILE_BAIT_RE.test(clause) &&
        !isOwnedArchiveOnly(clause) &&
        !BENIGN_OPENED_DOCUMENT_RE.test(clause) &&
        !FILE_BAIT_SAFETY_RE.test(clause) &&
        !isGeneralSafetyClause(clause),
    ) ||
    adjacentRiskWindows(text).some(
      (window) =>
        NEIGHBOR_VIDEO_CONTEXT_RE.test(window) &&
        NEIGHBOR_VIDEO_ATTACHMENT_RE.test(window) &&
        (NEIGHBOR_VIDEO_OPEN_RE.test(window) || NEIGHBOR_VIDEO_SOCIAL_BAIT_RE.test(window)) &&
        !isOwnedArchiveOnly(window) &&
        !isNativeVideoOnly(window) &&
        !FILE_BAIT_SAFETY_RE.test(window) &&
        !isGeneralSafetyClause(window),
    ) ||
    (NEIGHBOR_VIDEO_CONTEXT_RE.test(text) &&
      NEIGHBOR_VIDEO_ATTACHMENT_RE.test(text) &&
      (NEIGHBOR_VIDEO_OPEN_RE.test(text) || NEIGHBOR_VIDEO_SOCIAL_BAIT_RE.test(text)) &&
      !isOwnedArchiveOnly(text) &&
      !isNativeVideoOnly(text) &&
      !FILE_BAIT_SAFETY_RE.test(text) &&
      !BENIGN_OPENED_DOCUMENT_RE.test(text)) ||
    shouldFlagRoadCashbackFineApk(text)
  );
}

function hasUnsafeClause(text: string, unsafe: RegExp, safety: RegExp): boolean {
  return splitRiskClauses(text).some(
    (clause) => unsafe.test(clause) && !safety.test(clause) && !isGeneralSafetyClause(clause),
  );
}

function shouldFlagDirectTransferRequest(text: string): boolean {
  if (TRANSFER_ARTIFACT_CAPABILITY_RE.test(text.trim())) return false;
  const clauses = splitRiskClauses(text);
  return clauses.some((actionClause, index) => {
    const hasTransferRequest =
      TRANSFER_DESTINATION_RE.test(actionClause) ||
      SCAM_CONTEXT_TRANSFER_REQUEST_RE.test(actionClause) ||
      (PERSONAL_CARD_MONEY_CONTEXT_RE.test(actionClause) &&
        PERSONAL_CARD_DESTINATION_RE.test(actionClause) &&
        PERSONAL_CARD_TRANSFER_REQUEST_RE.test(actionClause));
    if (
      !hasTransferRequest ||
      ORDINARY_TRANSFER_CONTEXT_RE.test(actionClause) ||
      TRANSFER_SAFETY_RE.test(actionClause) ||
      PERSONAL_CARD_TRANSFER_SAFETY_RE.test(actionClause) ||
      isGeneralSafetyClause(actionClause)
    ) {
      return false;
    }

    // A transfer request is not scam evidence on its own: invoices, rent,
    // salaries and peer reimbursements use the same verbs. Keep only an
    // independent suspicious signal from the live request or its nearby
    // non-protective context. A neighboring warning such as “do not transfer
    // to strangers” must neither suppress nor manufacture a positive.
    const riskContext = clauses
      .slice(Math.max(0, index - 2), Math.min(clauses.length, index + 3))
      .filter(
        (clause) =>
          !TRANSFER_SAFETY_RE.test(clause) &&
          !PERSONAL_CARD_TRANSFER_SAFETY_RE.test(clause) &&
          !isGeneralSafetyClause(clause),
      )
      .join(". ");
    return TRANSFER_SCAM_CONTEXT_RE.test(riskContext);
  });
}

function shouldFlagSafeAccountTransferRequest(text: string): boolean {
  return (
    hasUnsafeClause(text, SAFE_ACCOUNT_TRANSFER_REQUEST_RE, TRANSFER_SAFETY_RE) ||
    hasUnsafeClause(text, SAFE_ACCOUNT_TRANSFER_RU_INFINITIVE_RE, TRANSFER_SAFETY_RE)
  );
}

const BOSS_MEDIA_IDENTITY_RE =
  /(?:\b(?:boss|manager|director|ceo|chief\s+executive|supervisor)\b|начальник|руководител|директор|гендиректор|шеф|(?<![\p{L}\p{N}_])(?:rahbar|direktor|boshliq)(?:im|imiz|ingiz|ning)?(?![\p{L}\p{N}_]))/iu;
const BOSS_MEDIA_CHANNEL_RE =
  /(?:video[\s-]?call|voice[\s-]?call|video|camera|audio|видео(?:звон|вызов|связ|конференц)?|по\s+видео|голос|аудио|камера|videoqo['’]?ng['’]?iroq|video\s+qo['’]?ng['’]?iroq|ovoz|kamera)/iu;
const BOSS_MEDIA_ANOMALY_RE =
  /(?:\b(?:look(?:ed|s|ing)?|sound(?:ed|s|ing)?)\b.{0,28}\b(?:strange|different|unusual|odd|wrong|unnatural)\b|\bdeepfake\b|(?:выгляд|голос|лицо|мимик|речь).{0,35}(?:странн|друг|необычн|неестественн|не\s+похож)|(?:ko['’]?rin|ovoz|yuz|nutq).{0,35}(?:g['’]?alati|boshqacha|odatdagidek\s+emas|sun['’]?iy)|(?:g['’]?alati|boshqacha).{0,25}(?:ko['’]?rin|ovoz|yuz|nutq))/iu;
const BOSS_MEDIA_TRANSFER_RE =
  /(?:\b(?:order(?:ed|s|ing)?|ask(?:ed|s|ing)?|tell|told|instruct(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b.{0,70}\b(?:transfer|payment|pay|send\s+(?:the\s+)?money)\b|\b(?:transfer|payment)\b.{0,70}\b(?:order(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b|(?:приказал|приказывает|велел|просит|попросил|требует).{0,70}(?:перев|оплат|деньг)|(?:перевод|оплат|деньг).{0,70}(?:приказал|приказ|велел|просит|попросил|требует)|(?:buyurdi|buyuryapti|so['’]?radi|so['’]?rayapti|talab\s+qil).{0,70}(?:pul|to['’]?lov|o['’]?tkaz)|(?:pul|to['’]?lov|o['’]?tkaz).{0,70}(?:buyurdi|buyuryapti|so['’]?radi|so['’]?rayapti|talab\s+qil))/iu;
const BOSS_MEDIA_EDUCATIONAL_RE =
  /(?:awareness\s+training|security\s+training|training\s+(?:example|says|warns|teaches|explains)|educational\s+(?:example|article|video)|article\s+about\s+deepfakes?|how\s+deepfakes?\s+work|обучающ|обучени.{0,20}(?:сказ|говор|предупрежд|пример|материал)|учебн.{0,20}(?:пример|материал)|памятк.{0,25}(?:дипфейк|подмен)|статья.{0,25}(?:дипфейк|подмен)|пример.{0,25}(?:дипфейк|подмен)|o['’]?quv.{0,25}(?:misol|material)|maqola.{0,25}(?:deepfake|soxta)|deepfake.{0,20}(?:haqida|misol))/iu;

function hasBossMediaSignalSet(text: string): boolean {
  return (
    BOSS_MEDIA_IDENTITY_RE.test(text) &&
    BOSS_MEDIA_CHANNEL_RE.test(text) &&
    BOSS_MEDIA_ANOMALY_RE.test(text)
  );
}

function splitBossMediaClauses(text: string): string[] {
  return text
    .split(/[.!?;\n]+/u)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function isBossMediaEducationalOnly(text: string): boolean {
  if (!BOSS_MEDIA_EDUCATIONAL_RE.test(text)) return false;
  const transition =
    /\b(?:but|however|now|currently|today|then)\b|(?:но|однако|сейчас|теперь|сегодня)|(?:lekin|ammo|endi|hozir|bugun)/giu;
  const matches = [...text.matchAll(transition)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) return true;
  const liveTail = text.slice(last.index);
  return !hasBossMediaSignalSet(liveTail) || !BOSS_MEDIA_TRANSFER_RE.test(liveTail);
}

function shouldFlagAuthorityRequest(text: string): boolean {
  return splitBossMediaClauses(text).some(
    (clause) =>
      AUTHORITY_REQUEST_RE.test(clause) &&
      !isBossMediaEducationalOnly(clause) &&
      !isGeneralSafetyClause(clause),
  );
}

function shouldFlagBossMediaTransferRequest(text: string): boolean {
  return splitBossMediaClauses(text).some(
    (clause) =>
      hasBossMediaSignalSet(clause) &&
      BOSS_MEDIA_TRANSFER_RE.test(clause) &&
      !isBossMediaEducationalOnly(clause) &&
      !isGeneralSafetyClause(clause),
  );
}

const PERSONAL_DATA_ASK_RE =
  /(пришл(и|ите)(?![а-яёa-z])|отправь(те)?(?![а-яёa-z])|назов(и|ите)(?![а-яёa-z])|сообщ(и|ите)(?![а-яёa-z])|укажите(?![а-яёa-z])|введите(?![а-яёa-z])|попросил(?:и|а)?|просил(?:и|а)?|просят|просит|требуют|требует|(?<![\p{L}\p{N}_])(?:yubor(?:ing|ishni)|ayt(?:ing|ishni)|kiriting|so['’]?ra(?:di|shdi|shyapti|yapti))(?![\p{L}\p{N}_])|\b(?:send|enter|tell|share|show|provide|ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b)/iu;
const PERSONAL_DATA_OBJECT_RE =
  /(паспорт|фото.{0,20}(id|айди|удостовер|пасп)|id.?карта|удостоверени|дата рождения|адрес прописки|прописка|инн|pinfl|пинфл|jshshir|паспорт серия|pasport|tug['’]?ilgan sana|manzil|inn|passport(?:\s+number)?|national\s+id|identity\s+document|\bid\b|id card|date of birth|address)/i;
const PERSONAL_DATA_SAFETY_RE =
  /(?:не\s+(?:отправля|присыла|сообща|говори|передава|показыва)|(?:do\s+not|don['’]?t|never|not\s+to)\s+(?:send|share|give|show|tell|enter|provide|submit)|(?:pasport|pinfl|jshshir|manzil).{0,35}(?:yubormang|aytmang|kiritmang|bermang))/iu;
const PERSONAL_DATA_NEUTRAL_RE =
  /(?:\b(?:ask(?:ed|s|ing)?|inquir(?:ed|es|ing))\s+about\b|\b(?:form|checkout|delivery)\b.{0,35}\baddress\b|\baddress\b.{0,35}\b(?:delivery|shipping)\b|\b(?:website|web|server|ip|network|email)\s+address\b|\b(?:html\s+element|process|user|transaction|order|tracking|session)\s+id\b|passport\s+(?:renewal|information|office|appointment)|how\s+to\s+(?:renew|replace).{0,20}passport)/iu;

function shouldFlagPersonalDataRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previous = clauses[index - 1] ?? "";
    const candidate =
      PERSONAL_DATA_OBJECT_RE.test(previous) && PRONOUN_REQUEST_RE.test(clause)
        ? `${clause} passport`
        : clause;
    return (
      PERSONAL_DATA_ASK_RE.test(candidate) &&
      PERSONAL_DATA_OBJECT_RE.test(candidate) &&
      !PERSONAL_DATA_SAFETY_RE.test(candidate) &&
      !isGeneralSafetyClause(clause) &&
      !PERSONAL_DATA_NEUTRAL_RE.test(candidate)
    );
  });
}

const CARD_DATA_ASK_RE =
  /(?:отправь|пришли|скажи|назови|сообщи|передай|покажи|продиктуй|предоставь|укажи|просят|просит|требуют|требует|\b(?:send|tell|give|share|show|provide|submit|read\s+out|ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b|(?<![\p{L}\p{N}_])(?:yubor(?:ing)?|ayt(?:ing)?|ko['’]?rsat(?:ing)?|so['’]?ra(?:di|shdi|shyapti|shmoqda|yapti)?|talab)(?![\p{L}\p{N}_]))/iu;
const CARD_DATA_OBJECT_RE =
  /(?:данн(?:ые|ых)?\s+карт|номер.{0,20}карт|реквизит(?:ы|ов)?\s+карт|фото\s+(?:банковской\s+)?карт|card\s+(?:number|details|data)|(?:last|final)\s+(?:four|4)\s+digits.{0,24}(?:bank\s+)?card|photo\s+of\s+(?:the\s+|your\s+)?card|karta(?:ning|ngiz(?:ning|ni)?|si(?:ning|ni)?|m(?:ning|ni)?)?\s*(?:raqam|ma['’]?lumot|rekvizit|rasm))/iu;
const CARD_DATA_SAFETY_RE =
  /(?:(?:не\s+(?:отправля|сообща|говори|передава|показыва)|do\s+not|don['’]?t|never|not\s+to|yubormang|aytmang|bermang).{0,45}(?:данн(?:ые|ых)?\s+карт|номер\s+карт|фото\s+(?:банковской\s+)?карт|card\s+(?:number|details|data)|photo\s+of\s+(?:the\s+|your\s+)?card|karta(?:ning|ngiz(?:ning|ni)?|si(?:ning|ni)?|m(?:ning|ni)?)?\s*(?:raqam|ma['’]?lumot|rasm))|(?:karta(?:ning|ngiz(?:ning|ni)?|si(?:ning|ni)?|m(?:ning|ni)?)?\s*(?:raqam|ma['’]?lumot|rasm)).{0,45}(?:yubormang|aytmang|bermang))/iu;
const CARD_DATA_NEUTRAL_RE =
  /(?:\b(?:ask(?:ed|s|ing)?|inquir(?:ed|es|ing))\s+about\b.{0,30}\bcard\s+(?:details|data|number)\b|card\s+(?:details|data)\s+(?:security|policy|validation))/iu;

function shouldFlagCardDataRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previous = clauses[index - 1] ?? "";
    const candidate =
      CARD_DATA_OBJECT_RE.test(previous) && PRONOUN_REQUEST_RE.test(clause)
        ? `${clause} card number`
        : clause;
    return (
      CARD_DATA_ASK_RE.test(candidate) &&
      CARD_DATA_OBJECT_RE.test(candidate) &&
      !CARD_DATA_SAFETY_RE.test(candidate) &&
      !isGeneralSafetyClause(clause) &&
      !CARD_DATA_NEUTRAL_RE.test(candidate)
    );
  });
}

// Real-world attackers often avoid the literal word "code/SMS" and instead ask
// the victim to read back digits ("dictate the numbers", "name the six digits
// that I'll send"). Combined with a hint that those digits come from a message
// or device, this is the same OTP-extraction tactic.
const PROXY_CODE_ASK_RE =
  /(продиктуй(те)?|назов(и|ите)|скаж(и|ите)|озвуч(ь|ьте)|прочитай(те)?|передай(те)?|сбрось(те)?|напиши(те)?|введите|скинь(те)?|подели(сь|тесь)|сообщ(и|ите)|пришлит(е|ь)?|отправь(те)?|предоставь(те)?|укажите)|(ayting|aytingiz|o['’]?qib bering|jo['’]?nating|kiriting|yozing|baham ko['’]?ring|yuboring)|\b(tell|read|send|share|give|enter|type|forward|provide)\b/i;
const PROXY_CODE_DIGIT_RE =
  /(цифр(ы|у|ах)?|числ(а|о)|код(ом|а|у)?|символ(ы|ов)?|number|digits?|kod(ni)?|raqam(ni|lar|lari)?|belgi)/i;
const PROXY_CODE_CONTEXT_SOURCE_RE =
  /(из сообщени|из (смс|sms|telegram|телеграмма?)|с экрана|из приложени|из (письма|бота)|(?:из|в) уведомлени|from (message|sms|app|notification)|xabar|ilova)/i;
const PROXY_CODE_STRONG_SOURCE_RE =
  /(котор(ый|ая|ое|ые).{0,30}(прид[её]т|приш(?:л|ёл|е?л)|приходит|отправл[её]н|отправлю|пришлю|передам|сброшу|направлю|смс|sms)|то,? что.{0,30}(прид[её]т|приш(?:л|ёл|е?л)|приходит|отправл[её]н|отправлю|пришлю|передам|сброшу|направлю)|что (прид[её]т|приш(?:л|ёл))|(прид[её]т|приш(?:л|ёл|е?л)).{0,15}код|u sizga.{0,40}keladi|(?:code|digits?).{0,30}(?:you\s+)?(?:receive|received|arrive|arrived|were\s+sent)|(?:received|arriving).{0,20}(?:code|digits?))/i;
const PROXY_CODE_COUNT_RE =
  /\b\d|значн|шесть|шести|четыре|четыр[её]х|пять|пяти|olti|to['’]?rt|besh|xonali|raqamli/i;
const PROXY_CODE_NEUTRAL_CONTEXT_RE =
  /(код города|городской код|почтов(ый|ого) код|код товара|артикул|номер заказа|order number|postal code|city code|dress code|coupon code|promo(?:tional)? code|tracking code|code style|shahar kodi|kod shahri)/i;
const PHYSICAL_ACCESS_CODE_RE =
  /(?:(?:door|entrance|gate|подъезд|домофон|двер|ворот|eshik|darvoza).{0,40}(?:code|код|kod)|(?:code|код|kod).{0,40}(?:door|entrance|gate|подъезд|домофон|двер|ворот|eshik|darvoza))/iu;
const OTP_CODE_CONTEXT_RE =
  /(?:sms|смс|otp|one[\s-]?time|verification|confirmation|подтвержд|tasdiq|xabar|сообщени|notification|уведомлен)/iu;
const GENERIC_CODE_PROGRAMMING_RE =
  /(?:исходн(?:ый|ого)\s+код|пример\s+кода|код\s+на\s+(?:python|javascript|typescript|java)|source\s+code|code\s+(?:sample|example)|python|javascript|typescript|programming|dastur\s+kodi)/iu;
const GENERIC_CODE_REQUEST_RE =
  /(?:(?:отправь|пришли|скинь|введи|скажи|назови|прочитай|озвучь|продиктуй|передай|предоставь|укажи|сообщи|просят|просит|требуют|требует).{0,35}(?:этот\s+|тот\s+|сам\s+)?код|(?:попросил(?:и|а)?|просил(?:и|а)?|требовал(?:и|а)?).{0,45}(?:отправить|прислать|назвать|сообщить|продиктовать|передать).{0,25}код|\b(?:read(?:\s+out)?|enter|forward|tell|send|share|give|reveal|provide|submit)\b.{0,45}(?:the\s+|your\s+|this\s+|a\s+)?code|\b(?:ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?|want(?:ed|s|ing)?)\b.{0,45}(?:the\s+|your\s+|this\s+|a\s+|my\s+)?(?:verification\s+)?code|(?:the\s+|my\s+|your\s+)?(?:verification\s+)?code.{0,30}\b(?:was|is|has\s+been)\s+(?:requested|required|wanted|demanded)\b|(?:kodni|kod).{0,35}(?:yubor|ayt|o['’]?qib\s+ber|jo['’]?nat|talab)|(?:yubor|ayt|o['’]?qib\s+ber|jo['’]?nat|talab).{0,35}(?:kodni|kod))/iu;
const GENERIC_CODE_SAFETY_RE =
  /(?:(?:не\s+(?:отправля|вводи|говори|называ|передава|показыва)|(?:do\s+not|don['’]?t|never)\s+(?:send|enter|tell|share|give|forward|reveal|provide|submit)).{0,35}(?:код|code|otp)|(?:код|otp).{0,35}никому\s+не\s+(?:сообщ|говор|переда|отправ)|(?:keep|keeps|keeping).{0,20}(?:code|otp).{0,20}secret|nobody.{0,25}(?:received|got|was\s+sent).{0,20}(?:my\s+)?(?:code|otp)|(?:kodni|kod).{0,30}(?:yubormang|aytmang|kiritmang|jo['’]?natmang|yubormadim|aytmadim|kiritmadim|jo['’]?natmadim))/iu;

const ACCOUNT_CODE_CONTEXT_RE =
  /(?:банк|банков|сч[её]т|аккаунт|вход|логин|telegram|телеграм|bank|banking|account|login|sign[\s-]?in|hisob|kirish)/iu;
const CODE_TOKEN_RE = /(?:код|code|kod)/giu;

function isPhysicalAccessCodeOnly(text: string): boolean {
  const clauses = splitRiskClauses(text);
  if (!clauses.some((clause) => PHYSICAL_ACCESS_CODE_RE.test(clause))) return false;

  return clauses.every((clause) => {
    if (!PHYSICAL_ACCESS_CODE_RE.test(clause)) {
      return (
        !GENERIC_CODE_REQUEST_RE.test(clause) &&
        !(PROXY_CODE_ASK_RE.test(clause) && PROXY_CODE_DIGIT_RE.test(clause))
      );
    }

    const codeMentions = clause.match(CODE_TOKEN_RE)?.length ?? 0;
    const asksForAnotherCode =
      codeMentions > 1 && (GENERIC_CODE_REQUEST_RE.test(clause) || PROXY_CODE_ASK_RE.test(clause));
    return (
      !OTP_CODE_CONTEXT_RE.test(clause) &&
      !ACCOUNT_CODE_CONTEXT_RE.test(clause) &&
      !asksForAnotherCode
    );
  });
}

const GENERIC_PASSWORD_REQUEST_RE =
  /(?:(?:скажи|назови|введи|отправь|пришли|покажи|раскрой|продиктуй|предоставь|укажи|сообщи|передай|просят|просит|требуют|требует).{0,35}(?:парол|password)|(?:попросил(?:и|а)?|просил(?:и|а)?|требовал(?:и|а)?).{0,45}(?:назвать|сообщить|отправить|прислать|раскрыть|продиктовать).{0,25}(?:парол|password)|\b(?:tell|enter|send|share|show|reveal|forward|provide|submit)\b.{0,35}(?:the\s+|your\s+|this\s+|a\s+|my\s+)?(?:bank\s+)?password|\b(?:ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?|want(?:ed|s|ing)?)\b.{0,35}(?:the\s+|your\s+|this\s+|my\s+)(?:bank\s+)?password|(?:the\s+|my\s+|your\s+)?(?:bank\s+)?password.{0,30}\b(?:was|is|has\s+been)\s+(?:requested|required|wanted|demanded)\b|(?:parolni|parol).{0,30}(?:ayt|kirit|yubor|ko['’]?rsat|talab)|(?:ayt|kirit|yubor|ko['’]?rsat|talab).{0,30}(?:parolni|parol))/iu;
const GENERIC_PASSWORD_NEUTRAL_RE =
  /(?:wi[-\s]?fi|router|роутер|вай[-\s]?фай|office\s+wifi|mehmon\s+wifi|password\s+policy|парольн.{0,15}политик|password\s+reset\s+(?:instruction|guide|steps?)|(?:advice|tips?|guidance).{0,24}password\s+(?:security|protection)|совет.{0,24}(?:защит|безопасн).{0,20}парол|password\s+field.{0,24}(?:ui|form|screen|interface)|(?:ui|form|screen|interface).{0,24}password\s+field|change\s+(?:a|the|your)\s+password|create\s+(?:a|the|your)\s+password|requires?\s+(?:a\s+)?password\s+to\s+(?:sign|log)\s+in)/iu;
const GENERIC_PASSWORD_SAFETY_RE =
  /(?:(?:не\s+(?:отправля|вводи|говори|называ|передава|показыва|раскрыва)|(?:do\s+not|don['’]?t|never)\s+(?:send|enter|tell|share|give|show|forward|reveal|provide|submit)).{0,35}(?:парол|password)|(?:parolni|parol).{0,30}(?:yubormang|aytmang|kiritmang|ko['’]?rsatmang))/iu;

function shouldFlagProxyCodeRequest(text: string): boolean {
  const eligibleText = splitRiskClauses(text)
    .filter(
      (clause) =>
        !isPhysicalAccessCodeOnly(clause) &&
        !PROXY_CODE_NEUTRAL_CONTEXT_RE.test(clause) &&
        !GENERIC_CODE_PROGRAMMING_RE.test(clause),
    )
    .join(", ");
  if (!eligibleText) return false;
  if (/(?:cvv|cvc|xavfsizlik\s+kodi|security\s+code)/iu.test(eligibleText)) return false;
  if (
    /(?:прочитай|прочитайте)\s+то,?\s+что.{0,40}(?:прид[её]т|пришл[её]т).{0,40}уведомлени/iu.test(
      eligibleText,
    )
  ) {
    return true;
  }
  if (!PROXY_CODE_ASK_RE.test(eligibleText)) return false;
  if (PROXY_CODE_STRONG_SOURCE_RE.test(eligibleText)) {
    const clauses = splitRiskClauses(eligibleText);
    return clauses.some((clause, index) => {
      if (!PROXY_CODE_ASK_RE.test(clause)) return false;
      if (PROXY_CODE_DIGIT_RE.test(clause)) return true;
      if (PROXY_CODE_CONTEXT_SOURCE_RE.test(clause) && PROXY_CODE_STRONG_SOURCE_RE.test(clause)) {
        return true;
      }
      const previous = clauses[index - 1] ?? "";
      const next = clauses[index + 1] ?? "";
      return (
        (PROXY_CODE_STRONG_SOURCE_RE.test(previous) && PRONOUN_REQUEST_RE.test(clause)) ||
        (/(?:\bто\b|\bwhat\b)/iu.test(clause) &&
          PROXY_CODE_STRONG_SOURCE_RE.test(`${clause}, ${next}`) &&
          PROXY_CODE_CONTEXT_SOURCE_RE.test(next))
      );
    });
  }
  const hasDigitObject = PROXY_CODE_DIGIT_RE.test(eligibleText);
  const hasContextSource = PROXY_CODE_CONTEXT_SOURCE_RE.test(eligibleText);
  // Otherwise require a digit/code object AND a digit-count hint to avoid
  // matching "dictate your full name" or "say your address".
  return hasDigitObject && (hasContextSource || PROXY_CODE_COUNT_RE.test(eligibleText));
}

function shouldFlagGenericCodeRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previous = clauses[index - 1] ?? "";
    const previousIsTypedNonOtpCode =
      /(?:qr.?code|qr.?код|qr.?kod|cvv|cvc|security\s+code|код\s+безопасности|xavfsizlik\s+kodi|\bpin\b|\bпин\b|pin.?код)/iu.test(
        previous,
      );
    const carriesCode =
      /(?:sms|otp|verification\s+code|код|kod|\bcode\b)/iu.test(previous) &&
      !previousIsTypedNonOtpCode &&
      !isPhysicalAccessCodeOnly(previous) &&
      !PROXY_CODE_NEUTRAL_CONTEXT_RE.test(previous) &&
      !GENERIC_CODE_PROGRAMMING_RE.test(previous) &&
      PRONOUN_REQUEST_RE.test(clause);
    const candidate = carriesCode ? `${clause} code` : clause;
    if (isPhysicalAccessCodeOnly(candidate)) return false;
    if (carriesCode && !isGeneralSafetyClause(clause)) return true;
    return (
      !PROXY_CODE_NEUTRAL_CONTEXT_RE.test(candidate) &&
      !GENERIC_CODE_PROGRAMMING_RE.test(candidate) &&
      !/(?:cvv|cvc|xavfsizlik\s+kodi|security\s+code|karta(?:ning)?.{0,20}kod)/iu.test(candidate) &&
      !/(?:qr.?код|qr.?kod|qr code)/iu.test(candidate) &&
      GENERIC_CODE_REQUEST_RE.test(candidate) &&
      !GENERIC_CODE_SAFETY_RE.test(candidate) &&
      !isGeneralSafetyClause(clause)
    );
  });
}

function shouldFlagGenericPasswordRequest(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previousMentionsPassword =
      index > 0 && /(?:парол|password|parol)/iu.test(clauses[index - 1] ?? "");
    const carriesPassword = previousMentionsPassword && PRONOUN_REQUEST_RE.test(clause);
    const candidate = carriesPassword ? `${clause} password` : clause;
    return (
      !GENERIC_PASSWORD_NEUTRAL_RE.test(candidate) &&
      GENERIC_PASSWORD_REQUEST_RE.test(candidate) &&
      !GENERIC_PASSWORD_SAFETY_RE.test(candidate) &&
      !isGeneralSafetyClause(clause)
    );
  });
}

const QR_MENTION_RE = /(qr.?код|qr.?kod|qr code|qr)/i;
const QR_SCAN_ACTION_RE =
  /(скан|отскан|перейд|откр|оплат(?:и|ите)(?![\p{L}])|\bskaner|\bo['’]t|\boch|\bto['’]la(?:ng)?\b|\bscan\b|\bopen\b|\bfollow\b|\bpay\b)/iu;
const QR_DIRECT_ACTION_RE =
  /(?:(?:сканируй|отсканируй|перейди|открой|оплати).{0,25}qr|qr.{0,25}(?:сканируй|отсканируй|перейди|открой|оплати)|(?:qr(?:ni|[-\s]?(?:kodni|kod))|qr\s+orqali).{0,30}(?:skaner(?:lang|la\b|\s+qil(?:ing)?\b)|o['’]?t(?:ing)?\b|\boch(?:ing)?\b|ochib\s+ko['’]?ring|to['’]?la(?:ng)?\b)|\b(?:scan|open|follow|pay)\b.{0,18}(?:(?:this|the|a|via|by)\s+)?qr)/iu;
const QR_REQUEST_ACTION_RE =
  /(?:(?:просят|просит|попросил(?:и|а)?|просил(?:и|а)?|велят|требуют|требует).{0,55}(?:сканир|отсканир).{0,25}qr|(?:ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|tell(?:s|ing)?|says?|wants?|must|needs?).{0,65}(?:(?:scan|open|follow|pay).{0,25}qr|qr.{0,20}scan)|qr.{0,20}scan.{0,30}\b(?:was|is|has\s+been)\s+(?:requested|required|wanted)\b|(?:qr(?:ni|[-\s]?(?:kodni|kod))|qr).{0,35}(?:skaner(?:lash|\s+qilish|\s+qil)).{0,35}(?:so['’]?ra(?:di|shdi|shyapti|yapti)|aytishdi|deyishdi)|(?:skaner(?:lash|\s+qilish)).{0,35}(?:so['’]?ra(?:di|shdi|shyapti|yapti)|aytishdi|deyishdi).{0,35}qr)/iu;
const QR_SAFETY_RE =
  /(?:(?:не\s+(?:сканируй|открывай|переходи|оплачивай)|(?:do\s+not|don['’]?t|never|did\s+not|didn['’]?t)\s+(?:scan|open|follow|pay)).{0,30}qr|\b(?:can|could|does|will|would)\s+(?:you|this\s+bot|the\s+bot|it)\s+(?:check|scan|review|inspect|analy[sz]e).{0,30}qr|qr.{0,30}(?:skaner\s+qil(?:mang|madim|madi|magan|mayman)|ochmang|o['’]?tmang|to['’]?lamang))/iu;
const QR_NEUTRAL_CONTEXT_RE =
  /(?:restaurant|menu|museum|audio\s+guide|wi[-\s]?fi|connect\s+to\s+wi[-\s]?fi|ресторан|меню|музе|аудиогид|вай[-\s]?фай|taomnom|menyu|muzey)/iu;
const QR_DANGEROUS_CONTEXT_RE =
  /(?:войти|вход|авториз|личн.{0,12}кабинет|аккаунт|подтверд|вериф|смс.{0,20}код|sms.{0,20}code|парол|pin|cvv|карт|банк|оплат|перевод|выигрыш|приз|розыгрыш|kiring|tizimga|hisob|akkaunt|tasdiq|parol|karta|bank|to['’]?lov|pul|sovrin|yutuq|login|account|verify|confirm|password|payment|transfer|card|prize|giveaway|lottery|telegram)/iu;

function shouldFlagQrScan(text: string): boolean {
  const clauses = splitRiskClauses(text);
  return clauses.some((clause, index) => {
    const previousMentionsQr = index > 0 && QR_MENTION_RE.test(clauses[index - 1] ?? "");
    const candidate = QR_MENTION_RE.test(clause) || !previousMentionsQr ? clause : `QR ${clause}`;
    const carriesQrRequest =
      previousMentionsQr && PRONOUN_REQUEST_RE.test(clause) && QR_SCAN_ACTION_RE.test(clause);
    return (
      QR_MENTION_RE.test(candidate) &&
      QR_SCAN_ACTION_RE.test(candidate) &&
      (QR_DIRECT_ACTION_RE.test(candidate) ||
        QR_REQUEST_ACTION_RE.test(candidate) ||
        carriesQrRequest) &&
      !QR_SAFETY_RE.test(clause) &&
      !isGeneralSafetyClause(clause) &&
      (!QR_NEUTRAL_CONTEXT_RE.test(candidate) || QR_DANGEROUS_CONTEXT_RE.test(candidate))
    );
  });
}

const SHORT_LINK_HOSTS = [
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "cutt.ly",
  "is.gd",
  "rebrand.ly",
  "clck.ru",
  "vk.cc",
  "ow.ly",
];

const SAFETY_SENSITIVE_PATTERN_CODES = new Set<ReasonCode>([
  "asks_for_otp",
  "asks_for_sms_code",
  "asks_to_install_apk",
  "asks_for_money_transfer",
  "asks_to_transfer_to_safe_account",
  "requests_card_digits",
  "fake_delivery_payment",
  "fake_boss_request",
]);
const USER_NEXT_STEP_QUESTION_RE =
  /(?:(?:что|как)\s+(?:мне\s+)?(?:теперь\s+)?(?:делать|поступить).{0,30}(?:прямо\s+сейчас|сейчас)|what\s+should\s+i\s+do.{0,30}(?:right\s+now|now)|hozir.{0,30}(?:nima\s+qil|qanday\s+yo['’]?l\s+tut))/iu;

export function evaluateText(text: string): ReasonCode[] {
  const normalized = normalizeIntentTextForMatching(text);
  const codes = evaluateTextScript(normalized);
  // Uzbek Cyrillic input must reach the same Uzbek Latin rule patterns
  // («Хавфсиз ҳисобга…» → `xavfsiz hisob`). The variant is additive and
  // classifier-only; each pass keeps its own negation/safety guards because
  // transliteration preserves protective wording (aytmang stays aytmang).
  const variant = uzbekLatinMatchingVariant(normalized);
  if (!variant) return codes;
  return [...new Set([...codes, ...evaluateTextScript(variant)])];
}

function evaluateTextScript(text: string): ReasonCode[] {
  const codes = new Set<ReasonCode>();
  const isStandaloneCodeSafetyWarning =
    GENERIC_CODE_SAFETY_RE.test(text) &&
    !hasUnsafeClause(text, GENERIC_CODE_REQUEST_RE, GENERIC_CODE_SAFETY_RE);
  for (const { code, re } of PATTERNS) {
    if (!re.test(text)) continue;
    if (code === "uses_urgency" && USER_NEXT_STEP_QUESTION_RE.test(text)) continue;
    if (code === "asks_to_install_apk" && isOrdinaryOfficialFineAppPayment(text)) continue;
    if (code === "fake_delivery_payment" && isOrdinaryPlannedSupplierPayment(text)) continue;
    if (code === "asks_for_money_transfer" && !shouldFlagDirectTransferRequest(text)) continue;
    if (code === "fake_boss_request" && !shouldFlagAuthorityRequest(text)) continue;
    if (
      code === "asks_to_transfer_to_safe_account" &&
      !shouldFlagSafeAccountTransferRequest(text)
    ) {
      continue;
    }
    if (code === "asks_for_sms_code" && isPhysicalAccessCodeOnly(text)) continue;
    if (code === "threatens_legal_action") {
      const legalClauses = splitRiskClauses(text);
      const hasUnsafeLegalClause = legalClauses.some((clause, index) => {
        const previousClause = legalClauses[index - 1] ?? "";
        const localWindow = [legalClauses[index - 1], clause, legalClauses[index + 1]]
          .filter(Boolean)
          .join(". ");
        if (LEGAL_LIVE_COERCION_RE.test(localWindow)) return true;
        if (!re.test(clause)) return false;
        const isProtectiveAuthorityNotice =
          (AUTHORITY_DANGEROUS_ACTOR_RE.test(localWindow) &&
            AUTHORITY_DANGEROUS_SAFETY_NOTICE_RE.test(localWindow) &&
            AUTHORITY_DANGEROUS_SAFETY_RE.test(localWindow) &&
            !AUTHORITY_DANGEROUS_CONDITIONAL_THREAT_RE.test(localWindow)) ||
          LEGAL_AUTHORITY_PUBLIC_SAFETY_RE.test(localWindow);
        const hasLocalNeutralLead =
          LAW_ENFORCEMENT_NEUTRAL_LEAD_RE.test(clause) ||
          LAW_ENFORCEMENT_NEUTRAL_LEAD_RE.test(previousClause);
        const isNeutralNewsOrLiability =
          NEUTRAL_LAW_ENFORCEMENT_NEWS_RE.test(clause) ||
          LEGAL_NEUTRAL_PUBLIC_LIABILITY_RE.test(clause) ||
          (hasLocalNeutralLead &&
            (NEUTRAL_LAW_ENFORCEMENT_NEWS_RE.test(localWindow) ||
              LEGAL_NEUTRAL_PUBLIC_LIABILITY_RE.test(localWindow)));
        return !(
          isProtectiveAuthorityNotice ||
          isNeutralNewsOrLiability ||
          LAW_ENFORCEMENT_CONTACT_INFO_RE.test(clause) ||
          LAW_ENFORCEMENT_EDUCATIONAL_EXAMPLE_RE.test(clause)
        );
      });
      if (!hasUnsafeLegalClause) continue;
    }
    if (
      SAFETY_SENSITIVE_PATTERN_CODES.has(code) &&
      GENERAL_SAFETY_ACTION_RE.test(text) &&
      !splitRiskClauses(text).some((clause) => re.test(clause) && !isGeneralSafetyClause(clause))
    ) {
      continue;
    }
    if (
      isStandaloneCodeSafetyWarning &&
      (code === "asks_for_sms_code" || code === "asks_for_otp")
    ) {
      continue;
    }
    codes.add(code);
  }
  if (shouldFlagQrScan(text)) codes.add("asks_to_scan_qr");
  if (shouldFlagScreenShareRequest(text)) codes.add("asks_to_share_screen");
  if (shouldFlagTelegramAccountTakeoverPhishing(text))
    codes.add("telegram_account_takeover_phishing");
  if (shouldFlagDropperRecruitment(text)) codes.add("dropper_recruitment");
  if (shouldFlagGamblingPredictionPromo(text)) codes.add("gambling_prediction_promo");
  if (shouldFlagGiveawayEngagementBait(text)) codes.add("giveaway_engagement_bait");
  if (shouldFlagCryptoCasinoBonusFunnel(text)) codes.add("crypto_casino_bonus_funnel");
  if (shouldFlagFakeCaptchaOrVoting(text)) codes.add("fake_captcha_or_voting");
  if (shouldFlagTaskRewardEngagementBait(text)) codes.add("task_reward_engagement_bait");
  if (shouldFlagUnauthorizedCreditOpened(text)) codes.add("unauthorized_credit_opened");
  if (shouldFlagCoerciveSecrecy(text)) codes.add("coercive_secrecy");
  if (shouldFlagWalletActionUrgency(text)) codes.add("wallet_action_urgency");
  if (shouldFlagTonReferralEarningScheme(text)) codes.add("ton_referral_earning_scheme");
  if (shouldFlagInvestmentFastProfitPitch(text)) codes.add("investment_fast_profit_pitch");
  if (shouldFlagRomanceInvestmentPivot(text)) codes.add("romance_investment_pivot");
  if (shouldFlagOneIdGovernmentPhishing(text)) codes.add("oneid_government_phishing");
  if (shouldFlagSimSwapOrNumberTransfer(text)) {
    codes.add("sim_swap_or_number_transfer");
  }
  if (shouldFlagMoneyMuleRecruitment(text)) codes.add("money_mule_recruitment");
  if (shouldFlagAdvanceFeePrizeInheritance(text)) codes.add("advance_fee_prize_inheritance");
  if (shouldFlagAuthorityCoercedDangerousAct(text)) {
    codes.add("authority_coerced_dangerous_act");
  }
  if (shouldFlagViolenceThreat(text)) codes.add("threatens_physical_violence");
  if (shouldFlagFakePenaltyPointsErasure(text)) codes.add("fake_penalty_points_erasure");
  if (shouldFlagMaliciousFileBait(text)) codes.add("malicious_file_bait");
  if (shouldFlagRoadCashbackFineApk(text)) codes.add("asks_to_install_apk");
  if (shouldFlagSoftCardCvvRequest(text)) codes.add("asks_for_card_cvv");
  if (shouldFlagSoftPinOrPasswordRequest(text)) codes.add("asks_for_pin");
  if (shouldFlagBossMediaTransferRequest(text)) codes.add("fake_boss_request");
  if (shouldFlagDirectTransferRequest(text)) codes.add("asks_for_money_transfer");
  if (codes.has("asks_for_money_transfer") && PRESSURED_TRANSFER_RE.test(text)) {
    codes.add("uses_urgency");
  }
  // “Safe account” is a specific observed phrase, not a synonym for every
  // transfer request. Avoid double-counting that single transfer signal.
  if (codes.has("asks_to_transfer_to_safe_account")) codes.delete("asks_for_money_transfer");
  if (shouldFlagPersonalDataRequest(text)) codes.add("requests_personal_data");
  if (shouldFlagCardDataRequest(text)) codes.add("requests_card_digits");
  if (shouldFlagProxyCodeRequest(text)) codes.add("asks_for_sms_code");
  if (shouldFlagGenericCodeRequest(text)) codes.add("asks_for_sms_code");
  // A generic "code" is already part of the SIM-swap evidence. Counting it
  // again as an SMS-code request overstates the same signal and turns the
  // actionable warning red. Keep the stronger extra signal when the message
  // explicitly says SMS, OTP, or verification code.
  if (
    codes.has("sim_swap_or_number_transfer") &&
    !/(?:смс|sms|otp|verification\s+code)/iu.test(text)
  ) {
    codes.delete("asks_for_sms_code");
  }
  if (shouldFlagGenericPasswordRequest(text)) codes.add("asks_for_pin");
  if (shouldFlagPrivateTelegramInviteEvidence(text)) codes.add("suspicious_invite_link");
  // Heuristics
  if (
    /\b\$\s?\d{2,}|\d+\s?(usd|у\.?е\.?)|\d+\s?(сум|so['’]m)/i.test(text) &&
    /(выигр|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|бесплатн|tabrik|sovrin|prize|won)/i.test(
      text,
    )
  ) {
    codes.add("too_good_to_be_true");
  }
  return [...codes];
}

function shouldFlagPrivateTelegramInviteEvidence(text: string): boolean {
  return /image evidence:\s*private telegram invite link/i.test(text);
}

const HOSTED_APP_DOMAINS = [
  "lovable.app",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "web.app",
  "github.io",
  "replit.app",
  "glitch.me",
  "railway.app",
  "render.com",
  "onrender.com",
  "fly.dev",
  "workers.dev",
  "surge.sh",
];

function isHostedAppHost(host: string): boolean {
  return HOSTED_APP_DOMAINS.some((domain) => host === domain || host.endsWith("." + domain));
}

export function evaluateUrl(url: string): ReasonCode[] {
  const codes: ReasonCode[] = [];
  const rawUrl = url.trim();
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl);
    const host = u.hostname.toLowerCase();
    // Detect hosted app platforms by hostname only (informational, weight 0).
    if (isHostedAppHost(host)) codes.push("hosted_app_platform");
    if (SHORT_LINK_HOSTS.some((h) => host === h || host.endsWith("." + h)))
      codes.push("suspicious_short_link");
    if (/\.apk(\?|$)/i.test(u.pathname)) codes.push("apk_download_link");
    // brand typo heuristic
    const brandTypos = [
      /uzc[ao]rt/i,
      /hum0/i,
      /pay[mn]e\d/,
      /clikc/i,
      /hamkrbank/i,
      /kap[ii]talbank.+\..+/,
    ];
    if (brandTypos.some((r) => r.test(host))) codes.push("brand_name_typo");
    // weird tld for UZ context
    if (/\.(xyz|top|click|gq|cf|tk|ml|loan|work)$/i.test(host)) codes.push("weird_domain");
    // ip address
    if (/^\d+\.\d+\.\d+\.\d+/.test(host)) codes.push("weird_domain");
  } catch {
    codes.push("weird_domain");
  }
  return codes;
}

export function evaluatePhone(phone: string): ReasonCode[] {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("998") && d.length === 12) return ["valid_uz_phone"];
  if (d.length >= 7) return ["non_uz_phone"];
  return [];
}

/** Suspicious Telegram username/link heuristics. */
export function evaluateTelegram(handle: string): ReasonCode[] {
  const codes: ReasonCode[] = ["unknown_sender"];
  const lower = handle.toLowerCase().replace(/^@/, "");

  // Suspicious keywords in username (impersonation signals)
  const SUSPICIOUS_KEYWORDS = [
    "support",
    "bank",
    "security",
    "operator",
    "admin",
    "helper",
    "oficial",
    "official",
    "service",
    "helpdesk",
    "moderator",
    "payme",
    "click",
    "uzum",
    "luxebet",
    "stavka",
    "prognoz",
    "betting",
    "kapital",
    "ipak",
    "anor",
    "aloqa",
  ];
  const hasSuspiciousKeyword = SUSPICIOUS_KEYWORDS.some((kw) => lower.includes(kw));

  // t.me/+... invite links — closed groups used for "investment/lottery" scams
  const isInviteLink = /^\+[A-Za-z0-9_-]+$/.test(lower) || handle.includes("t.me/+");

  if (hasSuspiciousKeyword) {
    codes.push("impersonates_official" as ReasonCode);
  }
  if (isInviteLink) {
    codes.push("suspicious_invite_link" as ReasonCode);
    if (/(nft|gift|stars?|prize|giveaway|airdrop|lottery)/i.test(lower)) {
      codes.push("giveaway_engagement_bait" as ReasonCode);
    }
  }

  return codes;
}

export function scoreFromCodes(codes: ReasonCode[]): { score: number; level: RiskLevel } {
  let score = 0;
  for (const c of codes) score += WEIGHTS[c] ?? 0;
  if (codes.includes("verified_official") && canVerifiedContactMarkSafe(codes)) {
    return { score: 0, level: "safe" };
  }
  if (codes.includes("brand_impersonation") && codes.includes("hosted_app_platform")) {
    score = Math.max(score, 50);
  }
  if (codes.includes("suspicious_invite_link") && codes.includes("giveaway_engagement_bait")) {
    score = Math.max(score, 50);
  }
  if (score >= 50) return { score, level: "high_risk" };
  if (score >= 20) return { score, level: "suspicious" };
  if (score > 0) return { score, level: "unknown" };
  return { score, level: "unknown" };
}

export const REASON_LABELS: Record<ReasonCode, { ru: string; uz: string; en: string }> = {
  asks_for_otp: { ru: "Просят OTP-код", uz: "OTP kodini so‘rashmoqda", en: "Asks for an OTP code" },
  asks_for_sms_code: {
    ru: "Просят SMS-код подтверждения",
    uz: "SMS tasdiqlash kodini so‘rashmoqda",
    en: "Asks for an SMS confirmation code",
  },
  asks_for_card_cvv: {
    ru: "Просят CVV/CVC карты",
    uz: "Karta CVV/CVC raqamini so‘rashmoqda",
    en: "Asks for the card CVV/CVC",
  },
  asks_for_pin: { ru: "Просят PIN-код", uz: "PIN kodni so‘rashmoqda", en: "Asks for the PIN code" },
  asks_to_install_apk: {
    ru: "Просят установить APK / приложение",
    uz: "APK / ilova o‘rnatishni so‘rashmoqda",
    en: "Asks to install an APK / app",
  },
  asks_to_share_screen: {
    ru: "Просят демонстрацию экрана",
    uz: "Ekran ulashishni so‘rashmoqda",
    en: "Asks to share your screen",
  },
  asks_for_money_transfer: {
    ru: "Просят перевести деньги или оплатить",
    uz: "Pul o‘tkazish yoki to‘lov qilishni so‘rashmoqda",
    en: "Asks for a money transfer or payment",
  },
  asks_to_transfer_to_safe_account: {
    ru: "Предлагают «безопасный счёт»",
    uz: "«Xavfsiz hisob»ga pul o‘tkazishni taklif qilishmoqda",
    en: "Proposes a transfer to a ‘safe account’",
  },
  impersonates_bank: {
    ru: "Выдают себя за сотрудника банка",
    uz: "O‘zini bank xodimi qilib ko‘rsatmoqda",
    en: "Impersonates a bank employee",
  },
  impersonates_operator: {
    ru: "Выдают себя за мобильного оператора",
    uz: "O‘zini mobil operator qilib ko‘rsatmoqda",
    en: "Impersonates a mobile operator",
  },
  uses_urgency: {
    ru: "Создают ощущение срочности",
    uz: "Shoshilinchlik bosimi yaratmoqda",
    en: "Uses urgency pressure",
  },
  threatens_legal_action: {
    ru: "Угрожают полицией / судом",
    uz: "Politsiya yoki sud bilan qo‘rqitmoqda",
    en: "Threatens legal action",
  },
  asks_not_to_hang_up: {
    ru: "Просят не класть трубку",
    uz: "Telefonni qo‘ymaslikni so‘rashmoqda",
    en: "Tells you not to hang up",
  },
  telegram_bank_contact: {
    ru: "Контакт «банка» через Telegram",
    uz: "Bank Telegram orqali bog‘lanmoqda",
    en: "Claims to be a bank via Telegram",
  },
  fake_loan_offer: {
    ru: "Подозрительное предложение кредита",
    uz: "Shubhali kredit taklifi",
    en: "Suspicious loan offer",
  },
  suspicious_short_link: {
    ru: "Сокращённая ссылка",
    uz: "Qisqartirilgan havola",
    en: "Shortened link",
  },
  apk_download_link: {
    ru: "Ссылка на скачивание APK",
    uz: "APK yuklab olish havolasi",
    en: "APK download link",
  },
  unknown_sender: { ru: "Отправитель неизвестен", uz: "Yuboruvchi noma’lum", en: "Unknown sender" },
  new_telegram_account: {
    ru: "Новый Telegram-аккаунт",
    uz: "Yangi Telegram hisob",
    en: "New Telegram account",
  },
  weird_domain: { ru: "Подозрительный домен", uz: "Shubhali domen", en: "Suspicious domain" },
  brand_name_typo: {
    ru: "Опечатка в названии бренда",
    uz: "Brend nomida xatolik",
    en: "Brand name typo",
  },
  payment_before_service: {
    ru: "Предоплата до услуги",
    uz: "Xizmatdan oldin to‘lov",
    en: "Payment requested before service",
  },
  too_good_to_be_true: {
    ru: "Слишком хорошее предложение",
    uz: "Haqiqatga to‘g‘ri kelmaydigan taklif",
    en: "Too good to be true",
  },
  requests_personal_data: {
    ru: "Запрашивают личные данные",
    uz: "Shaxsiy ma’lumotlarni so‘rashmoqda",
    en: "Requests personal data",
  },
  non_uz_phone: {
    ru: "Не узбекский номер",
    uz: "O‘zbek raqami emas",
    en: "Non-Uzbek phone number",
  },
  valid_uz_phone: {
    ru: "Корректный узбекский номер",
    uz: "To‘g‘ri O‘zbek raqami",
    en: "Valid Uzbek phone",
  },
  verified_official: {
    ru: "Проверенный официальный контакт",
    uz: "Tasdiqlangan rasmiy kontakt",
    en: "Verified official contact",
  },
  known_reported: {
    ru: "Идентификатор уже подтверждён в жалобах",
    uz: "Bu identifikator oldin tasdiqlangan shikoyatlarda bor",
    en: "Identifier is already confirmed in reports",
  },
  asks_to_scan_qr: {
    ru: "Просят отсканировать QR-код",
    uz: "QR-kodni skanerlashni so‘rashmoqda",
    en: "Asks you to scan a QR code",
  },
  relative_in_distress: {
    ru: "«Родственник/друг в беде» — срочный перевод",
    uz: "«Qarindosh/do‘st xavf ostida» — shoshilinch pul",
    en: "“Relative/friend in distress” money request",
  },
  requests_card_digits: {
    ru: "Просят назвать цифры карты",
    uz: "Karta raqamlarini aytishni so‘rashmoqda",
    en: "Asks you to reveal card digits",
  },
  threatens_account_block: {
    ru: "Угрожают блокировкой счёта / карты",
    uz: "Hisob / kartani bloklash bilan qo‘rqitmoqda",
    en: "Threatens to block your account / card",
  },
  fake_delivery_payment: {
    ru: "Подозрительный запрос оплаты доставки",
    uz: "Shubhali yetkazib berish to‘lovi so‘rovi",
    en: "Suspicious delivery-payment request",
  },
  fake_boss_request: {
    ru: "Подозрительный запрос от имени руководителя или ведомства",
    uz: "Rahbar yoki idora nomidan shubhali so‘rov",
    en: "Suspicious request claiming employer or official authority",
  },
  malicious_file_bait: {
    ru: "Побуждают открыть подозрительный файл",
    uz: "Shubhali faylni ochishga undashmoqda",
    en: "Pushes you to open a suspicious file",
  },
  impersonates_official: {
    ru: "Подражает официальному аккаунту",
    uz: "Rasmiy akkauntga taqlid qiladi",
    en: "Impersonates an official account",
  },
  suspicious_invite_link: {
    ru: "Подозрительная invite-ссылка в закрытую группу",
    uz: "Yopiq guruhga shubhali taklif havolasi",
    en: "Suspicious invite link to a closed group",
  },
  gambling_prediction_promo: {
    ru: "Закрытый канал со ставками или прогнозами",
    uz: "Yopiq stavka yoki prognoz kanali",
    en: "Closed betting or prediction channel",
  },
  giveaway_engagement_bait: {
    ru: "Розыгрыш или подарок за действия",
    uz: "Harakat evaziga sovg'a yoki yutuq",
    en: "Giveaway or prize bait",
  },
  crypto_casino_bonus_funnel: {
    ru: "Казино/фриспины с бонусом или депозитом",
    uz: "Kazino/frispin bonus yoki depozit bilan",
    en: "Casino/free-spins bonus funnel",
  },
  fake_captcha_or_voting: {
    ru: "Капча/голосование ради приза",
    uz: "Sovrin uchun captcha/ovoz berish",
    en: "Captcha/voting prize gate",
  },
  task_reward_engagement_bait: {
    ru: "Вознаграждение за простые действия",
    uz: "Oddiy harakatlar uchun mukofot",
    en: "Reward for simple tasks",
  },
  unauthorized_credit_opened: {
    ru: "Кредит или рассрочка оформлены без согласия",
    uz: "Kredit yoki nasiya roziliksiz rasmiylashtirilgan",
    en: "Loan or BNPL account opened without consent",
  },
  coercive_secrecy: {
    ru: "Требуют скрывать «операцию» или расследование",
    uz: "«Operatsiya» yoki tergovni sir saqlashni talab qilmoqda",
    en: "Demands secrecy about an “operation” or investigation",
  },
  wallet_action_urgency: {
    ru: "Срочное действие с кошельком или токеном",
    uz: "Hamyon yoki token bilan shoshilinch amal",
    en: "Urgent wallet or token action",
  },
  ton_referral_earning_scheme: {
    ru: "TON/крипто за приглашения",
    uz: "Takliflar uchun TON/kripto",
    en: "TON/crypto referral earning",
  },
  investment_fast_profit_pitch: {
    ru: "Инвест-питч с быстрым доходом",
    uz: "Tez daromad va'dasi bilan investitsiya taklifi",
    en: "Investment pitch with fast-profit promise",
  },
  romance_investment_pivot: {
    ru: "Доверие или романтическое общение переводят в инвестицию",
    uz: "Ishonch yoki munosabat orqali investitsiyaga undashmoqda",
    en: "Romance/trust conversation pivots to an investment",
  },
  oneid_government_phishing: {
    ru: "Фишинг под OneID, госуслуги или налоговый кабинет",
    uz: "OneID, davlat xizmati yoki soliq kabineti fishingi",
    en: "OneID, government-service, or tax-account phishing",
  },
  sim_swap_or_number_transfer: {
    ru: "Просят подтвердить перевыпуск SIM или перенос номера",
    uz: "SIM almashtirish yoki raqam ko'chirishni tasdiqlashni so'rashmoqda",
    en: "Asks to confirm a SIM reissue or number transfer",
  },
  money_mule_recruitment: {
    ru: "Просят принять и переслать чужие деньги за процент",
    uz: "Begona pulni qabul qilib, foiz evaziga o'tkazishni so'rashmoqda",
    en: "Asks you to receive and forward money for a commission",
  },
  advance_fee_prize_inheritance: {
    ru: "Просят оплатить сбор, налог или аванс до приза, визы или наследства",
    uz: "Sovrin, viza yoki merosdan oldin soliq/to'lov/avans so'rashmoqda",
    en: "Asks for a fee, tax, or deposit before a prize, visa, or inheritance",
  },
  external_phishing_url: {
    ru: "Ссылка найдена в фишинговой базе",
    uz: "Havola fishing bazasida topildi",
    en: "URL found in a phishing feed",
  },
  external_malware_url: {
    ru: "Ссылка найдена в базе вредоносных сайтов",
    uz: "Havola zararli saytlar bazasida topildi",
    en: "URL found in a malware feed",
  },
  hosted_app_platform: {
    ru: "Размещён на публичной платформе",
    uz: "Ommaviy platformada joylashgan",
    en: "Hosted on a public platform",
  },
  brand_impersonation: {
    ru: "Подражает известному бренду",
    uz: "Taniqli brendga taqlid qilmoqda",
    en: "Impersonates a known brand",
  },
  telegram_account_takeover_phishing: {
    ru: "Похоже на попытку угнать Telegram-аккаунт",
    uz: "Telegram akkauntini egallashga urinishga o'xshaydi",
    en: "Looks like a Telegram account takeover attempt",
  },
  dropper_recruitment: {
    ru: "Просят передать карту, SIM или аккаунт третьим лицам",
    uz: "Karta, SIM yoki akkauntni boshqa odamga berishni so'rashmoqda",
    en: "Asks to hand over a card, SIM, or account to someone else",
  },
  authority_coerced_dangerous_act: {
    ru: "От имени ведомства принуждают к опасному или незаконному действию",
    uz: "Idora nomidan xavfli yoki noqonuniy ishga majburlashmoqda",
    en: "Claimed authority coerces a dangerous or illegal physical act",
  },
  fake_penalty_points_erasure: {
    ru: "Предлагают за деньги удалить штрафные баллы",
    uz: "Pul evaziga jarima ballarini o‘chirishni taklif qilishmoqda",
    en: "Offers to erase traffic penalty points for money",
  },
  threatens_physical_violence: {
    ru: "Угрожают приехать или применить физическое насилие",
    uz: "Kelib qolish yoki jismoniy zo‘ravonlik bilan tahdid qilishmoqda",
    en: "Threatens to come to you or use physical violence",
  },
};

export const ADVICE: Record<RiskLevel, { ru: string[]; uz: string[]; en: string[] }> = {
  safe: {
    ru: [
      "\u042f\u0432\u043d\u044b\u0445 \u043f\u0440\u0438\u0437\u043d\u0430\u043a\u043e\u0432 \u043c\u043e\u0448\u0435\u043d\u043d\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.",
      "\u041d\u043e \u043f\u043e\u043c\u043d\u0438\u0442\u0435: \u043d\u0438\u043a\u043e\u0433\u0434\u0430 \u043d\u0435 \u0441\u043e\u043e\u0431\u0449\u0430\u0439\u0442\u0435 OTP, PIN, CVV \u0438\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u0438 \u2014 \u0434\u0430\u0436\u0435 \u0435\u0441\u043b\u0438 \u0437\u0432\u043e\u043d\u044f\u0449\u0438\u0439 \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0431\u0430\u043d\u043a\u043e\u043c.",
      "\u0415\u0441\u043b\u0438 \u0447\u0442\u043e-\u0442\u043e \u0432\u044b\u0437\u044b\u0432\u0430\u0435\u0442 \u0441\u043e\u043c\u043d\u0435\u043d\u0438\u044f \u2014 \u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435 \u0442\u0440\u0443\u0431\u043a\u0443 \u0438 \u043f\u0435\u0440\u0435\u0437\u0432\u043e\u043d\u0438\u0442\u0435 \u043f\u043e \u043e\u0444\u0438\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u043c\u0443 \u043d\u043e\u043c\u0435\u0440\u0443.",
    ],
    uz: [
      "Firibgarlikning aniq belgilari topilmadi.",
      "Lekin esda tuting: hech qachon OTP, PIN, CVV yoki parolni aytmang \u2014 hatto qo\u2018ng\u2018iroq qiluvchi o\u2018zini bank deb tanishtirsa ham.",
      "Biror narsa shubha tug\u2018dirsa \u2014 go\u2018shakni qo\u2018ying va rasmiy raqamga o\u2018zingiz qo\u2018ng\u2018iroq qiling.",
    ],
    en: [
      "No obvious fraud signals found.",
      "But remember: never share OTP, PIN, CVV or passwords \u2014 even if the caller claims to be your bank.",
      "If anything feels off \u2014 hang up and call back using the official number.",
    ],
  },
  unknown: {
    ru: [
      "\u0414\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043e\u0446\u0435\u043d\u043a\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u2014 \u0431\u0443\u0434\u044c\u0442\u0435 \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u044b.",
      "\u041d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0439\u0442\u0435 SMS-\u043a\u043e\u0434\u044b \u0438 \u043d\u0435 \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u0438\u0442\u0435 \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0430\u043c.",
      "\u041d\u0435 \u0443\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0439\u0442\u0435 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u0438\u0437 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439.",
      "\u0415\u0441\u043b\u0438 \u0441\u043e\u0431\u0435\u0441\u0435\u0434\u043d\u0438\u043a \u0434\u0430\u0432\u0438\u0442 \u0438\u043b\u0438 \u0442\u043e\u0440\u043e\u043f\u0438\u0442 \u2014 \u044d\u0442\u043e \u043f\u0440\u0438\u0437\u043d\u0430\u043a \u043c\u043e\u0448\u0435\u043d\u043d\u0438\u0447\u0435\u0441\u0442\u0432\u0430.",
    ],
    uz: [
      "Baholash uchun ma\u2018lumot yetarli emas \u2014 ehtiyot bo\u2018ling.",
      "SMS-kodlarni yubormang va havolalarga o\u2018tmang.",
      "Xabarlardan ilovalar o\u2018rnatmang.",
      "Agar suhbatdosh bosim qilsa yoki shoshiltirayotgan bo\u2018lsa \u2014 bu firibgarlik belgisi.",
    ],
    en: [
      "Not enough data to assess \u2014 stay cautious.",
      "Do not send SMS codes or click links.",
      "Do not install apps from messages.",
      "If the person pressures you or rushes you \u2014 that\u2019s a fraud signal.",
    ],
  },
  suspicious: {
    ru: [
      "Не передавайте OTP, PIN, CVV и пароли.",
      "Не переходите по ссылкам и не устанавливайте приложения.",
      "Перезвоните в банк / организацию по официальному номеру.",
      "Если просят перевести деньги «за родственника/друга в беде» — сначала свяжитесь с этим человеком напрямую по известному вам номеру.",
    ],
    uz: [
      "OTP, PIN, CVV va parollarni bermang.",
      "Havolalarga o‘tmang va ilovalar o‘rnatmang.",
      "Bank yoki tashkilotning rasmiy raqami orqali o‘zingiz qo‘ng‘iroq qiling.",
      "«Qarindosh/do‘st xavf ostida» deb pul so‘rashsa — avval o‘sha odamga o‘zingizga ma’lum raqam orqali bog‘laning.",
    ],
    en: [
      "Do not share OTP, PIN, CVV or passwords.",
      "Do not click links or install apps.",
      "Call the bank / company back using the official number.",
      "If asked to send money for a “relative/friend in distress”, first reach that person directly on a number you already know.",
    ],
  },
  high_risk: {
    ru: [
      "Не отправляйте код, не сообщайте данные карты.",
      "Не устанавливайте APK / приложение по их ссылке.",
      "Не открывайте GIF, открытки, архивы или файлы от неизвестного отправителя.",
      "Не сканируйте чужой QR-код: это может дать мошеннику доступ к вашему Telegram-аккаунту.",
      "Завершите разговор и перезвоните в банк по официальному номеру.",
      "Сделайте скриншоты переписки и сохраните номер.",
      "Сообщите о случае через форму «Сообщить о случае».",
    ],
    uz: [
      "Kod yubormang, karta ma’lumotlarini aytmang.",
      "Ularning havolasi orqali APK / ilova o‘rnatmang.",
      "Noma’lum yuboruvchidan kelgan GIF, otkritka, arxiv yoki faylni ochmang.",
      "Birovning QR-kodini skanerlamang: bu firibgarga Telegram hisobingizdan foydalanish imkonini berishi mumkin.",
      "Suhbatni tugatib, bankka rasmiy raqami orqali qo‘ng‘iroq qiling.",
      "Yozishmalarning skrinshotini saqlang.",
      "“Holat haqida xabar berish” formasi orqali xabar bering.",
    ],
    en: [
      "Don’t send codes or share card details.",
      "Don’t install any APK or app from their link.",
      "Don’t open GIFs, greeting cards, archives or files from an unknown sender.",
      "Don’t scan someone else’s QR code: it can give a scammer access to your Telegram account.",
      "End the call and dial your bank using the official number.",
      "Take screenshots of the chat and save the number.",
      "Submit the case via the “Report an incident” form.",
    ],
  },
};
