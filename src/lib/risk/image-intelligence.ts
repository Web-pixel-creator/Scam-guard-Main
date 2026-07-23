import type { Lang } from "@/lib/i18n";
import { sanitizeAiExplanation } from "./ai-output-safety";
import { redactText } from "./detect";
import type { DecodedQrEvidence } from "./qr-decoder";
import type { RiskLevel } from "./rules";

export type ImageVisualCategory =
  | "delivery_sms"
  | "restaurant_menu_qr"
  | "qr_menu_or_info"
  | "qr_login_or_payment"
  | "chat_screenshot"
  | "payment_request"
  | "apk_prompt"
  | "document"
  | "telegram_promo_post"
  | "casino_or_betting_promo"
  | "crypto_giveaway_or_nft"
  | "wallet_or_defi_action"
  | "news_or_channel_post"
  | "telegram_profile_card"
  | "unknown";

export type ImageConfidence = "low" | "medium" | "high";
export type ImageQrPurpose = "menu" | "info" | "login" | "payment" | "unknown";
type DecodedQrKind =
  | "telegram_login"
  | "authenticator"
  | "payment"
  | "wallet_deeplink"
  | "plain_url"
  | "unknown";

export type ImageRiskHint =
  | "otp_or_secret"
  | "apk_install"
  | "qr_login"
  | "qr_payment"
  | "telegram_account_takeover"
  | "fake_device_security_popup"
  | "payment_request"
  | "card_data"
  | "urgent_pressure"
  | "brand_impersonation"
  | "casino_bonus_or_free_spins"
  | "fake_captcha_or_voting"
  | "giveaway_or_prize_actions"
  | "task_reward_or_engagement"
  | "wallet_or_defi_urgency"
  | "ton_referral_or_earning"
  | "telegram_invite_or_private_link";

export interface ImageIntelligenceResult {
  text: string | null;
  visualCategory: ImageVisualCategory;
  confidence: ImageConfidence;
  qr: {
    present: boolean;
    visibleUrl: string | null;
    visibleUrlObservedInText?: boolean;
    observedUrls?: string[];
    purpose: ImageQrPurpose;
    decodedValues?: string[];
  };
  riskHints: ImageRiskHint[];
  summary: string | null;
}

const CATEGORIES: readonly ImageVisualCategory[] = [
  "delivery_sms",
  "restaurant_menu_qr",
  "qr_menu_or_info",
  "qr_login_or_payment",
  "chat_screenshot",
  "payment_request",
  "apk_prompt",
  "document",
  "telegram_promo_post",
  "casino_or_betting_promo",
  "crypto_giveaway_or_nft",
  "wallet_or_defi_action",
  "news_or_channel_post",
  "telegram_profile_card",
  "unknown",
];

const CONFIDENCES: readonly ImageConfidence[] = ["low", "medium", "high"];
const QR_PURPOSES: readonly ImageQrPurpose[] = ["menu", "info", "login", "payment", "unknown"];
const RISK_HINTS: readonly ImageRiskHint[] = [
  "otp_or_secret",
  "apk_install",
  "qr_login",
  "qr_payment",
  "telegram_account_takeover",
  "fake_device_security_popup",
  "payment_request",
  "card_data",
  "urgent_pressure",
  "brand_impersonation",
  "casino_bonus_or_free_spins",
  "fake_captcha_or_voting",
  "giveaway_or_prize_actions",
  "task_reward_or_engagement",
  "wallet_or_defi_urgency",
  "ton_referral_or_earning",
  "telegram_invite_or_private_link",
];

const URL_RE = /\bhttps?:\/\/[^\s<>()]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/i;
const OBSERVED_URL_RE = new RegExp(URL_RE.source, "giu");
const LOW_INFORMATION_IMAGE_TEXT_RE =
  /(?:не\s+(?:смог|удалось|получилось).{0,40}(?:прочита|распозна|увид)|не\s+читается|размыт|blurry|could(?:n'?t| not).{0,40}(?:read|recognize|extract)|can(?:not|'?t).{0,40}(?:read|recognize|extract)|not\s+readable|unable\s+to\s+read|o['’]?qiy\s+olmad|aniq\s+ko['’]?rinmay)/i;

const DELIVERY_RE =
  /(buyurtma|заказ|доставк|посылк|pickup|delivery|parcel|topshirish|punkt|olib keting|кутмоқ|kutmoqda|курьер|kuryer)/i;
const MENU_RE =
  /(ресторан|menu|меню|taom|стол|брон|booking|loyalty|лояльност|скидк|cashback|кешбэк|бонус|акци|filial|chenson|гости|кухн)/i;
const QR_RE = /\b(qr|qr-код|qr.?kod)\b/i;
const SECRET_RE =
  /(sms.?код|код из sms|код из смс|otp|verification code|tasdiq.{0,10}kod|pin|cvv|cvc|парол|password)/i;
const APK_RE =
  /(apk|\.apk|pdf\.apk|pptx|\.pptx|exe|\.exe|установ(и|ите).{0,30}(?:програм|софт|apk|файл)|скача(?:й|йте|ть).{0,30}(?:програм|apk|файл)|install.{0,30}(apk|file)|download.{0,30}(apk|file)|yukla.{0,30}(?:apk|fayl))/i;
const FAKE_DEVICE_SECURITY_POPUP_RE =
  /(?:apple|iphone|ios|android|телефон|смартфон|устройств).{0,100}(?:вирус|virus|поврежден|повреждена|заражен|заражено|security|безопасност|blocked|заблокир|удален|data.{0,20}lost|данн.{0,30}потер).{0,140}(?:установ|скача|install|download|нажм|button|кнопк|ок|ok)|(?:оповещение\s+безопасности|security\s+alert).{0,80}(?:apple|iphone|ios|android)|(?:ios|iphone).{0,80}(?:поврежден|повреждена).{0,80}(?:\d+\s*%|процент)/i;
const TELEGRAM_ACCOUNT_TAKEOVER_IMAGE_RE =
  /(?:telegram|телеграм|teiegram|телеграмм|t\.me|telegram\.me)[\s\S]{0,700}(?:удален|удаление|заблокир|блокиров|заморож|muzlat|o['’]?chir|ochir|verification|verify|login|service|официальн|rasmiy|аккаунт|уч[её]тн[\s\S]{0,20}запис|hisob|noma['’]?lum[\s\S]{0,40}qurilma|qurilmadan[\s\S]{0,30}kirish|tasdiqlash|havola|bosing)|(?:запрос\s+на\s+удаление|отменить\s+удаление|вернуть\s+аккаунт|аккаунт[\s\S]{0,40}(?:удален|заблокир|заморож)|hisob[\s\S]{0,120}(?:muzlat|o['’]?chir|blok|noma['’]?lum[\s\S]{0,40}qurilma|qurilmadan[\s\S]{0,30}kirish))[\s\S]{0,180}(?:telegram|телеграм|t\.me|havola|ссылк|link|bosing|tasdiq)/i;
const PAYMENT_RE =
  /(предоплат|оплатите|оплата|переведите|перевод|to['’]?lov|pul o['’]?tkaz|payment|transfer|deposit|fee|комисс|карта|karta|uzcard|humo)/i;
const QR_LOGIN_RE =
  /(вход\s+по\s+qr|быстрый\s+вход\s+по\s+qr|qr.{0,80}(войти|вход|авториз|аккаунт|подтверд|вериф|login|sign\s?in|account|verify|confirm|auth(?:enticat(?:e|ion|or))?|2fa|mfa|device|устройств|подключ|сесс|tasdiq|kiring|hisob)|(?:войти|вход|login|sign\s?in|confirm|verify|подтверд|авториз|подключ|устройств|направьте\s+камер|сканировать\s+код).{0,80}qr|двухфакторн.{0,100}qr|authentication\s+app.{0,100}qr|(?:authentication|authenticator|2fa|mfa|sign\s?in|login|device).{0,100}scan.{0,40}qr|подключить\s+устройство|настройки\s*>\s*устройства\s*>\s*подключить\s*устройство|альфа[-\s]?бизнес|alfa[-\s]?business|войти\s+через\s+яндекс|яндекс(?:\.ключ)?|сканировать\s+код\s+через\s+приложение)/i;
const QR_PAYMENT_RE =
  /(qr.{0,40}(оплат|перевод|payment|transfer|to['’]?lov|pul|karta|card)|(?:оплат|payment|transfer|to['’]?lov).{0,40}qr)/i;
const URGENCY_RE = /(срочно|немедленно|прямо сейчас|urgent|immediately|hozir|darhol|tezda)/i;
const BRAND_RE =
  /(банк|central bank|markaziy bank|kapitalbank|uzcard|humo|payme|click|uzum|ucell|beeline|mobiuz|uzmobile|gov|my\.gov)/i;
