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
  | "unknown";

export type ImageConfidence = "low" | "medium" | "high";
export type ImageQrPurpose = "menu" | "info" | "login" | "payment" | "unknown";

export type ImageRiskHint =
  | "otp_or_secret"
  | "apk_install"
  | "qr_login"
  | "qr_payment"
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
  "unknown",
];

const CONFIDENCES: readonly ImageConfidence[] = ["low", "medium", "high"];
const QR_PURPOSES: readonly ImageQrPurpose[] = ["menu", "info", "login", "payment", "unknown"];
const RISK_HINTS: readonly ImageRiskHint[] = [
  "otp_or_secret",
  "apk_install",
  "qr_login",
  "qr_payment",
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
  /(apk|установ(и|ите).{0,30}прилож|install.{0,30}(app|apk)|ilova.{0,20}o['’]rnating)/i;
const PAYMENT_RE =
  /(предоплат|оплатите|оплата|переведите|перевод|to['’]?lov|pul o['’]?tkaz|payment|transfer|deposit|fee|комисс|карта|karta|uzcard|humo)/i;
const QR_LOGIN_RE =
  /(вход\s+по\s+qr|быстрый\s+вход\s+по\s+qr|qr.{0,80}(войти|вход|авториз|аккаунт|подтверд|вериф|login|sign\s?in|account|verify|confirm|auth(?:enticat(?:e|ion|or))?|2fa|mfa|device|устройств|подключ|сесс|tasdiq|kiring|hisob)|(?:войти|вход|login|sign\s?in|confirm|verify|подтверд|авториз|подключ|устройств|направьте\s+камер).{0,80}qr|двухфакторн.{0,100}qr|authentication\s+app.{0,100}qr|(?:authentication|authenticator|2fa|mfa|sign\s?in|login|device).{0,100}scan.{0,40}qr|подключить\s+устройство|настройки\s*>\s*устройства\s*>\s*подключить\s*устройство)/i;
const QR_PAYMENT_RE =
  /(qr.{0,40}(оплат|перевод|payment|transfer|to['’]?lov|pul|karta|card)|(?:оплат|payment|transfer|to['’]?lov).{0,40}qr)/i;
const URGENCY_RE = /(срочно|немедленно|прямо сейчас|urgent|immediately|hozir|darhol|tezda)/i;
const BRAND_RE =
  /(банк|central bank|markaziy bank|kapitalbank|uzcard|humo|payme|click|uzum|ucell|beeline|mobiuz|uzmobile|gov|my\.gov)/i;
const TELEGRAM_POST_RE =
  /(@[a-z0-9_]{3,}|t\.me\/|telegram\.me\/|telegram|канал|подпис|subscribe|join|button|кнопк|перейти|открыть канал|open channel|комментар|reactions?|реакци|просмотр|views?|бот|mini\s?app)/i;
const TELEGRAM_PRIVATE_INVITE_RE = /\b(?:https?:\/\/)?(?:t\.me|telegram\.me)\/\+[a-z0-9_-]+/i;
const BETTING_PROMO_RE =
  /(ставк|ставлю|матч|прогноз|букмек|бетт?инг|казино|азартн|лудоман|luxe\s?bet|luxebet|sport\s?bet|sportsbook|betting|odds|prediction|free pick|stavka|prognoz|bukmeker|kazino)/i;
const BETTING_ACTION_RE =
  /(t\.me\/\+|telegram\.me\/\+|подпис|канал|закрыт|бесплатн|выигр|приз|джекпот|прибыл|доход|vip|subscribe|channel|free|win|profit|guaranteed|obuna|kanal|bepul|yutuq|foyda)/i;
const CASINO_BONUS_RE =
  /(казино|азартн|слот|слоты|фри\s?спин|фриспин|free\s?spins?|casino|slots?|no\s?kyc|no\s?limits?|без\s?kyc|без\s+регистрации|twin|tonplay|luxe\s?bet|luxebet)/i;
const CASINO_ACTION_RE =
  /(депозит|(?:^|[^a-zа-я])деп(?:а|ов)?(?=$|[^a-zа-я])|пополн|бонус|ссылк|перейти|вход на сайт|без vpn|регистрац|запущ|bonus|deposit|top\s?up|link|signup|register|launched|always here|no registration|mini\s?app|telegram app|первые\s+\d+\s+деп)/i;
const GIVEAWAY_CONTEXT_RE =
  /(розыгрыш|разыгр|random\s*nft|nft|банка подарков|подар|приз|giveaway|airdrop|lottery|sovg'a|sovrin|yutuq|stars?|зв[её]зд|ton\s?знаток|tonznatok)/i;
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

function deriveHints(text: string): ImageRiskHint[] {
  const hints: ImageRiskHint[] = [];
  if (SECRET_RE.test(text)) hints.push("otp_or_secret");
  if (APK_RE.test(text)) hints.push("apk_install");
  if (QR_LOGIN_RE.test(text)) hints.push("qr_login");
  if (QR_PAYMENT_RE.test(text)) hints.push("qr_payment");
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

export function fallbackImageIntelligence(text: string | null): ImageIntelligenceResult {
  const redacted = clampText(text ? redactText(text) : null, 2000);
  const source = redacted ?? "";
  const qrPresent = QR_RE.test(source);
  const hints = deriveHints(source);
  const visualCategory = deriveCategory(source, qrPresent, hints);
  return {
    text: redacted,
    visualCategory,
    confidence: source.length > 0 ? "medium" : "low",
    qr: {
      present: qrPresent,
      visibleUrl: source.match(URL_RE)?.[0] ?? null,
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
  const fallback = fallbackImageIntelligence(text);

  const modelHints = Array.isArray(rec.riskHints)
    ? rec.riskHints.filter((h): h is ImageRiskHint => RISK_HINTS.includes(h as ImageRiskHint))
    : [];
  const riskHints = uniqueHints([...modelHints, ...fallback.riskHints]);

  const qrObj = rec.qr && typeof rec.qr === "object" ? (rec.qr as Record<string, unknown>) : {};
  const qrPresent = typeof qrObj.present === "boolean" ? qrObj.present : fallback.qr.present;
  const visibleUrl = asString(qrObj.visibleUrl) ?? fallback.qr.visibleUrl;
  const qrPurpose = pickEnum(qrObj.purpose, QR_PURPOSES, deriveQrPurpose(text ?? "", riskHints));
  const visualCategory = pickEnum(
    rec.visualCategory,
    CATEGORIES,
    deriveCategory(text ?? "", qrPresent, riskHints),
  );
  const rawSummary = asString(rec.summary);
  const summary = sanitizeAiExplanation(clampText(rawSummary ? redactText(rawSummary) : null, 320));

  return {
    text,
    visualCategory,
    confidence: pickEnum(rec.confidence, CONFIDENCES, fallback.confidence),
    qr: {
      present: qrPresent,
      visibleUrl: visibleUrl ? redactText(visibleUrl).slice(0, 500) : null,
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
    ["delivery_sms", "restaurant_menu_qr", "qr_menu_or_info"].includes(evidence.visualCategory)
  );
}

function dangerousHintText(hint: ImageRiskHint): string {
  switch (hint) {
    case "otp_or_secret":
      return "Просят SMS-код подтверждения, PIN, CVV или пароль.";
    case "apk_install":
      return "Просят установить APK или подозрительное приложение.";
    case "qr_login":
      return "Просят отсканировать QR-код, чтобы войти или подтвердить аккаунт.";
    case "qr_payment":
      return "Просят отсканировать QR-код для оплаты или перевода.";
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
      return "Есть invite-ссылка в закрытый Telegram-канал или группу.";
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
    } else {
      lines.push("Контекст изображения: похоже на информационный плакат.");
    }
    lines.push(...decodedLines);
    return lines.join("\n").slice(0, 2000);
  }

  if (evidence.text) lines.push(evidence.text);
  if (evidence.qr.visibleUrl)
    lines.push(`Видимый адрес из QR/изображения: ${evidence.qr.visibleUrl}`);
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

  const decodedValues = [
    ...new Set(decoded.values.map((value) => redactText(value).slice(0, 500))),
  ];
  const decodedText = decodedValues.map((value) => `Decoded QR URL/value: ${value}`).join("\n");
  const combinedText = clampText([evidence.text, decodedText].filter(Boolean).join("\n"), 2000);
  const combinedForHints = [combinedText, decoded.urls.join("\n")].filter(Boolean).join("\n");
  const riskHints = uniqueHints([...evidence.riskHints, ...deriveHints(combinedForHints)]);
  const qrPurpose =
    evidence.qr.purpose !== "unknown"
      ? evidence.qr.purpose
      : deriveQrPurpose(combinedForHints, riskHints);
  const derivedCategory = deriveCategory(combinedForHints, true, riskHints);
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
      visibleUrl: evidence.qr.visibleUrl ?? decoded.urls[0] ?? null,
      purpose: qrPurpose,
      decodedValues,
    },
  };
}

function scenarioImageExplanation(evidence: ImageIntelligenceResult, lang: Lang): string | null {
  const hints = new Set(evidence.riskHints);
  const category = evidence.visualCategory;

  if (hints.has("qr_login") || evidence.qr.purpose === "login") {
    if (lang === "uz") {
      return "Bu QR kirish, qurilma ulash yoki 2FA tasdiqlash ekraniga o‘xshaydi. Begona odam yuborgan QRni skanerlamang: u Telegram, bank yoki boshqa akkauntga sessiya ochishi mumkin. QRni faqat o‘zingiz rasmiy ilova yoki saytda ochganingizda skanerlang.";
    }
    if (lang === "en") {
      return "This looks like a QR login, device-linking, or 2FA confirmation screen. Do not scan a QR sent by another person: it can open a session into Telegram, a bank, or another account. Scan QR codes only when you opened them yourself in the official app or website.";
    }
    return "Похоже на QR для входа, подключения устройства или 2FA. Не сканируйте QR, который прислал другой человек: так можно открыть сессию в Telegram, банке или другом аккаунте. Сканируйте QR только если вы сами открыли его в официальном приложении или на сайте.";
  }

  if (hints.has("qr_payment") || evidence.qr.purpose === "payment") {
    if (lang === "uz") {
      return "Bu QR to‘lov yoki pul o‘tkazish uchun ishlatilayotganga o‘xshaydi. Chat, reklama yoki qo‘ng‘iroqdan kelgan QR orqali pul yubormang. Xizmat yoki bank ilovasini o‘zingiz oching va manzil/rekvizitni tekshiring.";
    }
    if (lang === "en") {
      return "This looks like a QR for payment or transfer. Do not pay through a QR sent in a chat, ad, or call. Open the official bank/service app yourself and verify the recipient or page address there.";
    }
    return "Похоже на QR для оплаты или перевода. Не платите по QR из чата, рекламы или звонка. Откройте официальное приложение банка/сервиса сами и проверьте получателя или адрес страницы там.";
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
  const hasDanger =
    evidence.riskHints.length > 0 || level === "high_risk" || level === "suspicious";

  if (lang === "uz") {
    if (!hasDanger && category === "delivery_sms") {
      return "Rasmda yetkazib berish yoki buyurtmani olish haqida SMS ko‘rinadi. Unda to‘lov, SMS-kod, APK yoki karta ma’lumotlarini so‘rash belgisi ko‘rinmayapti. Agar xabarda havola bo‘lsa, uni alohida yuboring.";
    }
    if (!hasDanger && (category === "restaurant_menu_qr" || category === "qr_menu_or_info")) {
      return "Rasm menyu, aksiya yoki ma’lumot beruvchi QRga o‘xshaydi. QRning o‘zi xavf belgisi emas; xavf kod, karta ma’lumoti, login yoki to‘lov so‘ralganda paydo bo‘ladi. QR ochgan sahifa manzilini tekshiring.";
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
      return "The image looks like a menu, promo, or informational QR. A QR code alone is not a scam sign; the risk appears when it asks for a code, card data, login, or payment. Check the page address after opening it.";
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
    return "На изображении похоже меню, акция или информационный QR. Сам QR-код не является признаком скама; риск появляется, если после него просят код, данные карты, вход в аккаунт или оплату. Проверьте адрес страницы после открытия.";
  }
  if (!hasDanger && (category === "telegram_promo_post" || category === "news_or_channel_post")) {
    return "Похоже на Telegram-пост или рекламное объявление. В видимой части я не вижу запроса кода, карты, кошелька, APK, оплаты или срочного давления. Если после кнопки/ссылки попросят личные данные — пришлите следующий экран или ссылку отдельно.";
  }
  const scenario = scenarioImageExplanation(evidence, lang);
  if (scenario) return scenario;
  if (evidence.summary) return evidence.summary;
  return "Я проверил видимый текст и контекст изображения. Если там просят код, данные карты, APK или перевод денег — остановитесь и проверьте через официальный канал.";
}
