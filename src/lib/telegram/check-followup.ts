import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { RiskLevel } from "@/lib/risk/rules";
import type {
  LastCheckContext,
  LastCheckSnapshot,
  ReportDraft,
} from "@/lib/telegram/session.server";

const RECENT_CHECK_WINDOW_MS = 20 * 60 * 1000;

const CONFIRMATION_RE =
  /^(?:точно|точно\?|а\s+точно|это\s+точно|ты\s+уверен[а]?|уверен[а]?|правда|реально|really|are\s+you\s+sure|is\s+it\s+safe|aniqmi|rostmi)[\s?!.,]*$/i;
const QR_OPEN_RE =
  /(?:можно|безопасно|стоит)\s+(?:открыть|сканировать|перейти).{0,25}qr|qr.{0,25}(?:можно|безопасно|открыть|сканировать|перейти)/i;
const SCAM_PAYLOAD_RE =
  /(?:https?:\/\/|www\.|t\.me\/|@[a-zA-Z0-9_]{3,}|\+?\d[\d\s().-]{6,}\d|sms.?код|otp|cvv|pin|apk|перевед|оплат|карта|bank|банк)/i;

const CRYPTO_CONTEXT_RE =
  /(крипт|биткоин|bitcoin|binance|trading|трейд|инвест|доходн|прибыл|forex|crypto|investment|investits|kripto|daromad|foyda)/i;