const TELEGRAM_POST_RE =
  /(@[a-z0-9_]{3,}|t\.me\/|telegram\.me\/|telegram|канал|подпис|subscribe|join|button|кнопк|перейти|открыть канал|open channel|комментар|reactions?|реакци|просмотр|views?|бот|mini\s?app)/i;
const TELEGRAM_PRIVATE_INVITE_RE =
  /(?:\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:\+|joinchat\/)[a-z0-9_-]+|\b(?:tg|telegram):\/\/join\?[^#\s]*\binvite=[^&\s]+)/i;
const TELEGRAM_PROFILE_CARD_RE =
  /(страна\s+телефона|регистрац(?:ия|ии)?\s*:?\s*(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр|20\d{2})|не\s+официальн(?:ый|ая|ое)\s+аккаунт|не\s+в\s+контактах|обновил(?:а)?\s+(?:имя|фото|фотографию)|phone\s+country|country\s+phone|registration\s*:?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|20\d{2})|not\s+official\s+account|not\s+in\s+contacts|updated\s+(?:name|photo))/i;
const TELEGRAM_PROFILE_OFFER_RE =
  /(инвест|трейд|trading|forex|mentor|ментор|доход|заработ|profit|прибыл|crypto|крипт|ai\s*tools?|инструмент)/i;
const TELEGRAM_PROFILE_FREE_ACCESS_RE =
  /(бесплат|free|доступ|access|платформ|platform|людей\s+внутри|человек\s+внутри|\d+\+?\s*(?:человек|people|users?))/i;
const TELEGRAM_PROFILE_NEXT_STEP_RE =
  /(интересно|подробнее|ссылк|link|перейти|join|присоедин|зарегистр|register|sign\s?up)/i;
const BETTING_PROMO_RE =
  /(ставк|ставлю|матч|прогноз|букмек|бетт?инг|казино|азартн|лудоман|luxe\s?bet|luxebet|sport\s?bet|sportsbook|betting|odds|prediction|free pick|stavka|prognoz|bukmeker|kazino)/i;
const BETTING_ACTION_RE =
  /(t\.me\/\+|telegram\.me\/\+|подпис|канал|закрыт|бесплатн|выигр|приз|джекпот|прибыл|доход|vip|subscribe|channel|free|win|profit|guaranteed|obuna|kanal|bepul|yutuq|foyda)/i;
const CASINO_BONUS_RE =
  /(казино|азартн|слот|слоты|фри\s?спин|фриспин|free\s?spins?|casino|slots?|no\s?kyc|no\s?limits?|без\s?kyc|без\s+регистрации|twin|tonplay|luxe\s?bet|luxebet)/i;
const CASINO_ACTION_RE =
  /(депозит|(?:^|[^a-zа-я])деп(?:а|ов)?(?=$|[^a-zа-я])|пополн|бонус|ссылк|перейти|вход на сайт|без vpn|регистрац|запущ|bonus|deposit|top\s?up|link|signup|register|launched|always here|no registration|mini\s?app|telegram app|первые\s+\d+\s+деп)/i;
