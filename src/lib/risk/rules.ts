import type { InputType } from "./detect";
import type { Database } from "@/integrations/supabase/types";

export type RiskLevel = Database["public"]["Enums"]["risk_level"];

export type ReasonCode =
  | "asks_for_otp"
  | "asks_for_sms_code"
  | "asks_for_card_cvv"
  | "asks_for_pin"
  | "asks_to_install_apk"
  | "asks_to_share_screen"
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
  | "dropper_recruitment";

const WEIGHTS: Record<ReasonCode, number> = {
  asks_for_otp: 45,
  asks_for_sms_code: 45,
  asks_for_card_cvv: 45,
  asks_for_pin: 45,
  asks_to_install_apk: 45,
  asks_to_share_screen: 35,
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
};

export function canVerifiedContactMarkSafe(codes: readonly ReasonCode[]): boolean {
  return codes.every((code) => REASON_TRUST_IMPACT[code] !== "risk");
}

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
    re: /(установ(и|ите).{0,30}(прилож|apk)|apk.{0,35}(?:скачайте|yuklab|o['’]?rnat)|(?:o['’]?rnat|yukla).{0,35}(?:ilova|apk)|install.{0,30}(app|apk))/i,
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
    code: "uses_urgency",
    re: /(срочно|немедленно|прямо сейчас|tezda|hozir|darhol|urgent|immediately|right now)/i,
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
    code: "asks_to_transfer_to_safe_account",
    re: /(переведите.{0,30}(счёт|карту|safe)|pul.{0,30}o['’]tkazing)/i,
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
    re: /((курьер|доставк|посылк|почт[аы]|parcel|delivery|shipping|kuryer|yetkazib|posilka).{0,90}(доплат|пошлин|сбор|комисс|вернут|возврат|ссылк|fee|returned|link|to['’]lov|havola|qaytar|komiss|boj|только.{0,25}(по\s+)?карт|по\s+карте|card\s+only|faqat.{0,25}karta)|(только.{0,25}(по\s+)?карт|по\s+карте|card\s+only|faqat.{0,25}karta).{0,90}(курьер|доставк|посылк|parcel|delivery|shipping|kuryer|yetkazib|posilka)|pay.{0,40}(delivery|shipping|parcel).{0,20}fee)/i,
  },
  {
    code: "payment_before_service",
    re: /(предоплат|аванс|задаток|оплатите.{0,30}(до|сначала)|брон[ьи].{0,30}(оплат|предоплат|аванс|задаток)|оплат.{0,30}брон|oldindan.{0,20}to['’]lov|avans|zaklad|bron.{0,30}(to['’]lov|tolov|pay|deposit|avans)|xizmatdan oldin|first.{0,20}pay|prepay|deposit|payment.{0,30}(?:requested|required).{0,25}before)/i,
  },
  {
    code: "fake_boss_request",
    re: /(начальник|директор|руководител|бухгалтер|кадр|отдел кадров|прокуратур|мвд|налогов|орган[аы]|rahbar|direktor|boshliq|kadr|buxgalter|soliq|prokuratura|iib).{0,90}(паспорт|анкета|данн|код|карт|перевод|срочно|отправ|pasport|ma['’]lumot|kod|karta|pul|yubor|tez)/i,
  },
  {
    code: "malicious_file_bait",
    re: /(открой|скачай|скачайте|посмотр|получите|open|download|ko['’]r|och|yuklab).{0,50}(gif|гиф|стикер|sticker|stiker|greeting card|открытк|fayl|file|файл|archive|архив|apk)/i,
  },
];

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
  return hasUnsafeClauseDespiteSafetyContext(text, DROPPER_TARGET_RE, DROPPER_ACTION_RE);
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
  /(розыгрыш|разыгр|random\s*nft|nft|банка подарков|подар|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|giveaway|airdrop|lottery|sovg'a|sovrin|yutuq)/i;
const GIVEAWAY_ACTION_RE =
  /(капч|captcha|реакци|reaction|проголос|голос|vote|подпис|subscribe|участв|раздач|выда[еёю]|stars?|зв[её]зд|ishtirok|ovoz|obuna|kanal|кошел|wallet|hamyon|sms|otp|код|карта|депозит|деп)/i;

function shouldFlagGiveawayEngagementBait(text: string): boolean {
  return GIVEAWAY_CONTEXT_RE.test(text) && GIVEAWAY_ACTION_RE.test(text);
}

const CRYPTO_CASINO_CONTEXT_RE =
  /(казино|азартн|слот|слоты|фри\s?спин|фриспин|free\s?spins?|casino|slots?|no\s?kyc|no\s?limits?|без\s?kyc|без\s+регистрации|twin|tonplay|luxe\s?bet|luxebet)/i;
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
  /(reward\s?pool|leaderboard|points?|campaign participants?|easycoin|выполняй|выполн.{0,20}действ|легк.{0,20}действ|задани|апгрейд|кейс|безпроигрышн|невозможно проиграть|топов.{0,20}приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|прокачивай|ochko|topshiriq|vazifa)/i;
const TASK_REWARD_BENEFIT_RE =
  /(\$\s?\d+|\d+[\s.,]?\d*\s?(usd|usdt|ton|stars?)|tokens?|токен|приз(?:ы|ов|а|у|е|ом|ам|ами|ах)?(?![а-яёa-z])|вывод|withdraw|заработ|получ|reward|earn|yutuq|mukofot|pul)/i;

function shouldFlagTaskRewardEngagementBait(text: string): boolean {
  return TASK_REWARD_CONTEXT_RE.test(text) && TASK_REWARD_BENEFIT_RE.test(text);
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
  /(инвест|трейд|торг|trading|trade|forex|gold|золото|валютн|бирж|рынок|крипт|crypto|investment|investits|daromad|foyda)/i;
const INVESTMENT_FAST_PROFIT_HOOK_RE =
  /(\+?\s?\d+(?:[.,]\d+)?\s?\$|\$\s?\d+|\d+\s?(?:usd|usdt|у\.?е\.?)|за\s+(?:день|сутки|час|недел|5\s+дней)|новичок|beginner|бесплатн|free|прям[о]?й эфир|механик|начать.{0,20}торг|гарантир|guaranteed|доходн|прибыл|profit|earn|заработ)/i;
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

function shouldFlagOneIdGovernmentPhishing(text: string): boolean {
  return ONEID_CONTEXT_RE.test(text) && ONEID_ACTION_RE.test(text);
}

const SIM_SWAP_CONTEXT_RE =
  /(перевыпуск|перевыпуст|замена|дубликат|восстанов|перенести номер|перенос номера|sim.{0,10}swap|sim.{0,15}(almashtir|tiklash|dublikat)|номер.{0,30}(перенос|перевыпуск))/i;
const SIM_SWAP_ASK_RE =
  /(назов(и|ите)(?![а-яёa-z])|скаж(и|ите)(?![а-яёa-z])|сообщ(и|ите)(?![а-яёa-z])|подтверд(и|ите)(?![а-яёa-z])|отправь(те)?(?![а-яёa-z])|введите(?![а-яёa-z])|пришл(и|ите)(?![а-яёa-z])|ayting|yuboring|kiriting|tasdiq|send|enter|confirm|tell)/i;
const SIM_SWAP_ACTION_RE =
  /(сим|sim|номер|raqam).{0,40}(код|смс|sms|подтверд|паспорт|pinfl|пинфл|доступ|operator|оператор|tasdiq|kod|pasport)|((код|смс|sms|подтверд|паспорт|pinfl|пинфл|tasdiq|kod|pasport).{0,40}(сим|sim|номер|raqam))/i;

function shouldFlagSimSwapOrNumberTransfer(text: string): boolean {
  return (
    SIM_SWAP_CONTEXT_RE.test(text) && SIM_SWAP_ASK_RE.test(text) && SIM_SWAP_ACTION_RE.test(text)
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
  /(оплат(и|ите)|внес(и|ите)|перевед(и|ите)|заплат(и|ите)|отправь(те)?|пришл(и|ите)|to['’]?lang|o['’]?tkazing|yuboring|pay|transfer|send)/i;

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
  /(cvv|cvc|код безопасности|xavfsizlik kodi|security code|код.{0,20}(на обороте|с обратной стороны)|оборот.{0,20}карт|back of (the )?card|((три|3|уч|uch).{0,14}(цифр|рақам|raqam|xonali).{0,30}(карт|card|karta|оборот|back))|((карт|card|karta|оборот|back).{0,30}(три|3|уч|uch).{0,14}(цифр|рақам|raqam|xonali)))/i;

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

const SAFETY_BASE_CLAUSE_SPLIT_RE =
  /[,.!?;،:\u2013\u2014\n]+|\s+(?:but|however|then|after\s+that|after\s+which|но|однако|зато|затем|потом|после\s+чего|теперь|lekin|biroq|keyin)\s+|(?<!(?:not|don['’]?t|never|shouldn['’]?t|mustn['’]?t|can['’]?t|cannot|won['’]?t))\s+yet\s+/iu;
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

function hasUnsafeClause(text: string, unsafe: RegExp, safety: RegExp): boolean {
  return splitRiskClauses(text).some(
    (clause) => unsafe.test(clause) && !safety.test(clause) && !isGeneralSafetyClause(clause),
  );
}

function shouldFlagDirectTransferRequest(text: string): boolean {
  return hasUnsafeClause(text, TRANSFER_DESTINATION_RE, TRANSFER_SAFETY_RE);
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
  /(?:отправь|пришли|скажи|назови|сообщи|передай|покажи|продиктуй|предоставь|укажи|просят|просит|требуют|требует|\b(?:send|tell|give|share|show|provide|submit|read\s+out|ask(?:ed|s|ing)?|request(?:ed|s|ing)?|requir(?:e|ed|es|ing)?|demand(?:ed|s|ing)?)\b|(?<![\p{L}\p{N}_])(?:yubor(?:ing)?|ayt(?:ing)?|ko['’]?rsat(?:ing)?|so['’]?ra(?:yapti)?|talab)(?![\p{L}\p{N}_]))/iu;
const CARD_DATA_OBJECT_RE =
  /(?:данн(?:ые|ых)?\s+карт|номер.{0,20}карт|реквизит(?:ы|ов)?\s+карт|фото\s+(?:банковской\s+)?карт|card\s+(?:number|details|data)|(?:last|final)\s+(?:four|4)\s+digits.{0,24}(?:bank\s+)?card|photo\s+of\s+(?:the\s+|your\s+)?card|karta(?:ning)?\s+(?:raqam|ma['’]?lumot|rekvizit|rasm))/iu;
const CARD_DATA_SAFETY_RE =
  /(?:(?:не\s+(?:отправля|сообща|говори|передава|показыва)|do\s+not|don['’]?t|never|not\s+to|yubormang|aytmang|bermang).{0,45}(?:данн(?:ые|ых)?\s+карт|номер\s+карт|фото\s+(?:банковской\s+)?карт|card\s+(?:number|details|data)|photo\s+of\s+(?:the\s+|your\s+)?card|karta(?:ning)?\s+(?:raqam|ma['’]?lumot|rasm))|(?:karta(?:ning)?\s+(?:raqam|ma['’]?lumot|rasm)).{0,45}(?:yubormang|aytmang|bermang))/iu;
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
  /(?:(?:не\s+(?:отправля|вводи|говори|называ|передава|показыва)|(?:do\s+not|don['’]?t|never)\s+(?:send|enter|tell|share|give|forward|reveal|provide|submit)).{0,35}(?:код|code|otp)|(?:kodni|kod).{0,30}(?:yubormang|aytmang|kiritmang|jo['’]?natmang))/iu;

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
  "asks_to_transfer_to_safe_account",
  "requests_card_digits",
  "fake_delivery_payment",
]);

export function evaluateText(text: string): ReasonCode[] {
  const codes = new Set<ReasonCode>();
  const isStandaloneCodeSafetyWarning =
    GENERIC_CODE_SAFETY_RE.test(text) &&
    !hasUnsafeClause(text, GENERIC_CODE_REQUEST_RE, GENERIC_CODE_SAFETY_RE);
  for (const { code, re } of PATTERNS) {
    if (!re.test(text)) continue;
    if (code === "asks_for_sms_code" && isPhysicalAccessCodeOnly(text)) continue;
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
  if (shouldFlagWalletActionUrgency(text)) codes.add("wallet_action_urgency");
  if (shouldFlagTonReferralEarningScheme(text)) codes.add("ton_referral_earning_scheme");
  if (shouldFlagInvestmentFastProfitPitch(text)) codes.add("investment_fast_profit_pitch");
  if (shouldFlagRomanceInvestmentPivot(text)) codes.add("romance_investment_pivot");
  if (shouldFlagOneIdGovernmentPhishing(text)) codes.add("oneid_government_phishing");
  if (shouldFlagSimSwapOrNumberTransfer(text)) codes.add("sim_swap_or_number_transfer");
  if (shouldFlagMoneyMuleRecruitment(text)) codes.add("money_mule_recruitment");
  if (shouldFlagAdvanceFeePrizeInheritance(text)) codes.add("advance_fee_prize_inheritance");
  if (shouldFlagSoftCardCvvRequest(text)) codes.add("asks_for_card_cvv");
  if (shouldFlagSoftPinOrPasswordRequest(text)) codes.add("asks_for_pin");
  if (shouldFlagDirectTransferRequest(text)) codes.add("asks_to_transfer_to_safe_account");
  if (shouldFlagPersonalDataRequest(text)) codes.add("requests_personal_data");
  if (shouldFlagCardDataRequest(text)) codes.add("requests_card_digits");
  if (shouldFlagProxyCodeRequest(text)) codes.add("asks_for_sms_code");
  if (shouldFlagGenericCodeRequest(text)) codes.add("asks_for_sms_code");
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
  asks_to_transfer_to_safe_account: {
    ru: "Предлагают «безопасный счёт»",
    uz: "«Xavfsiz hisob»ga pul o‘tkazishni taklif qilishmoqda",
    en: "Offers a fake “safe account”",
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
    ru: "Фейковая оплата доставки / посылки",
    uz: "Soxta yetkazib berish / posilka to‘lovi",
    en: "Fake delivery / parcel payment",
  },
  fake_boss_request: {
    ru: "Фейковый руководитель / официальный запрос",
    uz: "Soxta rahbar / rasmiy so‘rov",
    en: "Fake boss / official request",
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