const QR_MENU_CONTEXT_RE =
  /(меню|ресторан|кафе|акци[яи]|лояльност|qr.{0,30}(меню|info|информац)|restaurant|menu|promo|loyalty|restoran|aksiya|ma'lumot)/i;
const DELIVERY_CONTEXT_RE =
  /(доставк|заказ|выдач|пункт|курьер|почт|delivery|pickup|order|courier|yetkazib|buyurtma|topshirish)/i;

export type LastCheckFollowUpAction = "confidence";

function isRecent(snapshot: LastCheckSnapshot, now: Date): boolean {
  const at = Date.parse(snapshot.at);
  return Number.isFinite(at) && now.getTime() - at <= RECENT_CHECK_WINDOW_MS;
}

function hasNewerRecentPanicContext(
  scenarioData: ReportDraft | undefined,
  snapshot: LastCheckSnapshot,
  now: Date,
): boolean {
  const panicAt = Date.parse(scenarioData?.lastPanicAt ?? "");
  const checkAt = Date.parse(snapshot.at);
  return (
    Number.isFinite(panicAt) &&
    Number.isFinite(checkAt) &&
    panicAt >= checkAt &&
    now.getTime() - panicAt <= RECENT_CHECK_WINDOW_MS
  );
}

export function detectLastCheckContext(result: RunCheckResult): LastCheckContext {
  const haystack = `${result.type}\n${result.display}\n${result.explanation ?? ""}`;

  if (DELIVERY_CONTEXT_RE.test(haystack)) return "delivery";
  if (QR_MENU_CONTEXT_RE.test(haystack)) return "qr_menu";
  if (CRYPTO_CONTEXT_RE.test(haystack)) return "crypto";
  if (
    result.type === "phone" ||
    result.reasons.includes("valid_uz_phone") ||
    result.reasons.includes("non_uz_phone")
  ) {
    return "phone";
  }
  return "generic";
}

export function buildLastCheckSnapshot(
  result: RunCheckResult,
  now = new Date(),
): LastCheckSnapshot {
  return {
    level: result.level,
    type: result.type,
    context: detectLastCheckContext(result),
    at: now.toISOString(),
  };
}

export function classifyLastCheckFollowUp(
  text: string,
  scenarioData: ReportDraft | undefined,
  now = new Date(),
): LastCheckFollowUpAction | null {
  const trimmed = text.trim();
  if (!trimmed || SCAM_PAYLOAD_RE.test(trimmed)) return null;

  const snapshot = scenarioData?.lastCheck;
  if (!snapshot || !isRecent(snapshot, now)) return null;
  if (hasNewerRecentPanicContext(scenarioData, snapshot, now)) return null;

  if (CONFIRMATION_RE.test(trimmed) || QR_OPEN_RE.test(trimmed)) return "confidence";
  return null;
}

function levelText(level: RiskLevel, lang: Lang): string {
  const dict: Record<RiskLevel, Record<Lang, string>> = {
    safe: {
      ru: "явных опасных признаков не видно",
      uz: "aniq xavf belgisi ko'rinmayapti",
      en: "I do not see obvious danger signs",
    },
    unknown: {
      ru: "точного вывода пока нет",
      uz: "hozircha aniq xulosa yo'q",
      en: "there is not enough evidence for a precise verdict",
    },
    suspicious: {
      ru: "есть подозрительные признаки",
      uz: "shubhali belgilar bor",
      en: "there are suspicious signs",
    },
    high_risk: {
      ru: "риск высокий",
      uz: "xavf yuqori",
      en: "the risk is high",
    },
  };
  return dict[level][lang];
}

export function buildLastCheckFollowUpText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "qr_menu") {
      return `Aniq kafolat bera olmayman. Ko'rinib turgan rasm bo'yicha ${levelText(snapshot.level, lang)}: bu menyu yoki ma'lumot beruvchi QRga o'xshaydi.\n\nQRni ochsangiz, sahifa manzilini tekshiring. SMS-kod, karta ma'lumoti, login yoki to'lov so'ralsa — to'xtang va keyingi ekran skrinini yuboring.`;
    }
    if (snapshot.context === "delivery") {
      return `Aniq kafolat emas, lekin ko'rinib turgan ma'lumot bo'yicha ${levelText(snapshot.level, lang)}.\n\nHavola, to'lov, APK yoki kod so'rovi paydo bo'lsa — uni alohida yuboring.`;
    }
    if (snapshot.context === "phone") {
      return `Raqamning o'zi yakuniy dalil emas: ${levelText(snapshot.level, lang)}.\n\nAgar suhbatda kod, pul, karta yoki ilova so'ralgan bo'lsa, nima deyishganini qisqacha yozing.`;
    }
    return `100% kafolat emas: men faqat ko'rinib turgan belgilarni tekshiraman. Hozirgi natija bo'yicha ${levelText(snapshot.level, lang)}.\n\nAgar kod, karta, APK, login yoki to'lov so'ralsa — to'xtang va shu xabarni yuboring.`;
  }

  if (lang === "en") {
    if (snapshot.context === "qr_menu") {
      return `I cannot guarantee it 100%. Based on the visible screenshot, ${levelText(snapshot.level, lang)}: it looks like a menu or informational QR.\n\nIf you open it, check the page address. If it asks for an SMS code, card data, login, or payment, stop and send me the next screen.`;
    }
    if (snapshot.context === "delivery") {
      return `Not a 100% guarantee, but from the visible details ${levelText(snapshot.level, lang)}.\n\nIf a link, payment, APK, or code request appears, send that separately.`;
    }
    if (snapshot.context === "phone") {
      return `The number alone is not final proof: ${levelText(snapshot.level, lang)}.\n\nIf the caller asked for a code, money, card data, or an app, briefly describe the call.`;
    }
    return `Not a 100% guarantee: I check only visible risk signs. In the previous result, ${levelText(snapshot.level, lang)}.\n\nIf someone asks for a code, card data, APK, login, or payment, stop and send that message.`;
  }

  if (snapshot.context === "qr_menu") {
    return `Не могу гарантировать на 100%. По видимому скриншоту ${levelText(snapshot.level, lang)}: это похоже на меню или информационный QR.\n\nЕсли открываете QR — проверьте адрес страницы. Если попросят SMS-код, карту, логин или оплату, остановитесь и пришлите следующий экран.`;
  }
  if (snapshot.context === "delivery") {
    return `Это не 100% гарантия, но по видимым данным ${levelText(snapshot.level, lang)}.\n\nЕсли появится ссылка, оплата, APK или просьба назвать код — пришлите это отдельно.`;
  }
  if (snapshot.context === "phone") {
    return `Сам номер не даёт 100% вывода: ${levelText(snapshot.level, lang)}.\n\nЕсли в разговоре просили код, деньги, данные карты или приложение — кратко опишите, что именно сказали.`;
  }
  return `Это не 100% гарантия: я проверяю только видимые признаки. По прошлой проверке ${levelText(snapshot.level, lang)}.\n\nЕсли просят код, карту, APK, логин или оплату — остановитесь и пришлите это сообщение.`;
}