const GIVEAWAY_CONTEXT_RE =
  /(розыгрыш|разыгр|random\s*nft|nft|банка подарков|подар|приз|giveaway|airdrop|lottery|sovg'a|sovrin|yutuq|\bstars?\b|зв[её]зд|ton\s?знаток|tonznatok)/i;
const GIVEAWAY_ACTION_RE =
  /(капч|captcha|реакци|reaction|проголос|голос|vote|voting|подпис|subscribe|участв|раздач|выда[еёю]|кошел|wallet|hamyon|sms|otp|код|карта|депозит|деп|join|claim|получ)/i;
const FAKE_CAPTCHA_VOTING_RE =
  /(капч|captcha|реакци|reaction|проголос|голосован|vote|voting|verify|verification|проверка|подтверд|confirm)/i;
const TASK_REWARD_RE =
  /(reward\s?pool|leaderboard|points?|campaign participants?|easycoin|выполняй|выполн.{0,20}действ|легк.{0,20}действ|задани|апгрейд|кейс|безпроигрышн|невозможно проиграть|топов.{0,20}приз|прокачивай|ochko|topshiriq|vazifa)/i;
const REWARD_BENEFIT_RE =
  /(\$\s?\d+|\d+[\s.,]?\d*\s?(usd|usdt|ton|stars?)|tokens?|токен|приз|вывод|withdraw|заработ|получ|reward|earn|yutuq|mukofot|pul)/i;
const WALLET_CONTEXT_RE =
  /(wallet|кошел[её]к|hamyon|tonkeeper(?:\s+battery)?|hot wallet|earn tab|defi|lending|liquidation|transaction fees?|gas fees?|seed phrase|private key|connect wallet|подключ.{0,20}кошел|подпис.{0,20}транзакц|rhea finance|px holders?|\$\s?px\b)/i;
const WALLET_ACTION_RE =
  /(security incident|24[\s-]?hour|grace period|act now|reopened|reactivated|settle|open positions?|top\s?up|пополн|сроч|успей|ликвидац|реактив|перевед|transfer|pay fees?|open app|link|manage|баланс|balance|connect|подключ|оплат|комисс)/i;
const TON_REFERRAL_CONTEXT_RE =
  /(ton|telegram|mini\s?app|ton dating|stars?|зв[её]зд|crypto|крипт)/i;
const TON_REFERRAL_REWARD_RE =
  /(earn|заработ|получа[йе]|приглаш|invited friend|invite friends?|referral link|реферальн|за каждого|per invited|за приглаш|друз|do['’]st|taklif)/i;
const ORDINARY_NEWS_RE =
  /(supreme court|tariffs?|expected to release|just news|новост|breaking news|pavel durov|telegram apps center|каталог|catalog|categories|management|web3|games)/i;

const STARS_GIFT_MECHANIC_RE =
  /((?:nft|stars?|зв[её]зд|подар|gift).{0,80}(?:лудк|лутк|spin|спин|777|slot|слот|разыгр|розыгр|раздач|выда[еёю]|claim|получ|забер)|(?:лудк|лутк|spin|спин|777|slot|слот).{0,80}(?:nft|stars?|зв[её]зд|подар|gift))/i;
const VOTING_PRIZE_MECHANIC_RE =
  /(voting\.[a-z0-9.-]+|blockchain-life\.com|проголос|голосован|vote|voting).{0,120}(статуэт|award|contest|prize|приз|подар|nft|stars?|зв[её]зд)|(?:статуэт|award|contest|prize|приз|подар|nft|stars?|зв[её]зд).{0,120}(voting\.[a-z0-9.-]+|blockchain-life\.com|проголос|голосован|vote|voting)/i;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function clampText(value: string | null, max: number): string | null {
  if (!value) return null;
  const oneLine = value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return oneLine.length > max ? oneLine.slice(0, max).trimEnd() : oneLine;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function extractJsonObject(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function uniqueHints(hints: ImageRiskHint[]): ImageRiskHint[] {
  return [...new Set(hints)];
}

function hasStrongDangerHint(hints: readonly ImageRiskHint[]): boolean {
  return hints.some((hint) =>
    [
      "otp_or_secret",
      "apk_install",
      "qr_login",
      "qr_payment",
      "telegram_account_takeover",
      "fake_device_security_popup",
      "payment_request",
      "card_data",
      "wallet_or_defi_urgency",
    ].includes(hint),
  );
}

function telegramProfileSignals(text: string | null, lang: Lang): string[] {
  if (!text) return [];

  const signals: string[] = [];
  const push = (label: string, value?: string | null) => {
    const clean = value?.replace(/\s+/g, " ").trim();
    const line = clean ? `${label}: ${clean}` : label;
    if (!signals.includes(line)) signals.push(line.slice(0, 140));
  };
  const firstMatch = (re: RegExp) => text.match(re)?.[1]?.trim() ?? null;

  if (lang === "uz") {
    const country = firstMatch(
      /(?:страна\s+телефона|phone\s+country|country\s+phone)\s*:?\s*([^\n]+)/i,
    );
    const registered = firstMatch(/(?:регистрац(?:ия|ии)?|registration)\s*:?\s*([^\n]+)/i);
    if (country) push("Telefon mamlakati", country);
    if (registered) push("Ro'yxatdan o'tish", registered);
    if (/не\s+официальн(?:ый|ая|ое)\s+аккаунт|not\s+official\s+account/i.test(text)) {
      push("Telegram ko'rsatgan belgi: rasmiy akkaunt emas");
    }
    if (/не\s+в\s+контактах|not\s+in\s+contacts/i.test(text)) push("Kontaktlaringizda yo'q");
    for (const match of text.matchAll(
      /(?:пользователь\s+)?обновил(?:а)?\s+(имя|фото|фотографию)[^\n]*|updated\s+(name|photo)[^\n]*/gi,
    )) {
      push(`Profil o'zgarishi`, match[0]);
    }
    return signals.slice(0, 6);
  }

  if (lang === "en") {
    const country = firstMatch(
      /(?:страна\s+телефона|phone\s+country|country\s+phone)\s*:?\s*([^\n]+)/i,
    );
    const registered = firstMatch(/(?:регистрац(?:ия|ии)?|registration)\s*:?\s*([^\n]+)/i);
    if (country) push("Phone country", country);
    if (registered) push("Registration shown", registered);
    if (/не\s+официальн(?:ый|ая|ое)\s+аккаунт|not\s+official\s+account/i.test(text)) {
      push("Telegram shows: not an official account");
    }
    if (/не\s+в\s+контактах|not\s+in\s+contacts/i.test(text)) push("Not in your contacts");
    for (const match of text.matchAll(
      /(?:пользователь\s+)?обновил(?:а)?\s+(имя|фото|фотографию)[^\n]*|updated\s+(name|photo)[^\n]*/gi,
    )) {
      push("Profile change", match[0]);
    }
    return signals.slice(0, 6);
  }

  const country = firstMatch(
    /(?:страна\s+телефона|phone\s+country|country\s+phone)\s*:?\s*([^\n]+)/i,
  );
  const registered = firstMatch(/(?:регистрац(?:ия|ии)?|registration)\s*:?\s*([^\n]+)/i);
  if (country) push("Страна телефона", country);
  if (registered) push("Регистрация на скриншоте", registered);
  if (/не\s+официальн(?:ый|ая|ое)\s+аккаунт|not\s+official\s+account/i.test(text)) {
    push("Telegram показывает: не официальный аккаунт");
  }
  if (/не\s+в\s+контактах|not\s+in\s+contacts/i.test(text)) push("Не в контактах");
  for (const match of text.matchAll(
    /(?:пользователь\s+)?обновил(?:а)?\s+(имя|фото|фотографию)[^\n]*|updated\s+(name|photo)[^\n]*/gi,
  )) {
    push("Изменение профиля", match[0]);
  }
  return signals.slice(0, 6);
}

function telegramProfileVisibleMessageNote(text: string | null, lang: Lang): string | null {
  if (!text) return null;

  const offer = TELEGRAM_PROFILE_OFFER_RE.test(text);
  const freeAccess = TELEGRAM_PROFILE_FREE_ACCESS_RE.test(text);
  const nextStep = TELEGRAM_PROFILE_NEXT_STEP_RE.test(text);
  if (!offer && !freeAccess && !nextStep) return null;

  if (lang === "uz") {
    const pieces = [
      offer ? "investitsiya/daromad/AI vositalari taklifi" : null,
      freeAccess ? "bepul kirish yoki katta auditoriya va'dasi" : null,
      nextStep ? "keyingi qadamga chaqirish" : null,
    ].filter(Boolean);
    return `Ko'rinib turgan xabarda qo'shimcha e'tibor kerak bo'lgan belgi bor: ${pieces.join(", ")}. Bu yolg'iz o'zi firibgarlik isboti emas, lekin profil yangi/notanish bo'lsa, havola, kod, karta yoki to'lovdan oldin manbani tekshiring.`;
  }

  if (lang === "en") {
    const pieces = [
      offer ? "investment/income/AI-tools offer" : null,
      freeAccess ? "free access or large-audience promise" : null,
      nextStep ? "push to continue or open a link" : null,
    ].filter(Boolean);
    return `The visible message has a caution signal: ${pieces.join(", ")}. This alone is not proof of scam, but if the profile is new or unknown, verify the source before opening links, entering codes/card data, or paying.`;
  }

  const pieces = [
    offer ? "инвестиции/доход/AI-инструменты" : null,
    freeAccess ? "бесплатный доступ или обещание большой аудитории" : null,
    nextStep ? "подталкивание продолжить или перейти по ссылке" : null,
  ].filter(Boolean);
  return `В видимом сообщении есть повод для осторожности: ${pieces.join(", ")}. Само по себе это не доказательство скама, но если профиль новый или незнакомый, проверьте источник до ссылок, кодов, карты или оплаты.`;
}

function deriveHints(text: string): ImageRiskHint[] {
  const hints: ImageRiskHint[] = [];
  if (SECRET_RE.test(text)) hints.push("otp_or_secret");
  if (APK_RE.test(text)) hints.push("apk_install");
  if (QR_LOGIN_RE.test(text)) hints.push("qr_login");
  if (QR_PAYMENT_RE.test(text)) hints.push("qr_payment");
  if (TELEGRAM_ACCOUNT_TAKEOVER_IMAGE_RE.test(text)) hints.push("telegram_account_takeover");
  if (FAKE_DEVICE_SECURITY_POPUP_RE.test(text)) {
    hints.push("fake_device_security_popup");
    hints.push("apk_install");
    hints.push("urgent_pressure");
  }
  if (PAYMENT_RE.test(text) && !WALLET_CONTEXT_RE.test(text)) hints.push("payment_request");
  if (/(cvv|pin|карта|karta|card).{0,40}(номер|raqam|digits|цифр)/i.test(text))
    hints.push("card_data");
  if (URGENCY_RE.test(text)) hints.push("urgent_pressure");
  if (BRAND_RE.test(text) && (SECRET_RE.test(text) || PAYMENT_RE.test(text) || APK_RE.test(text))) {
    hints.push("brand_impersonation");
  }
  if (CASINO_BONUS_RE.test(text) && CASINO_ACTION_RE.test(text)) {
    hints.push("casino_bonus_or_free_spins");
  }
  if (BETTING_PROMO_RE.test(text) && BETTING_ACTION_RE.test(text)) {
    hints.push("casino_bonus_or_free_spins");
  }
  if (GIVEAWAY_CONTEXT_RE.test(text) && GIVEAWAY_ACTION_RE.test(text)) {
    hints.push("giveaway_or_prize_actions");
  }
  if (STARS_GIFT_MECHANIC_RE.test(text)) {
    hints.push("giveaway_or_prize_actions");
  }
  if (
    (FAKE_CAPTCHA_VOTING_RE.test(text) && GIVEAWAY_CONTEXT_RE.test(text)) ||
    VOTING_PRIZE_MECHANIC_RE.test(text)
  ) {
    hints.push("fake_captcha_or_voting");
  }
  if (TASK_REWARD_RE.test(text) && REWARD_BENEFIT_RE.test(text)) {
    hints.push("task_reward_or_engagement");
  }
  if (WALLET_CONTEXT_RE.test(text) && WALLET_ACTION_RE.test(text)) {
    hints.push("wallet_or_defi_urgency");
  }
  if (TON_REFERRAL_CONTEXT_RE.test(text) && TON_REFERRAL_REWARD_RE.test(text)) {
    hints.push("ton_referral_or_earning");
  }
  if (TELEGRAM_PRIVATE_INVITE_RE.test(text)) {
    hints.push("telegram_invite_or_private_link");
  }
  return uniqueHints(hints);
}

function deriveCategory(
  text: string,
  qrPresent: boolean,
  hints: ImageRiskHint[],
): ImageVisualCategory {
  if (hints.includes("apk_install")) return "apk_prompt";
  if (hints.includes("qr_login") || hints.includes("qr_payment")) return "qr_login_or_payment";
  if (hints.includes("telegram_account_takeover")) return "chat_screenshot";
  if (hints.includes("casino_bonus_or_free_spins")) return "casino_or_betting_promo";
  if (hints.includes("giveaway_or_prize_actions") || hints.includes("fake_captcha_or_voting")) {
    return "crypto_giveaway_or_nft";
  }
  if (hints.includes("wallet_or_defi_urgency")) return "wallet_or_defi_action";
  if (hints.includes("task_reward_or_engagement") || hints.includes("ton_referral_or_earning")) {
    return "telegram_promo_post";
  }
  if (hints.includes("payment_request") || hints.includes("card_data")) return "payment_request";
  if (qrPresent && MENU_RE.test(text)) return "restaurant_menu_qr";
  if (qrPresent) return "qr_menu_or_info";
  if (TELEGRAM_PROFILE_CARD_RE.test(text)) return "telegram_profile_card";
  if (DELIVERY_RE.test(text)) return "delivery_sms";
  if (TELEGRAM_POST_RE.test(text)) {
    return ORDINARY_NEWS_RE.test(text) ? "news_or_channel_post" : "telegram_promo_post";
  }
  if (/(telegram|whatsapp|sms|чат|переписк|message|xabar)/i.test(text)) return "chat_screenshot";
  return "unknown";
}

function deriveQrPurpose(text: string, hints: ImageRiskHint[]): ImageQrPurpose {
  if (hints.includes("qr_login")) return "login";
  if (hints.includes("qr_payment")) return "payment";
  if (MENU_RE.test(text)) return "menu";
  if (QR_RE.test(text)) return "info";
  return "unknown";
}

function stripUrlSentencePunctuation(value: string): string {
  return value.replace(/[.,!?;:'"\]}»”’]+$/gu, "");
}

function observedUrlIdentity(value: string): string | null {
  const stripped = stripUrlSentencePunctuation(value.trim());
  if (!stripped) return null;
  try {
    const parsed = new URL(/^https?:\/\//iu.test(stripped) ? stripped : `https://${stripped}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function extractObservedUrls(text: string): string[] {
  const byIdentity = new Map<string, string>();
  for (const match of text.match(OBSERVED_URL_RE) ?? []) {
    const stripped = stripUrlSentencePunctuation(match);
    const identity = observedUrlIdentity(stripped);
    if (identity && !byIdentity.has(identity)) byIdentity.set(identity, stripped);
  }
  return [...byIdentity.values()];
}

export function fallbackImageIntelligence(text: string | null): ImageIntelligenceResult {
  const rawSource = text ?? "";
  const rawObservedUrls = extractObservedUrls(rawSource);
  const observedUrls = rawObservedUrls.map((value) => redactDecodedQrValue(value).slice(0, 500));
  const rawVisibleUrl = rawObservedUrls[0] ?? null;
  const redacted = clampText(rawSource ? redactText(rawSource) : null, 2000);
  const source = redacted ?? "";
  const analysisSource = [rawSource, source].filter(Boolean).join("\n");
  const qrPresent = QR_RE.test(analysisSource);
  const hints = deriveHints(analysisSource);
  const visualCategory = deriveCategory(analysisSource, qrPresent, hints);
  return {
    text: redacted,
    visualCategory,
    confidence: source.length > 0 ? "medium" : "low",
    qr: {
      present: qrPresent,
      visibleUrl: rawVisibleUrl ? redactDecodedQrValue(rawVisibleUrl).slice(0, 500) : null,
      visibleUrlObservedInText: rawVisibleUrl !== null,
      observedUrls,
      purpose: deriveQrPurpose(source, hints),
      decodedValues: [],
    },
    riskHints: hints,
    summary: null,
  };
}

export function sanitizeImageIntelligence(raw: unknown): ImageIntelligenceResult | null {
  const obj =
    typeof raw === "string" ? extractJsonObject(raw) : raw && typeof raw === "object" ? raw : null;
  if (!obj || typeof obj !== "object") return null;

  const rec = obj as Record<string, unknown>;
  const rawText = asString(rec.text);
  const text = clampText(rawText ? redactText(rawText) : null, 2000);
  const fallback = fallbackImageIntelligence(rawText);

  const modelHints = Array.isArray(rec.riskHints)
    ? rec.riskHints.filter((h): h is ImageRiskHint => RISK_HINTS.includes(h as ImageRiskHint))
    : [];
  const riskHints = uniqueHints([...modelHints, ...fallback.riskHints]);

  const qrObj = rec.qr && typeof rec.qr === "object" ? (rec.qr as Record<string, unknown>) : {};
  const qrPresent = typeof qrObj.present === "boolean" ? qrObj.present : fallback.qr.present;
  const modelVisibleUrl = asString(qrObj.visibleUrl);
  const rawObservedUrls = extractObservedUrls(rawText ?? "");
  const modelVisibleIdentity = modelVisibleUrl ? observedUrlIdentity(modelVisibleUrl) : null;
  const matchingObservedUrl = modelVisibleIdentity
    ? rawObservedUrls.find((value) => observedUrlIdentity(value) === modelVisibleIdentity)
    : undefined;
  const selectedVisibleUrl = matchingObservedUrl ?? rawObservedUrls[0] ?? modelVisibleUrl;
  const visibleUrlObservedInText = matchingObservedUrl !== undefined || rawObservedUrls.length > 0;
  const observedUrls = rawObservedUrls.map((value) => redactDecodedQrValue(value).slice(0, 500));
  const qrPurpose = pickEnum(qrObj.purpose, QR_PURPOSES, deriveQrPurpose(text ?? "", riskHints));
  const derivedCategory = deriveCategory(text ?? "", qrPresent, riskHints);
  const modelCategory = pickEnum(rec.visualCategory, CATEGORIES, derivedCategory);
  const visualCategory =
    fallback.visualCategory === "telegram_profile_card" &&
    !hasStrongDangerHint(riskHints) &&
    ["unknown", "chat_screenshot", "telegram_promo_post", "news_or_channel_post"].includes(
      modelCategory,
    )
      ? "telegram_profile_card"
      : modelCategory;
  const rawSummary = asString(rec.summary);
  const summary = sanitizeAiExplanation(clampText(rawSummary ? redactText(rawSummary) : null, 320));

  return {
    text,
    visualCategory,
    confidence: pickEnum(rec.confidence, CONFIDENCES, fallback.confidence),
    qr: {
      present: qrPresent,
      visibleUrl: selectedVisibleUrl
        ? redactDecodedQrValue(selectedVisibleUrl).slice(0, 500)
        : null,
      visibleUrlObservedInText,
      observedUrls,
      purpose: qrPurpose,
      decodedValues: [],
    },
    riskHints,
    summary,
  };
}

function decodedQrValues(evidence: ImageIntelligenceResult): string[] {
  return evidence.qr.decodedValues ?? [];
}

function decodedQrInputLines(evidence: ImageIntelligenceResult): string[] {
  return decodedQrValues(evidence).map((value) => `Decoded QR URL/value: ${value}`);
}

const LABELED_PASSWORD_RE =
  /((?<![\p{L}\p{N}_])(?:password|passcode|passwd|pwd|parol|пароль)\s*[:=]\s*)[^;\r\n]+/giu;
const LABELED_OTP_RE =
  /((?<![\p{L}\p{N}_])(?:otp|sms(?:\s+verification)?\s+code|verification\s+code|смс\s*код|код\s+из\s+смс|tasdiq\s+kodi)\s*[:=]\s*)(?:\d[\s.-]*){4,8}/giu;
const LABELED_PASSWORD_MARKER_RE =
  /(?<![\p{L}\p{N}_])(?:password|passcode|passwd|pwd|parol|пароль)\s*[:=]/iu;
const LABELED_OTP_MARKER_RE =
  /(?<![\p{L}\p{N}_])(?:otp|sms(?:\s+verification)?\s+code|verification\s+code|смс\s*код|код\s+из\s+смс|tasdiq\s+kodi)\s*[:=]\s*(?:\d[\s.-]*){4,8}/iu;
const SENSITIVE_QUERY_VALUE_RE =
  /[?&](?:token|secret|session|auth|code|password|pass|otp|pin|cvv|invite)=[^&\s]+/iu;
const LABELED_RECOVERY_PHRASE_RE =
  /((?<![\p{L}\p{N}_])(?:(?:seed|recovery|backup|mnemonic)\s*(?:phrase|words?)?|сид[-\s]?фраза|фраза\s+восстановления|резервные\s+слова|tiklash\s+(?:iborasi|so['’]?zlari)|maxfiy\s+ibora)\s*[:=]\s*)([^;\r\n]+)/giu;
const RECOVERY_PHRASE_LENGTHS = new Set([12, 15, 18, 21, 24]);

function findWifiPasswordField(
  value: string,
  fromIndex = 0,
): { end: number; start: number } | null {
  for (let markerIndex = fromIndex; markerIndex + 2 <= value.length; markerIndex += 1) {
    const marker = value[markerIndex];
    if (
      (marker !== "P" && marker !== "p") ||
      value[markerIndex + 1] !== ":" ||
      (markerIndex > 0 && value[markerIndex - 1] !== ";")
    ) {
      continue;
    }

    const passwordStart = markerIndex + 2;
    let emptyField = false;
    for (let index = passwordStart; index < value.length; index += 1) {
      if (value[index] === "\\") {
        index += 1;
        continue;
      }
      if (value[index] === ";") {
        if (index > passwordStart) return { start: markerIndex, end: index };
        emptyField = true;
        break;
      }
    }

    if (passwordStart < value.length && !emptyField) {
      return { start: markerIndex, end: value.length };
    }
  }

  return null;
}

function redactWifiPasswordFields(value: string): string {
  let cursor = 0;
  let redacted = "";

  for (
    let range = findWifiPasswordField(value);
    range;
    range = findWifiPasswordField(value, cursor)
  ) {
    redacted += `${value.slice(cursor, range.start)}P:[hidden]`;
    cursor = range.end;
  }

  return cursor === 0 ? value : redacted + value.slice(cursor);
}

function redactLabeledRecoveryPhrase(value: string): string {
  return value.replace(
    LABELED_RECOVERY_PHRASE_RE,
    (full: string, label: string, candidate: string) => {
      const words = candidate
        .trim()
        .split(/[\s,]+/u)
        .filter(Boolean);
      if (
        RECOVERY_PHRASE_LENGTHS.has(words.length) &&
        words.every((word) => /^\p{L}{2,}$/u.test(word))
      ) {
        return `${label}[hidden]`;
      }
      return full;
    },
  );
}

function decodedQrContainsSecret(value: string): boolean {
  if (findWifiPasswordField(value)) return true;
  if (
    LABELED_PASSWORD_MARKER_RE.test(value) ||
    LABELED_OTP_MARKER_RE.test(value) ||
    SENSITIVE_QUERY_VALUE_RE.test(value)
  ) {
    return true;
  }
  return redactLabeledRecoveryPhrase(value) !== value;
}

function shouldAddDecodedSecretHint(value: string): boolean {
  if (TELEGRAM_PRIVATE_INVITE_RE.test(value)) return false;
  const kind = classifyDecodedQrValue(value);
  if (kind === "telegram_login" || kind === "authenticator") return false;
  return decodedQrContainsSecret(value);
}

function redactDecodedQrValue(value: string): string {
  return redactWifiPasswordFields(redactLabeledRecoveryPhrase(value).trim())
    .replace(LABELED_PASSWORD_RE, "$1[hidden]")
    .replace(LABELED_OTP_RE, "$1[hidden]")
    .replace(/((?:tg|telegram):\/\/login\?token=)[^&\s]+/i, "$1[hidden]")
    .replace(
      /((?<![\p{L}\p{N}_.-])(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:joinchat\/|\+))[^/?#\s]+/giu,
      "$1[hidden]",
    )
    .replace(/((?:otpauth):\/\/[^\s?]+(?:\?[^#\s]*?\bsecret=))[^&\s]+/i, "$1[hidden]")
    .replace(
      /([?&](?:token|secret|session|auth|code|password|pass|otp|pin|cvv|invite)=)[^&\s]+/gi,
      "$1[hidden]",
    )
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card]");
}

function classifyDecodedQrValue(value: string): DecodedQrKind {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  if (/^(?:tg|telegram):\/\/login(?:[/?#]|$)/i.test(lower)) return "telegram_login";
  if (/^otpauth:\/\//i.test(lower)) return "authenticator";
  if (/^(?:ton|tonkeeper|wc):/i.test(lower) || lower.includes("walletconnect")) {
    return "wallet_deeplink";
  }
  if (/^(?:click|payme|uzcard|humo|uzum|apelsin|paynet):/i.test(lower)) return "payment";

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "tg:" || protocol === "telegram:") {
      const route = `${url.hostname}${url.pathname}`.replace(/^\/+|\/+$/gu, "");
      return /^login(?:\/|$)/iu.test(route) ? "telegram_login" : "unknown";
    }
    if (protocol === "otpauth:") return "authenticator";
    if (protocol === "ton:" || protocol === "tonkeeper:" || protocol === "wc:") {
      return "wallet_deeplink";
    }

    if (protocol === "http:" || protocol === "https:") {
      const host = url.hostname.toLowerCase();
      const pathAndQuery = `${url.pathname} ${url.search}`.toLowerCase();
      const paymentHost = /(payme|click|uzcard|humo|uzum|apelsin|paynet|octo)/i.test(host);
      const paymentPath =
        /(?:^|[/?&=_-])(pay|payment|checkout|invoice|transfer|topup|deposit|merchant|bill|card|oplata|tolov)(?:$|[/?&=_-])/i.test(
          pathAndQuery,
        );
      if (paymentHost && paymentPath) return "payment";
      if (
        /\/(?:pay|payment|checkout|invoice|transfer|topup|deposit|oplata|tolov)(?:\/|$)/i.test(
          url.pathname,
        )
      ) {
        return "payment";
      }
      if (pathAndQuery.includes("walletconnect") || pathAndQuery.includes("connect-wallet")) {
        return "wallet_deeplink";
      }
      return "plain_url";
    }
  } catch {
    if (/^(?:t\.me|telegram\.me)\//i.test(trimmed)) return "plain_url";
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(trimmed)) return "plain_url";
  }

  return "unknown";
}

function decodedKinds(values: string[]): Set<DecodedQrKind> {
  return new Set(values.map(classifyDecodedQrValue));
}

function decodedHints(kinds: Set<DecodedQrKind>): ImageRiskHint[] {
  const hints: ImageRiskHint[] = [];
  if (kinds.has("telegram_login") || kinds.has("authenticator")) hints.push("qr_login");
  if (kinds.has("payment")) hints.push("qr_payment");
  if (kinds.has("wallet_deeplink")) hints.push("wallet_or_defi_urgency");
  return hints;
}

function deriveQrPurposeFromKinds(kinds: Set<DecodedQrKind>): ImageQrPurpose {
  if (kinds.has("telegram_login") || kinds.has("authenticator")) return "login";
  if (kinds.has("payment")) return "payment";
  if (kinds.has("plain_url") || kinds.has("wallet_deeplink")) return "info";
  return "unknown";
}

function deriveCategoryFromKinds(kinds: Set<DecodedQrKind>): ImageVisualCategory | null {
  if (kinds.has("telegram_login") || kinds.has("authenticator") || kinds.has("payment")) {
    return "qr_login_or_payment";
  }
  if (kinds.has("wallet_deeplink")) return "wallet_or_defi_action";
  return null;
}

function displayDecodedQrValue(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      const path = url.pathname === "/" ? "" : url.pathname;
      return `${url.hostname}${path}`.slice(0, 80);
    }
    if (protocol === "tg:" || protocol === "telegram:") return "Telegram login QR (token hidden)";
    if (protocol === "otpauth:") return "2FA/authenticator QR (secret hidden)";
    if (protocol === "ton:" || protocol === "tonkeeper:") return "Wallet/deep-link QR";
    return `${protocol.replace(":", "")} QR value`;
  } catch {
    if (/^(?:t\.me|telegram\.me)\//i.test(trimmed)) return trimmed.slice(0, 80);
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(trimmed)) return trimmed.slice(0, 80);
    return null;
  }
}

function displayQrValues(values: string[]): string[] {
  return [
    ...new Set(values.map(displayDecodedQrValue).filter((v): v is string => Boolean(v))),
  ].slice(0, 4);
}

function decodedQrSummary(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  const values = displayQrValues(decodedQrValues(evidence));
  if (values.length === 0) return null;

  const joined = values.join(", ");
  if (lang === "uz") return `🔎 QR o'qildi: ${joined}.`;
  if (lang === "en") return `🔎 QR decoded: ${joined}.`;
  return `🔎 QR прочитан: ${joined}.`;
}

function visibleQrSummary(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  if (!evidence.qr.visibleUrl) return null;

  const [value] = displayQrValues([evidence.qr.visibleUrl]);
  if (!value) return null;

  if (lang === "uz") {
    return `🔎 QR yonidagi manzil: ${value}. QRning o'zi piksel bo'yicha tasdiqlanmadi.`;
  }
  if (lang === "en") {
    return `🔎 Address visible near the QR: ${value}. The QR itself was not confirmed from pixels.`;
  }
  return `🔎 Адрес рядом с QR/на изображении: ${value}. Сам QR по пикселям не подтверждён.`;
}

function unreadQrSummary(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  if (!evidence.qr.present) return null;

  if (lang === "uz") return "🔎 QR ko'rinadi, ammo kod ishonchli o'qilmadi.";
  if (lang === "en") return "🔎 QR is visible, but the code was not read reliably.";
  return "🔎 QR виден, но сам код надёжно не прочитан.";
}

function qrEvidenceSummary(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  return (
    decodedQrSummary(evidence, lang) ??
    visibleQrSummary(evidence, lang) ??
    unreadQrSummary(evidence, lang)
  );
}

export function hasUsableImageEvidence(evidence: ImageIntelligenceResult): boolean {
  const hasReadableText = Boolean(
    evidence.text && !LOW_INFORMATION_IMAGE_TEXT_RE.test(evidence.text),
  );
  const hasKnownQrPurpose = evidence.qr.purpose !== "unknown";
  const hasVisibleQrUrl = Boolean(evidence.qr.visibleUrl);
  const hasDecodedQr = decodedQrValues(evidence).length > 0;

  return Boolean(
    hasReadableText ||
    hasVisibleQrUrl ||
    hasDecodedQr ||
    hasKnownQrPurpose ||
    evidence.visualCategory !== "unknown" ||
    evidence.riskHints.length > 0,
  );
}

export function isBenignImageContext(evidence: ImageIntelligenceResult): boolean {
  return (
    evidence.riskHints.length === 0 &&
    ["delivery_sms", "restaurant_menu_qr", "qr_menu_or_info", "telegram_profile_card"].includes(
      evidence.visualCategory,
    )
  );
}

function readableImageText(evidence: ImageIntelligenceResult): string | null {
  if (!evidence.text || LOW_INFORMATION_IMAGE_TEXT_RE.test(evidence.text)) return null;
  return evidence.text;
}

function hasImageQrSignal(evidence: ImageIntelligenceResult, text: string): boolean {
  return Boolean(
    evidence.qr.present ||
    evidence.qr.visibleUrl ||
    evidence.qr.purpose !== "unknown" ||
    decodedQrValues(evidence).length > 0 ||
    QR_RE.test(text),
  );
}

export function isEvidenceBackedBenignImageContext(evidence: ImageIntelligenceResult): boolean {
  if (!isBenignImageContext(evidence)) return false;

  const text = readableImageText(evidence);
  if (!text) return false;

  switch (evidence.visualCategory) {
    case "delivery_sms":
      return DELIVERY_RE.test(text);
    case "restaurant_menu_qr":
      return MENU_RE.test(text) && hasImageQrSignal(evidence, text);
    case "qr_menu_or_info":
      return QR_RE.test(text) && hasImageQrSignal(evidence, text);
    case "telegram_profile_card":
      return false;
    default:
      return false;
  }
}

function readableVisibleQrUrl(evidence: ImageIntelligenceResult): string | null {
  const visibleUrl = evidence.qr.visibleUrl;
  if (!visibleUrl) return null;

  const pixelDecoded = decodedQrValues(evidence).some((value) => value === visibleUrl);
  const readableInText =
    evidence.qr.visibleUrlObservedInText === true ||
    Boolean(evidence.text && evidence.text.includes(visibleUrl));
  return pixelDecoded || readableInText ? visibleUrl : null;
}

function readableImageUrls(evidence: ImageIntelligenceResult): string[] {
  const values = [...(evidence.qr.observedUrls ?? [])];
  const visibleUrl = readableVisibleQrUrl(evidence);
  if (visibleUrl) values.push(visibleUrl);
  return [...new Set(values)];
}

function dangerousHintText(hint: ImageRiskHint): string {
  switch (hint) {
    case "otp_or_secret":
      return "Просят OTP/SMS-код подтверждения или другой секрет.";
    case "apk_install":
      return "Просят установить APK или подозрительное приложение.";
    case "qr_login":
      return "Просят отсканировать QR-код, чтобы войти или подтвердить аккаунт.";
    case "qr_payment":
      return "Просят отсканировать QR-код для оплаты или перевода.";
    case "telegram_account_takeover":
      return "Похоже на фишинг Telegram: пугают блокировкой, удалением или проверкой аккаунта и ведут по ссылке/боту.";
    case "fake_device_security_popup":
      return "Похоже на ложное предупреждение безопасности телефона: пугают вирусами или повреждением iOS/Android и подталкивают установить программу.";
    case "payment_request":
      return "Просят предоплату до услуги или перевод денег.";
    case "card_data":
      return "Просят данные или цифры карты.";
    case "urgent_pressure":
      return "Торопят или создают срочность.";
    case "brand_impersonation":
      return "Похоже на сообщение от имени банка, сервиса или официальной организации.";
    case "casino_bonus_or_free_spins":
      return "Видно казино, ставки или фриспины вместе с бонусом, депозитом, ссылкой или подпиской.";
    case "fake_captcha_or_voting":
      return "Розыгрыш, NFT, Stars или подарок привязан к капче, голосованию, реакциям или подтверждению.";
    case "giveaway_or_prize_actions":
      return "Обещают приз, NFT, Stars или подарок за действие, участие, спин, бота или ссылку.";
    case "task_reward_or_engagement":
      return "Обещают деньги, токены или призы за простые действия, очки, апгрейды или leaderboard.";
    case "wallet_or_defi_urgency":
      return "Видно wallet/DeFi сообщение: security incident, 24-hour grace period, liquidation, top up, fee или balance.";
    case "ton_referral_or_earning":
      return "Обещают TON, crypto или Stars за приглашения, referral link или друзей.";
    case "telegram_invite_or_private_link":
      return "Image evidence: private Telegram invite link to a closed chat or channel.";
  }
}

export function buildImageCheckInput(evidence: ImageIntelligenceResult): string {
  const lines: string[] = [];
  const decodedLines = decodedQrInputLines(evidence);

  if (isBenignImageContext(evidence)) {
    if (evidence.visualCategory === "delivery_sms") {
      lines.push("Контекст изображения: похоже на уведомление о выдаче заказа.");
    } else if (evidence.visualCategory === "restaurant_menu_qr") {
      lines.push("Контекст изображения: похоже на меню ресторана или программу лояльности.");
    } else if (evidence.visualCategory === "telegram_profile_card") {
      lines.push(
        "Контекст изображения: скрин профиля Telegram. Видимые поля профиля сами по себе не доказывают мошенничество.",
      );
      for (const signal of telegramProfileSignals(evidence.text, "ru")) {
        lines.push(`По скриншоту видно: ${signal}`);
      }
    } else {
      lines.push("Контекст изображения: похоже на информационный плакат.");
    }
    // A benign provider category may change presentation, but a model-only
    // URL guess is still not evidence. Keep the destination only when OCR or
    // pixel decoding independently made that exact value readable.
    for (const visibleUrl of readableImageUrls(evidence)) {
      lines.push(`Видимый адрес из QR/изображения: ${visibleUrl}`);
    }
    lines.push(...decodedLines);
    return lines.join("\n").slice(0, 2000);
  }

  if (evidence.text) lines.push(evidence.text);
  for (const visibleUrl of readableImageUrls(evidence)) {
    // P3: only let a QR-adjacent URL drive domain scoring when it is genuinely
    // readable — a pixel-decoded QR payload or a URL that also appears in OCR
    // text. A URL the model merely guessed near a QR it could not decode must
    // not produce a "suspicious domain" verdict on its own.
    lines.push(`Видимый адрес из QR/изображения: ${visibleUrl}`);
  }
  for (const line of decodedLines) {
    if (
      !lines.some((existing) => existing.includes(line.replace(/^Decoded QR URL\/value: /, "")))
    ) {
      lines.push(line);
    }
  }
  for (const hint of evidence.riskHints) lines.push(dangerousHintText(hint));

  if (lines.length === 0 && evidence.summary) lines.push(evidence.summary);
  return lines.join("\n").slice(0, 2000);
}

export function mergeDecodedQrEvidence(
  evidence: ImageIntelligenceResult,
  decoded: DecodedQrEvidence,
): ImageIntelligenceResult {
  if (decoded.values.length === 0) return evidence;

  const containsDecodedSecret = decoded.values.some(shouldAddDecodedSecretHint);
  const containsDecodedPrivateInvite = decoded.values.some((value) =>
    TELEGRAM_PRIVATE_INVITE_RE.test(value),
  );
  const decodedValues = [
    ...new Set(decoded.values.map((value) => redactDecodedQrValue(value).slice(0, 500))),
  ];
  const decodedUrls = [
    ...new Set(decoded.urls.map((value) => redactDecodedQrValue(value).slice(0, 500))),
  ];
  const kinds = decodedKinds(decodedValues);
  const decodedText = decodedValues.map((value) => `Decoded QR URL/value: ${value}`).join("\n");
  const combinedText = clampText([evidence.text, decodedText].filter(Boolean).join("\n"), 2000);
  const combinedForHints = [combinedText, decodedUrls.join("\n")].filter(Boolean).join("\n");
  const riskHints = uniqueHints([
    ...evidence.riskHints,
    ...(containsDecodedSecret ? (["otp_or_secret"] as const) : []),
    ...(containsDecodedPrivateInvite ? (["telegram_invite_or_private_link"] as const) : []),
    ...decodedHints(kinds),
    ...deriveHints(combinedForHints),
  ]);
  const decodedPurpose = deriveQrPurposeFromKinds(kinds);
  const qrPurpose =
    decodedPurpose === "login" || decodedPurpose === "payment"
      ? decodedPurpose
      : evidence.qr.purpose !== "unknown"
        ? evidence.qr.purpose
        : decodedPurpose !== "unknown"
          ? decodedPurpose
          : deriveQrPurpose(combinedForHints, riskHints);
  const derivedCategory =
    deriveCategoryFromKinds(kinds) ?? deriveCategory(combinedForHints, true, riskHints);
  const visualCategory =
    evidence.visualCategory !== "unknown" && evidence.visualCategory !== "qr_menu_or_info"
      ? evidence.visualCategory
      : derivedCategory;

  return {
    ...evidence,
    text: combinedText,
    visualCategory,
    riskHints,
    qr: {
      ...evidence.qr,
      present: true,
      visibleUrl: evidence.qr.visibleUrl ?? decodedUrls[0] ?? null,
      purpose: qrPurpose,
      decodedValues,
    },
  };
}

export function buildDecodedQrOnlyImageEvidence(
  decoded: DecodedQrEvidence,
): ImageIntelligenceResult | null {
  if (decoded.values.length === 0) return null;

  const kinds = decodedKinds(decoded.values);
  const containsPrivateInvite = decoded.values.some((value) =>
    TELEGRAM_PRIVATE_INVITE_RE.test(value),
  );
  const actionable =
    kinds.has("telegram_login") ||
    kinds.has("authenticator") ||
    kinds.has("payment") ||
    kinds.has("wallet_deeplink") ||
    containsPrivateInvite;
  if (!actionable) return null;

  const evidence = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), decoded);
  return evidence;
}

function telegramProfileExplanation(evidence: ImageIntelligenceResult, lang: Lang): string {
  const signals = telegramProfileSignals(evidence.text, lang);
  const visibleMessageNote = telegramProfileVisibleMessageNote(evidence.text, lang);
  const visible =
    signals.length > 0
      ? signals.map((signal) => `• ${signal}`).join("\n")
      : lang === "uz"
        ? "• Profil maydonlari to'liq o'qilmadi"
        : lang === "en"
          ? "• Profile fields were not read fully"
          : "• Поля профиля прочитались не полностью";

  if (lang === "uz") {
    return `Telegram profil skrinshotidan ko'rinadi:\n${visible}${visibleMessageNote ? `\n\n${visibleMessageNote}` : ""}\n\nSkrinshotni o'zgartirish mumkin, shuning uchun bu akkaunt firibgar degani emas. Muhimi: odam sizdan kod, pul, karta, APK, QR-kirish, wallet yoki havola orqali amal so'rayaptimi. Agar yozishma bo'lsa, xabar yoki keyingi ekranni yuboring.`;
  }
  if (lang === "en") {
    return `From the Telegram profile screenshot I can see:\n${visible}${visibleMessageNote ? `\n\n${visibleMessageNote}` : ""}\n\nA screenshot can be edited, so this is not proof that the account is a scam. The key question is what the person asks next: a code, money, card, APK, QR login, wallet action, or a link. If you have the chat, send the message or next screen.`;
  }
  return `По скриншоту профиля видно:\n${visible}${visibleMessageNote ? `\n\n${visibleMessageNote}` : ""}\n\nСам скрин можно подделать, поэтому это не доказательство скама. Важнее, что просит человек дальше: код, деньги, карту, APK, QR-вход, wallet или перейти по ссылке. Если есть переписка — пришлите сообщение или следующий экран.`;
}

function scenarioImageExplanation(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  const hints = new Set(evidence.riskHints);
  const category = evidence.visualCategory;
  const qrSummary = qrEvidenceSummary(evidence, lang);

  if (hints.has("qr_login") || evidence.qr.purpose === "login") {
    if (lang === "uz") {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}Bu QR kirish, qurilma ulash yoki 2FA tasdiqlash ekraniga o‘xshaydi. Begona odam yuborgan QRni skanerlamang: u Telegram, bank yoki boshqa akkauntga sessiya ochishi mumkin. QRni faqat o‘zingiz rasmiy ilova yoki saytda ochganingizda skanerlang.`;
    }
    if (lang === "en") {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}This looks like a QR login, device-linking, or 2FA confirmation screen. Do not scan a QR sent by another person: it can open a session into Telegram, a bank, or another account. Scan QR codes only when you opened them yourself in the official app or website.`;
    }
    return `${qrSummary ? `${qrSummary}\n\n` : ""}Похоже на QR для входа, подключения устройства или 2FA. Не сканируйте QR, который прислал другой человек: так можно открыть сессию в Telegram, банке или другом аккаунте. Сканируйте QR только если вы сами открыли его в официальном приложении или на сайте.`;
  }

  if (hints.has("qr_payment") || evidence.qr.purpose === "payment") {
    if (lang === "uz") {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}Bu QR to‘lov yoki pul o‘tkazish uchun ishlatilayotganga o‘xshaydi. Chat, reklama yoki qo‘ng‘iroqdan kelgan QR orqali pul yubormang. Xizmat yoki bank ilovasini o‘zingiz oching va manzil/rekvizitni tekshiring.`;
    }
    if (lang === "en") {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}This looks like a QR for payment or transfer. Do not pay through a QR sent in a chat, ad, or call. Open the official bank/service app yourself and verify the recipient or page address there.`;
    }
    return `${qrSummary ? `${qrSummary}\n\n` : ""}Похоже на QR для оплаты или перевода. Не платите по QR из чата, рекламы или звонка. Откройте официальное приложение банка/сервиса сами и проверьте получателя или адрес страницы там.`;
  }

  if (category === "telegram_profile_card" && !hasStrongDangerHint(evidence.riskHints)) {
    return telegramProfileExplanation(evidence, lang);
  }

  if (hints.has("telegram_account_takeover")) {
    if (lang === "uz") {
      return "Bu Telegram akkauntini o'g'irlashga o'xshaydi: bloklash, o'chirish, muzlatish yoki 'tekshiruv' bilan qo'rqitib, havola/bot orqali kirishga undashadi. Havolaga kirmang, kod kiritmang. Telegram ichida Settings > Devices orqali begona sessiyalarni tekshiring va 2FA yoqing.";
    }
    if (lang === "en") {
      return "This looks like Telegram account-takeover phishing: it scares you with deletion, blocking, freezing, or verification and pushes you to a link or bot. Do not open the link or enter a code. In Telegram, check Settings > Devices and enable 2FA.";
    }
    return "Похоже на фишинг для угона Telegram: пугают удалением, блокировкой, заморозкой или «проверкой» аккаунта и ведут по ссылке/боту. Не переходите и не вводите код. В Telegram проверьте Настройки > Устройства и включите двухэтапную защиту.";
  }

  if (hints.has("fake_device_security_popup")) {
    if (lang === "uz") {
      return "Bu soxta telefon xavfsizligi oynasiga o'xshaydi: iPhone/iOS/Android buzilgan, virus bor yoki ma'lumotlar yo'qoladi deb qo'rqitib, dastur o'rnatishga undashadi. Hech narsa o'rnatmang. Sahifani yoping, ilovani rasmiy App Store/Play Marketdan tashqarida yuklamang.";
    }
    if (lang === "en") {
      return "This looks like a fake phone security pop-up: it scares you with viruses, damaged iOS/Android, or data loss and pushes you to install software. Do not install anything. Close the page and only use official App Store/Play Market apps.";
    }
    return "Похоже на ложное предупреждение безопасности телефона: пугают вирусами, повреждением iOS/Android или потерей данных и подталкивают установить программу. Ничего не устанавливайте. Закройте страницу, приложения ставьте только из официального App Store/Play Market.";
  }

  if (hints.has("apk_install") || category === "apk_prompt") {
    if (lang === "uz") {
      return "Rasmda APK, .exe yoki shubhali fayl/ilova ko'rinmoqda. Uni sud chaqiruvi, hujjat, tabrik, ovozli xabar yoki xavfsizlik dasturi deb atashlari mumkin, lekin bunday fayl telefoningizga kirish, SMS va bank ilovalarini o'g'irlashi mumkin. Ochmang va o'rnatmang.";
    }
    if (lang === "en") {
      return "The image shows an APK, .exe, or suspicious file/app. It may be presented as a court notice, document, greeting, voice message, or security app, but such files can steal access to the phone, SMS, and banking apps. Do not open or install it.";
    }
    return "На изображении виден APK, .exe или подозрительный файл/приложение. Его могут назвать повесткой, документом, открыткой, голосовым или защитной программой, но такой файл может получить доступ к телефону, SMS и банковским приложениям. Не открывайте и не устанавливайте.";
  }

  if (hints.has("casino_bonus_or_free_spins") || category === "casino_or_betting_promo") {
    if (lang === "uz") {
      return "Rasm Telegramdagi kazino, stavka yoki free-spins promoga o‘xshaydi: bonus, depozit, havola yoki obuna ko‘rinmoqda. Bunday funnel ko‘pincha balans to‘ldirish, karta/hamyon ulash yoki yopiq kanalga o‘tishga olib boradi. Pul kiritmang va havoladan ro‘yxatdan o‘tmang.";
    }
    if (lang === "en") {
      return "This looks like a Telegram casino/betting promo: free spins, bonus, deposit, link or subscription is visible. This funnel often leads to topping up a balance, connecting a card/wallet, or joining a closed channel. Do not deposit or register through the promo link.";
    }
    return "Похоже на Telegram-промо казино/ставок: видны фриспины, бонус, депозит, ссылка или подписка. Такой путь часто ведёт к пополнению баланса, вводу карты/кошелька или закрытому каналу. Не пополняйте баланс и не регистрируйтесь по промо-ссылке.";
  }

  if (hints.has("wallet_or_defi_urgency") || category === "wallet_or_defi_action") {
    if (lang === "uz") {
      return "Rasmda wallet/DeFi yoki token bilan bog‘liq tezkor amal ko‘rinmoqda: top up, fee, liquidation, balance yoki app-link. Xavf shundaki, foydalanuvchini hamyon ulashga, tranzaksiya imzolashga yoki seed phrase kiritishga shoshirishadi. Faqat rasmiy ilovani o‘zingiz ochib tekshiring.";
    }
    if (lang === "en") {
      return "The image shows a wallet/DeFi or token action with urgency: top-up, fee, liquidation, balance, or app link. The danger is being rushed into connecting a wallet, signing a transaction, or entering a seed phrase. Open the official app yourself and verify there.";
    }
    return "На изображении wallet/DeFi или токен-действие со срочностью: top up, fee, liquidation, balance или app-link. Риск в том, что вас могут подтолкнуть подключить кошелёк, подписать транзакцию или ввести seed phrase. Откройте официальный кошелёк сами и проверьте там.";
  }

  if (hints.has("ton_referral_or_earning")) {
    if (lang === "uz") {
      return "Ko‘rinib turibdi: TON/crypto/Stars evaziga do‘stlarni taklif qilish yoki referral link yuborish taklif qilinmoqda. Bu har doim firibgarlik degani emas, lekin ko‘pincha odamlarni bot/mini-app ichida ro‘yxatdan o‘tkazish, wallet ulash yoki pulli harakatga olib boradi. Havoladan oldin manbani tekshiring.";
    }
    if (lang === "en") {
      return "I can see a TON/crypto/Stars earning offer tied to inviting friends or referral links. This is not automatically a scam, but it often pulls users into bots/mini-apps, wallet connection, or paid actions. Verify the source before following the link.";
    }
    return "Вижу механику “TON/crypto/Stars за приглашения или referral link”. Это не всегда скам, но часто такие посты ведут в бота/mini-app, к подключению кошелька или платному действию. Сначала проверьте источник, не вводите seed phrase, карту или Telegram-код.";
  }

  if (hints.has("task_reward_or_engagement")) {
    if (lang === "uz") {
      return "Bu post oddiy harakatlar, ochkolar, leaderboard yoki campaign evaziga mukofot va’da qilmoqda. Bunday mexanika foydalanuvchini ko‘proq bosishga, botlarga kirishga yoki keyin karta/hamyon ma’lumotini berishga olib borishi mumkin. Mukofot uchun shoshilmang.";
    }
    if (lang === "en") {
      return "This post promises rewards for simple actions, points, leaderboards, or campaign participation. That mechanic can be used to push users into bots, links, and later card/wallet requests. Do not rush because of the reward.";
    }
    return "Пост обещает награду за простые действия, очки, leaderboard или участие в кампании. Такая механика часто затягивает в ботов/ссылки, а дальше может попросить карту, кошелёк или оплату. Не торопитесь из‑за обещанного приза.";
  }

  if (
    hints.has("fake_captcha_or_voting") ||
    hints.has("giveaway_or_prize_actions") ||
    category === "crypto_giveaway_or_nft"
  ) {
    if (lang === "uz") {
      return "Rasmda NFT, Stars, sovg‘a yoki yutuq mexanikasi ko‘rinmoqda. Xavfli joyi: captcha, ovoz berish, reaksiyalar, bot, spin yoki “claim” tugmasi orqali keyin Telegram kodi, wallet yoki karta so‘ralishi mumkin. Sovrin uchun shaxsiy ma’lumot kiritmang.";
    }
    if (lang === "en") {
      return "The image shows an NFT, Stars, gift, or giveaway mechanic. The risky part is the next step: captcha, voting, reactions, bot, spin, or claim buttons can lead to Telegram-code, wallet, or card requests. Do not enter personal data for a prize.";
    }
    return "Вижу механику NFT/Stars/подарка или розыгрыша. Опасное место обычно не сам пост, а следующий шаг: капча, голосование, реакции, бот, спин или claim могут привести к запросу Telegram-кода, кошелька или карты. Не вводите личные данные ради приза.";
  }

  if (hints.has("telegram_invite_or_private_link")) {
    if (lang === "uz") {
      return "Rasm yoki matnda yopiq Telegram chat/kanalga invite-havola bor. Men ichidagi kontentni ko‘ra olmayman, shuning uchun faqat ko‘rinib turgan belgilarni baholayman. Invite’dan keyin kod, karta, wallet yoki to‘lov so‘ralsa, to‘xtang.";
    }
    if (lang === "en") {
      return "The image/text contains an invite link to a private Telegram chat or channel. I cannot inspect what is inside, so I only assess visible signals. If it asks for a code, card, wallet, or payment after joining, stop.";
    }
    return "Вижу invite-ссылку в закрытый Telegram-чат или канал. Я не могу посмотреть, что внутри, поэтому оцениваю только видимые признаки. Если после перехода попросят код, карту, кошелёк или оплату — остановитесь.";
  }

  return null;
}

export function buildImageUserExplanation(
  evidence: ImageIntelligenceResult,
  level: RiskLevel,
  lang: Lang,
): string {
  const category = evidence.visualCategory;
  const qrSummary = qrEvidenceSummary(evidence, lang);
  const hasDanger =
    evidence.riskHints.length > 0 || level === "high_risk" || level === "suspicious";

  if (lang === "uz") {
    if (!hasDanger && category === "delivery_sms") {
      return "Rasmda yetkazib berish yoki buyurtmani olish haqida SMS ko‘rinadi. Unda to‘lov, SMS-kod, APK yoki karta ma’lumotlarini so‘rash belgisi ko‘rinmayapti. Agar xabarda havola bo‘lsa, uni alohida yuboring.";
    }
    if (!hasDanger && (category === "restaurant_menu_qr" || category === "qr_menu_or_info")) {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}Rasm menyu, aksiya yoki ma’lumot beruvchi QRga o‘xshaydi. Men kirish, to‘lov, SMS-kod, karta yoki APK so‘rovini ko‘rmayapman. Xavf QR ochilgandan keyin shunday so‘rov paydo bo‘lsa boshlanadi. Sahifa manzilini tekshiring.`;
    }
    if (!hasDanger && (category === "telegram_promo_post" || category === "news_or_channel_post")) {
      return "Rasm Telegram posti yoki reklama xabariga o‘xshaydi. Kod, karta, wallet, APK, to‘lov yoki shoshilinch bosim belgisi ko‘rinmayapti. Agar tugma/havola ochilgandan keyin shaxsiy ma’lumot so‘ralsa, uni alohida yuboring.";
    }
    const scenario = scenarioImageExplanation(evidence, lang);
    if (scenario) return scenario;
    if (evidence.summary) return evidence.summary;
    return "Rasmdagi matn va kontekst tekshirildi. Agar sizdan kod, karta ma’lumoti, APK yoki pul so‘rashsa, avval to‘xtang va rasmiy kanal orqali tekshiring.";
  }

  if (lang === "en") {
    if (!hasDanger && category === "delivery_sms") {
      return "The image looks like a delivery or pickup SMS. I do not see a payment, SMS code, APK, or card-data request in this screenshot. If there is a link, send it separately for a more precise check.";
    }
    if (!hasDanger && (category === "restaurant_menu_qr" || category === "qr_menu_or_info")) {
      return `${qrSummary ? `${qrSummary}\n\n` : ""}The image looks like a menu, promo, or informational QR. I do not see a login, payment, SMS-code, card-data, or APK request. Risk starts if the page after opening asks for one of those. Check the page address.`;
    }
    if (!hasDanger && (category === "telegram_promo_post" || category === "news_or_channel_post")) {
      return "The image looks like a Telegram post or promo. I do not see a code, card, wallet, APK, payment, or urgency request in the visible content. If a button or link later asks for personal data, send that screen/link separately.";
    }
    const scenario = scenarioImageExplanation(evidence, lang);
    if (scenario) return scenario;
    if (evidence.summary) return evidence.summary;
    return "I checked the visible text and image context. If it asks for a code, card data, APK install, or money transfer, pause and verify through an official channel.";
  }

  if (!hasDanger && category === "delivery_sms") {
    return "На изображении похоже SMS о доставке или выдаче заказа. Я не вижу просьбы оплатить, отправить SMS-код, установить APK или ввести данные карты. Если в сообщении есть ссылка — пришлите её отдельно для точной проверки.";
  }
  if (!hasDanger && (category === "restaurant_menu_qr" || category === "qr_menu_or_info")) {
    return `${qrSummary ? `${qrSummary}\n\n` : ""}Похоже на меню, акцию или информационный QR. Я не вижу входа, оплаты, SMS-кода, карты или APK. Риск начинается, если после открытия попросят что-то из этого. Проверьте адрес страницы.`;
  }
  if (!hasDanger && (category === "telegram_promo_post" || category === "news_or_channel_post")) {
    return "Похоже на Telegram-пост или рекламное объявление. В видимой части я не вижу запроса кода, карты, кошелька, APK, оплаты или срочного давления. Если после кнопки/ссылки попросят личные данные — пришлите следующий экран или ссылку отдельно.";
  }
  const scenario = scenarioImageExplanation(evidence, lang);
  if (scenario) return scenario;
  if (evidence.summary) return evidence.summary;
  return "Я проверил видимый текст и контекст изображения. Если там просят код, данные карты, APK или перевод денег — остановитесь и проверьте через официальный канал.";
}
