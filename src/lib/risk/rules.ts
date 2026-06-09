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
  requests_personal_data: 15,
  non_uz_phone: 5,
  valid_uz_phone: 0,
  verified_official: -100,
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
  hosted_app_platform: 0, // informational, no score impact
  brand_impersonation: 40,
  telegram_account_takeover_phishing: 50,
  dropper_recruitment: 35,
};

const PATTERNS: { code: ReasonCode; re: RegExp }[] = [
  { code: "asks_for_otp", re: /\b(otp|one[\s-]?time\s?(password|code))\b/i },
  {
    code: "asks_for_sms_code",
    re: /(sms.?код|код из (смс|sms)|подтверд(и|ите) код|tasdiq(lash)? kod|kodni ayting|kodni yuboring|verification code|код подтвер|6.?значн)/i,
  },
  { code: "asks_for_card_cvv", re: /\b(cvv|cvc|cvv2)\b|трёхзначн|uch xonali kod/i },
  { code: "asks_for_pin", re: /\b(pin|пин-?код|pin.?kod)\b/i },
  {
    code: "asks_to_install_apk",
    re: /(установ(и|ите).{0,30}(прилож|apk)|apk.?(скачайте|yuklab)|o['’]rnating.{0,30}(ilova|apk)|install.{0,30}(app|apk))/i,
  },
  {
    code: "asks_to_share_screen",
    re: /(демонстр.{0,15}экран|share.{0,5}screen|screen.?share|anydesk|teamviewer|rustdesk|quick.?support)/i,
  },
  {
    code: "asks_to_transfer_to_safe_account",
    re: /(безопасн.{0,15}(счёт|счет|карт)|safe account|xavfsiz hisob)/i,
  },
  {
    code: "impersonates_bank",
    re: /(служб(а|ы) безопасности банка|сотрудник банка|bank xavfsizlik|bank xodimi|central bank|центральн(ый|ого) банк|markaziy bank|hamkorbank|kapitalbank|uzcard|humo|payme|click)/i,
  },
  { code: "impersonates_operator", re: /(оператор связи|ucell|beeline|mobiuz|ums|uzmobile)/i },
  {
    code: "uses_urgency",
    re: /(срочно|немедленно|прямо сейчас|tezda|hozir|darhol|urgent|immediately|right now)/i,
  },
  {
    code: "threatens_legal_action",
    re: /(полици(я|ей)|суд|арест|уголовн|jinoiy|sud|hibsga|police|lawsuit|criminal case)/i,
  },
  {
    code: "asks_not_to_hang_up",
    re: /(не клад(и|ите) трубку|не отключ|не завершайте|telefonni qo['’]ymang|don'?t hang up)/i,
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
    re: /(родственник|сын|дочь|брат|сестра|друг|внук).{0,40}(беда|авари|больниц|задержали|срочно нужны деньги)|(farzand|o['’]g['’]il|qiz|aka|uka|do['’]st).{0,40}(avariya|kasalxona|shoshilinch.{0,10}pul)/i,
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
    re: /((курьер|доставк|посылк|почт[аы]|parcel|delivery|shipping|kuryer|yetkazib|posilka).{0,70}(оплат|доплат|пошлин|сбор|комисс|вернут|возврат|ссылк|fee|pay|returned|link|to['’]lov|havola|qaytar|komiss|boj)|pay.{0,40}(delivery|shipping|parcel).{0,20}fee)/i,
  },
  {
    code: "payment_before_service",
    re: /(предоплат|аванс|задаток|оплатите.{0,30}(до|сначала)|брон[ьи].{0,30}(оплат|предоплат|аванс|задаток)|оплат.{0,30}брон|oldindan.{0,20}to['’]lov|avans|zaklad|bron.{0,30}(to['’]lov|tolov|pay|deposit|avans)|xizmatdan oldin|first.{0,20}pay|prepay|deposit)/i,
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
  /(telegram|телеграм|телеграмм|аккаунт|профил|account|profile|akkaunt|hisob).{0,100}(удал[её]н|удалени|заявк.{0,20}удален|заявк.{0,20}удалени|заблокир|блокиров|delete|deletion|blocked|o['’]?chir|bekor)|(удал[её]н|удалени|delete|deletion|blocked).{0,100}(telegram|телеграм|телеграмм|аккаунт|профил|account|profile|akkaunt|hisob)/i;
const TELEGRAM_ACCOUNT_ACTION_RE =
  /(отмена|отменить|спасти|сохранить|восстанов|нажм|кнопк|перейд|ссылк|введите|укажите|код|sms|otp|парол|номер|cancel|restore|save|button|link|enter|code|password|phone|raqam|kod|parol)/i;

function shouldFlagTelegramAccountTakeoverPhishing(text: string): boolean {
  return TELEGRAM_ACCOUNT_DELETE_CONTEXT_RE.test(text) && TELEGRAM_ACCOUNT_ACTION_RE.test(text);
}

const DROPPER_TARGET_RE =
  /(дроппер|дроп|банковск.{0,20}карт|кар(та|ту|ты)|sim|сим.{0,5}карт|номер|oneid|аккаунт|кошел[её]к|криптокошел|bank card|sim card|phone number|account|wallet|crypto wallet|karta|sim karta|raqam|hisob|hamyon|akkaunt)/i;
const DROPPER_ACTION_RE =
  /(продай|продам|сдам|аренд|оформ.{0,30}(на себя|для нас|на вас)|открой.{0,30}(на себя|для нас|на вас)|передай|дай доступ|доступ.{0,20}(передай|дай)|за.{0,30}(сум|тыс|ming|so['’]?m)|вознагражд|sot|ijara|ochib ber|topshir|berib tur|mukofot|pul|rent|sell|open.{0,30}for us|reward)/i;
const DROPPER_SAFETY_CONTEXT_RE =
  /(не передавай|не передавайте|не продавай|не продавайте|не сдавай|не сдавайте|нельзя передавать|do not sell|don't sell|do not transfer|sotmang|bermang|topshirmang)/i;

function shouldFlagDropperRecruitment(text: string): boolean {
  if (DROPPER_SAFETY_CONTEXT_RE.test(text)) return false;
  return DROPPER_TARGET_RE.test(text) && DROPPER_ACTION_RE.test(text);
}

const GAMBLING_CONTEXT_RE =
  /(ставк|ставлю|матч|прогноз|букмек|бетт?инг|казино|азартн|фри\s?спин|фриспин|депозит|(?:^|[^a-zа-я])деп(?:а|ов)?(?=$|[^a-zа-я])|слот|twin|luxe\s?bet|luxebet|sport\s?bet|sportsbook|betting|odds|prediction|free pick|free\s?spins?|casino|slots?|stavka|prognoz|bukmeker|kazino)/i;
const GAMBLING_ACTION_RE =
  /(t\.me\/\+|telegram\.me\/\+|подпис|канал|закрыт|бесплатн|выигр|приз|джекпот|бонус|пополн|ссылк|100[ .]?000|гарантир|доход|прибыл|vip|subscribe|channel|free|win|profit|bonus|deposit|link|guaranteed|obuna|kanal|bepul|yutuq|foyda)/i;
const GAMBLING_NEUTRAL_CONTEXT_RE =
  /(без\s+ставок|без\s+прогнозов|не\s+ставки|не\s+прогноз|новости спорта|спортивные новости|расписание матча|счет матча|счёт матча|смотреть матч|sports news|match schedule|match score|natija|jadval)/i;

function shouldFlagGamblingPredictionPromo(text: string): boolean {
  if (GAMBLING_NEUTRAL_CONTEXT_RE.test(text)) return false;
  return GAMBLING_CONTEXT_RE.test(text) && GAMBLING_ACTION_RE.test(text);
}

const GIVEAWAY_CONTEXT_RE =
  /(розыгрыш|разыгр|random\s*nft|nft|банка подарков|подар|приз|giveaway|airdrop|lottery|sovg'a|sovrin|yutuq)/i;
const GIVEAWAY_ACTION_RE =
  /(капч|captcha|реакци|reaction|проголос|голос|vote|подпис|subscribe|участв|ishtirok|ovoz|obuna|kanal|кошел|wallet|hamyon|sms|otp|код|карта|депозит|деп)/i;

function shouldFlagGiveawayEngagementBait(text: string): boolean {
  return GIVEAWAY_CONTEXT_RE.test(text) && GIVEAWAY_ACTION_RE.test(text);
}

const QR_MENTION_RE = /(qr.?код|qr.?kod|qr code|qr)/i;
const QR_SCAN_ACTION_RE = /(скан|отскан|skaner|scan)/i;
const QR_DANGEROUS_CONTEXT_RE =
  /(войти|вход|авториз|личн.{0,12}кабинет|аккаунт|подтверд|вериф|смс.{0,20}код|sms.{0,20}code|код.{0,20}(смс|sms|подтвержд)|парол|pin|cvv|карт|банк|оплат|перевод|выигрыш|приз|розыгрыш|kiring|tizimga|hisob|akkaunt|tasdiq|tasdiq.{0,20}kod|parol|karta|bank|to['’]?lov|pul|sovrin|yutuq|login|account|verify|confirm|verification.{0,20}code|password|payment|transfer|card|bank|prize|giveaway|lottery)/i;

function shouldFlagQrScan(text: string): boolean {
  return (
    QR_MENTION_RE.test(text) && QR_SCAN_ACTION_RE.test(text) && QR_DANGEROUS_CONTEXT_RE.test(text)
  );
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

export function evaluateText(text: string): ReasonCode[] {
  const codes = new Set<ReasonCode>();
  for (const { code, re } of PATTERNS) if (re.test(text)) codes.add(code);
  if (shouldFlagQrScan(text)) codes.add("asks_to_scan_qr");
  if (shouldFlagTelegramAccountTakeoverPhishing(text))
    codes.add("telegram_account_takeover_phishing");
  if (shouldFlagDropperRecruitment(text)) codes.add("dropper_recruitment");
  if (shouldFlagGamblingPredictionPromo(text)) codes.add("gambling_prediction_promo");
  if (shouldFlagGiveawayEngagementBait(text)) codes.add("giveaway_engagement_bait");
  // Heuristics
  if (
    /\b\$\s?\d{2,}|\d+\s?(usd|у\.?е\.?)|\d+\s?(сум|so['’]m)/i.test(text) &&
    /(выигр|приз|бесплатн|tabrik|sovrin|prize|won)/i.test(text)
  ) {
    codes.add("too_good_to_be_true");
  }
  if (/(паспорт|passport|seriya)/i.test(text) && /(отправ|yuboring|send)/i.test(text)) {
    codes.add("requests_personal_data");
  }
  return [...codes];
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
  }

  return codes;
}

export function scoreFromCodes(codes: ReasonCode[]): { score: number; level: RiskLevel } {
  let score = 0;
  for (const c of codes) score += WEIGHTS[c] ?? 0;
  if (codes.includes("verified_official")) return { score: 0, level: "safe" };
  if (codes.includes("brand_impersonation") && codes.includes("hosted_app_platform")) {
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
