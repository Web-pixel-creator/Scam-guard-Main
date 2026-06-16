// Telegram response formatter (Ishonch Guard bot).
//
// Builds the MarkdownV2 reply text and inline keyboards for the bot channel,
// localised to the user's Language. Pure module — no I/O, no secrets.
//
// Contract: design.md → "Components and Interfaces → 6. Форматтер результата".
//
// Privacy guarantee (R7.5): only `result.display` (already masked via
// `maskForDisplay`) is ever rendered — never the raw user input.
//
// MarkdownV2 safety (R8.1): ALL user-facing strings are escaped via
// `escapeMarkdownV2` BEFORE any markup (bold `*`, emoji, list markers) is added,
// so the markup we add intentionally is never broken by user content.
//
// ── callback_data contract (consumed by the router, task 8.x) ───────────────
//   "report"         → start the /report scenario (btn «Сообщить»)
//   "check_another"  → prompt for new content to check (btn «Новая проверка»)
//   "emergency"      → send the emergency checklist (btn «Я уже отправил…»)
//   "lang:ru" | "lang:uz" | "lang:en" → switch Language (welcome buttons)
// These exact strings are exported as CB below for reuse by the router.

import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import {
  escapeMarkdownV2,
  type InlineButton,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import { t, type Lang } from "@/lib/i18n";
import { REASON_LABELS, type RiskLevel } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { PhoneReputationConfidence } from "@/lib/risk/phone-reputation";
import { findMatchingPatterns } from "@/lib/scam-patterns";
import {
  TEMPLATES,
  SECTION_EMOJI,
  SECTION_TITLE_KEY,
  type SectionId,
} from "@/lib/telegram/templates";
import { truncateExplanation } from "@/lib/telegram/truncate";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { buildAskedContextKeyboardRows } from "@/lib/telegram/check-context-buttons";

/** Эмодзи-индикатор уровня риска (R4.5). */
export const RISK_EMOJI: Record<RiskLevel, string> = {
  safe: "🟢",
  unknown: "⚪️",
  suspicious: "🟠",
  high_risk: "🔴",
};

/**
 * Маппинг RiskLevel → ключ метки уровня в i18n (`t_dict`).
 * ВНИМАНИЕ: `high_risk` соответствует ключу `risk_high` (не `risk_high_risk`).
 */
const RISK_LABEL_KEY: Record<
  RiskLevel,
  "risk_safe" | "risk_unknown" | "risk_suspicious" | "risk_high"
> = {
  safe: "risk_safe",
  unknown: "risk_unknown",
  suspicious: "risk_suspicious",
  high_risk: "risk_high",
};

/** Verdict line key per risk level. */
const VERDICT_KEY: Record<RiskLevel, BotStringKey> = {
  safe: "verdict_safe",
  unknown: "verdict_unknown",
  suspicious: "verdict_suspicious",
  high_risk: "verdict_high_risk",
};

/** Стабильные callback_data строки (см. контракт выше; используются роутером). */
export const CB = {
  report: "report",
  checkAnother: "check_another",
  emergency: "emergency",
  why: "why",
  showLang: "show_lang",
  safety: "safety",
  howItWorks: "how_it_works",
  digest: "digest",
  mediaTips: "media_tips",
  familyMenu: "family:menu",
  notifyTrusted: "family:notify",
  lang: (lang: Lang) => `lang:${lang}` as const,
} as const;

export interface FormattedResult {
  text: string; // MarkdownV2, экранированный
  keyboard: InlineKeyboard; // Report / Check another / (Emergency при high_risk)
}

/** MarkdownV2-жирный поверх уже экранированного текста. */
function bold(escaped: string): string {
  return `*${escaped}*`;
}

/** Thin separator between sections (MarkdownV2-escaped). */
const THIN_SEPARATOR = escapeMarkdownV2("┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈");

/** Telegram message character limit. */
const TELEGRAM_MAX_CHARS = 4096;

type NeutralContext = "crypto" | "qr_menu" | "delivery" | "phone" | "telegram_profile";

const NEUTRAL_CONTEXT_BRIEF_KEY: Record<NeutralContext, BotStringKey> = {
  crypto: "brief_unknown_crypto",
  qr_menu: "brief_unknown_qr_menu",
  delivery: "brief_unknown_delivery",
  phone: "brief_unknown_phone",
  telegram_profile: "brief_unknown_telegram_profile",
};

const NEUTRAL_CONTEXT_PROMPT_KEY: Record<NeutralContext, BotStringKey> = {
  crypto: "prompt_more_context_crypto",
  qr_menu: "prompt_more_context_qr_menu",
  delivery: "prompt_more_context_delivery",
  phone: "prompt_more_context_phone",
  telegram_profile: "prompt_more_context_telegram_profile",
};

const CRYPTO_CONTEXT_RE =
  /(крипт|биткоин|bitcoin|binance|trading|трейд|инвест|доходн|прибыл|forex|crypto|investment|investits|kripto|daromad|foyda)/i;
const QR_MENU_CONTEXT_RE =
  /(меню|ресторан|кафе|акци[яи]|лояльност|qr.{0,30}(меню|info|информац)|restaurant|menu|promo|loyalty|restoran|aksiya|ma'lumot)/i;
const DELIVERY_CONTEXT_RE =
  /(доставк|заказ|выдач|пункт|курьер|почт|delivery|pickup|order|courier|yetkazib|buyurtma|topshirish)/i;
const TOPIC_ONLY_OBSERVATION_REASONS = new Set([
  "unknown_sender",
  "new_telegram_account",
  "hosted_app_platform",
  "valid_uz_phone",
  "non_uz_phone",
]);

function detectNeutralContext(result: RunCheckResult): NeutralContext | null {
  if (result.level !== "unknown" && result.level !== "safe") return null;
  if (result.verifiedContact) return null;

  const haystack = `${result.type}\n${result.display}\n${result.explanation ?? ""}`;

  if (DELIVERY_CONTEXT_RE.test(haystack)) return "delivery";
  if (QR_MENU_CONTEXT_RE.test(haystack)) return "qr_menu";
  if (CRYPTO_CONTEXT_RE.test(haystack)) return "crypto";
  if (
    result.phoneIntelligence ||
    result.type === "phone" ||
    result.reasons.includes("valid_uz_phone") ||
    result.reasons.includes("non_uz_phone")
  ) {
    return "phone";
  }
  if (result.type === "telegram") return "telegram_profile";

  return null;
}

function renderPhonePassportBrief(result: RunCheckResult, lang: Lang): string | null {
  const passport = result.phoneIntelligence;
  if (!passport) return null;

  const copy: Record<
    Lang,
    {
      number: string;
      unknownCountry: string;
      officialNotFound: string;
      foreignCallback: string;
      weakFormat: string;
      contextMatters: string;
      lookalike: (org: string, contact: string) => string;
      lookalikeCallback: string;
    }
  > = {
    ru: {
      number: "Номер",
      unknownCountry: "страну/оператора определить надёжно не удалось",
      officialNotFound: "В официальном справочнике Ishonch Guard совпадения нет.",
      foreignCallback:
        "Это не узбекский номер. Если представляются банком/службой Узбекистана — положите трубку и перезвоните сами.",
      weakFormat: "Формат номера выглядит неполным или необычным.",
      contextMatters:
        "Сам номер не доказывает мошенничество: важнее, просили ли SMS-код, карту, перевод, APK или QR-вход.",
      lookalike: (org, contact) =>
        `Похож на официальный контакт, но не совпадает: ${org} — ${contact}.`,
      lookalikeCallback:
        "Безопасный шаг: не перезванивайте по входящему номеру; используйте приложение, карту, официальный сайт или проверенный контакт.",
    },
    uz: {
      number: "Raqam",
      unknownCountry: "mamlakat/operatorni ishonchli aniqlab bo'lmadi",
      officialNotFound: "Ishonch Guard rasmiy ma'lumotnomasida moslik topilmadi.",
      foreignCallback:
        "Bu O'zbekiston raqami emas. Agar o'zini bank/xizmat deb tanishtirsa — qo'ng'iroqni tugating va rasmiy raqamga o'zingiz qo'ng'iroq qiling.",
      weakFormat: "Raqam formati to'liq emas yoki noodatiy ko'rinadi.",
      contextMatters:
        "Raqamning o'zi firibgarlikni isbotlamaydi: SMS-kod, karta, pul o'tkazma, APK yoki QR-login so'ralganmi — shu muhim.",
      lookalike: (org, contact) =>
        `Rasmiy kontaktga o'xshaydi, lekin aniq mos emas: ${org} — ${contact}.`,
      lookalikeCallback:
        "Xavfsiz qadam: kiruvchi raqamga qayta qo'ng'iroq qilmang; ilova, karta, rasmiy sayt yoki tekshirilgan kontaktdan foydalaning.",
    },
    en: {
      number: "Number",
      unknownCountry: "country/operator could not be identified reliably",
      officialNotFound: "No match in the Ishonch Guard official directory.",
      foreignCallback:
        "This is not an Uzbek number. If they claim to be an Uzbek bank/service, hang up and call back yourself.",
      weakFormat: "The number format looks incomplete or unusual.",
      contextMatters:
        "The number alone does not prove a scam; what matters is whether they ask for an SMS code, card, transfer, APK, or QR login.",
      lookalike: (org, contact) =>
        `Looks similar to an official contact, but it is not an exact match: ${org} — ${contact}.`,
      lookalikeCallback:
        "Safe step: do not call back via the incoming number; use the app, card, official site, or the verified contact.",
    },
  };

  const c = copy[lang];
  const labels: Record<
    Lang,
    {
      passport: string;
      region: string;
      directory: string;
      reputation: string;
      meaning: string;
      reports: (count: number) => string;
      foreignWarning: string;
      weakWarning: string;
    }
  > = {
    ru: {
      passport: "📋 Паспорт номера",
      region: "🌍 Страна и оператор",
      directory: "🏛 Справочник",
      reputation: "🛡 Репутация Ishonch",
      meaning: "📌 Что это значит",
      reports: (count) =>
        count === 0 ? "0 подтвержд. жалоб" : `${count} подтвержд. жалоб — оценивайте осторожнее`,
      foreignWarning: "🚩 Важно",
      weakWarning: "⚠️ Формат",
    },
    uz: {
      passport: "📋 Raqam pasporti",
      region: "🌍 Mamlakat va operator",
      directory: "🏛 Ma'lumotnoma",
      reputation: "🛡 Ishonch reputatsiyasi",
      meaning: "📌 Bu nimani bildiradi",
      reports: (count) =>
        count === 0
          ? "0 tasdiqlangan shikoyat"
          : `${count} tasdiqlangan shikoyat — ehtiyotroq baholang`,
      foreignWarning: "🚩 Muhim",
      weakWarning: "⚠️ Format",
    },
    en: {
      passport: "📋 Number passport",
      region: "🌍 Country and operator",
      directory: "🏛 Directory",
      reputation: "🛡 Ishonch reputation",
      meaning: "📌 What this means",
      reports: (count) =>
        count === 0 ? "0 confirmed reports" : `${count} confirmed reports — use extra caution`,
      foreignWarning: "🚩 Important",
      weakWarning: "⚠️ Format",
    },
  };
  const l = labels[lang];
  const country = passport.country
    ? `${passport.country.name[lang]} (+${passport.country.callingCode})`
    : c.unknownCountry;
  const operator = passport.uzOperator?.[lang];
  const reportCount = result.phoneReputation?.confirmedReportCount ?? result.knownReports ?? 0;
  const lines: string[] = [l.passport, "", l.region];

  lines.push(`• ${c.number}: ${country}`);
  if (operator) lines.push(`• ${operator}`);

  if (!passport.isValidFormat) {
    lines.push("", l.weakWarning);
    lines.push(c.weakFormat);
  } else if (passport.country && !passport.isUzbekistan) {
    lines.push("", l.foreignWarning);
    lines.push(c.foreignCallback);
  } else if (passport.officialLookalike) {
    lines.push("", l.directory);
    lines.push(
      c.lookalike(passport.officialLookalike.org[lang], passport.officialLookalike.display),
    );
    lines.push(c.lookalikeCallback);
  } else if (passport.officialDirectoryStatus === "not_found") {
    lines.push("", l.directory);
    lines.push(c.officialNotFound);
  }

  lines.push("", l.reputation);
  lines.push(`• ${l.reports(reportCount)}`);
  lines.push("", l.meaning);
  lines.push(c.contextMatters);
  return lines.join("\n");
}

function phoneReputationConfidenceLabel(confidence: PhoneReputationConfidence, lang: Lang): string {
  const labels: Record<PhoneReputationConfidence, Record<Lang, string>> = {
    low: { ru: "низкая", uz: "past", en: "low" },
    medium: { ru: "средняя", uz: "o'rtacha", en: "medium" },
    high: { ru: "высокая", uz: "yuqori", en: "high" },
  };
  return labels[confidence][lang];
}

function renderPhoneReputationObservation(result: RunCheckResult, lang: Lang): string | null {
  const reputation = result.phoneReputation;
  if (!reputation) return null;

  const summary = bt("phone_reputation_reports", lang, {
    count: reputation.confirmedReportCount,
    confidence: phoneReputationConfidenceLabel(reputation.confidence, lang),
  });
  const limit = bt("phone_reputation_limit", lang);
  return escapeMarkdownV2(`${summary} ${limit}`);
}

// ── Section Sub-Renderers ───────────────────────────────────────────────────

type RiskPassportKind = "phone" | "telegram";

const RISK_PASSPORT_TITLE: Record<RiskPassportKind, Record<Lang, string>> = {
  phone: {
    ru: "📋 Паспорт номера",
    uz: "📋 Raqam pasporti",
    en: "📋 Number passport",
  },
  telegram: {
    ru: "📋 Telegram-паспорт",
    uz: "📋 Telegram pasporti",
    en: "📋 Telegram passport",
  },
};

function detectRiskPassportKind(result: RunCheckResult): RiskPassportKind | null {
  if (result.level !== "unknown") return null;

  const neutralContext = detectNeutralContext(result);
  if (neutralContext === "phone") return "phone";
  if (neutralContext === "telegram_profile") return "telegram";
  return null;
}

function renderRiskPassportHeader(kind: RiskPassportKind, lang: Lang): string {
  const title = RISK_PASSPORT_TITLE[kind][lang];
  return `${bold(escapeMarkdownV2(title))}\n${escapeMarkdownV2("━━━━━━━━━━━━━━━━━━━━")}`;
}

function passportBodyAlreadyAsksForContext(body: string): boolean {
  return /(?:пришл(?:ите|и)|отправ(?:ьте|ь)|сообщени[ея]\/скрин|скрин(?:шот)?|что просят|yuboring|nima so'rashgan|send|send me|send the|what they ask)/iu.test(
    body,
  );
}

function renderRiskPassport(result: RunCheckResult, lang: Lang): string | null {
  const kind = detectRiskPassportKind(result);
  if (!kind) return null;

  const body =
    kind === "phone"
      ? (renderPhonePassportBrief(result, lang) ?? bt("brief_unknown_phone", lang))
      : truncateExplanation(result.explanation ?? bt("brief_unknown_telegram_profile", lang), {
          maxLines: 18,
          maxChars: 1400,
        });
  const prompt =
    kind === "phone"
      ? bt("prompt_more_context_phone", lang)
      : bt("prompt_more_context_telegram_profile", lang);

  const sections = [escapeMarkdownV2(body)];
  if (!passportBodyAlreadyAsksForContext(body)) {
    sections.push(escapeMarkdownV2(prompt));
  }

  return applyOverflowProtection(renderRiskPassportHeader(kind, lang), sections);
}

/**
 * Renders the risk header: emoji + bold label + thick separator + verified badge.
 */
function renderRiskHeader(result: RunCheckResult, lang: Lang): string {
  const parts: string[] = [];

  const levelLabel = t(RISK_LABEL_KEY[result.level], lang);
  parts.push(
    `${RISK_EMOJI[result.level]} ${bold(escapeMarkdownV2(levelLabel))}\n${escapeMarkdownV2("━━━━━━━━━━━━━━━━━━━━")}`,
  );

  // Verified contact badge (D-011).
  if (result.verifiedContact) {
    const contact = result.verifiedContact;
    const orgName = contact.orgName;
    const levelKey: BotStringKey =
      contact.verificationLevel === "high" ? "verified_level_high" : "verified_level_medium";
    if (result.level === "high_risk" || result.level === "suspicious") {
      parts.push(escapeMarkdownV2(bt("verified_with_danger", lang, { org: orgName })));
    } else {
      parts.push(escapeMarkdownV2(bt("verified_match", lang, { org: orgName })));
      parts.push(
        escapeMarkdownV2(
          bt("verified_directory_details", lang, {
            contact: contact.display,
            description: contact.description,
            level: bt(levelKey, lang),
          }),
        ),
      );
      parts.push(escapeMarkdownV2(bt("verified_spoofing_warning", lang)));
    }
  }

  return parts.join("\n\n");
}

/**
 * Renders the verdict line from bot_dict.
 */
function renderVerdict(result: RunCheckResult, lang: Lang): string {
  const verdictText = bt(VERDICT_KEY[result.level], lang);
  return escapeMarkdownV2(verdictText);
}

/**
 * Renders the brief AI explanation section (uses truncateExplanation).
 * Returns empty string if no explanation is available.
 */
function renderBrief(result: RunCheckResult, lang: Lang): string {
  let content: string;
  const neutralContext = detectNeutralContext(result);
  const hasForwardSourceBrief = isForwardSourceBrief(result.explanation);
  const hasDecodedQrBrief = isDecodedQrEvidenceBrief(result.explanation);
  const truncateOptions = hasForwardSourceBrief
    ? { maxLines: 6, maxChars: 380 }
    : result.type === "telegram"
      ? { maxLines: 16, maxChars: 1100 }
      : result.level === "unknown"
        ? { maxLines: 3, maxChars: 190 }
        : { maxLines: 4, maxChars: 230 };

  if (
    neutralContext &&
    !(neutralContext === "telegram_profile" && result.explanation !== null) &&
    !(neutralContext === "qr_menu" && hasDecodedQrBrief)
  ) {
    content =
      neutralContext === "phone"
        ? (renderPhonePassportBrief(result, lang) ??
          bt(NEUTRAL_CONTEXT_BRIEF_KEY[neutralContext], lang))
        : bt(NEUTRAL_CONTEXT_BRIEF_KEY[neutralContext], lang);
  } else if (result.explanation === null && result.reasons.includes("hosted_app_platform")) {
    content = truncateExplanation(bt("hosted_platform_explanation", lang), truncateOptions);
  } else if (result.explanation !== null) {
    content = truncateExplanation(result.explanation, truncateOptions);
  } else {
    return "";
  }

  return formatSectionBlock("brief", lang, escapeMarkdownV2(content));
}

function isForwardSourceBrief(explanation: string | null): explanation is string {
  if (!explanation) return false;
  return /^(Источник: Telegram-|Source: Telegram |Manba: Telegram )/u.test(explanation);
}

function isDecodedQrEvidenceBrief(explanation: string | null): explanation is string {
  if (!explanation) return false;
  return /QR (?:прочитан|decoded|o['’]qildi)/iu.test(explanation);
}

/**
 * Renders reason labels as a bullet list (max 3 items).
 */
function renderReasons(result: RunCheckResult, lang: Lang): string {
  const reasonLines = result.reasons
    .map((code) => REASON_LABELS[code]?.[lang])
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);

  if (reasonLines.length === 0) return "";

  const list = reasonLines.map((label) => `• ${escapeMarkdownV2(label)}`).join("\n");
  return formatSectionBlock("reasons", lang, list);
}

/**
 * Renders context-aware advice as a bullet list (max 3 items).
 */
function renderAdvice(result: RunCheckResult, lang: Lang): string {
  let adviceItems = filterAdvice(result.level, result.reasons, lang);

  if (
    adviceItems.length === 0 &&
    result.level === "safe" &&
    detectNeutralContext(result) === "phone"
  ) {
    adviceItems = [bt("prompt_more_context_phone", lang)];
  }

  if (adviceItems.length === 0) return "";

  const list = adviceItems
    .slice(0, 3)
    .map((item) => `• ${escapeMarkdownV2(item)}`)
    .join("\n");
  return formatSectionBlock("safe_steps", lang, list);
}

/**
 * Renders the "what was noticed" section — reason labels + scam patterns.
 */
function renderWhatNoticed(result: RunCheckResult, lang: Lang): string {
  const explanation = result.explanation;
  if (result.level === "high_risk" && isForwardSourceBrief(explanation)) {
    const content = truncateExplanation(explanation, { maxLines: 5, maxChars: 420 });
    return formatSectionBlock("what_noticed", lang, escapeMarkdownV2(content));
  }

  const parts: string[] = [];
  const observableReasons =
    result.level === "unknown"
      ? result.reasons.filter((code) => !TOPIC_ONLY_OBSERVATION_REASONS.has(code))
      : result.reasons;

  if (
    result.level === "high_risk" &&
    result.reasons.includes("asks_to_scan_qr") &&
    isDecodedQrEvidenceBrief(explanation)
  ) {
    parts.push(escapeMarkdownV2(truncateExplanation(explanation, { maxLines: 4, maxChars: 320 })));
  }

  // Reason labels
  const reasonLines = observableReasons
    .map((code) => REASON_LABELS[code]?.[lang])
    .filter((label): label is string => Boolean(label))
    .slice(0, 3);
  if (reasonLines.length > 0) {
    parts.push(...reasonLines.map((label) => `• ${escapeMarkdownV2(label)}`));
  }

  // Matching scam patterns
  const matchingPatterns = findMatchingPatterns(observableReasons);
  if (matchingPatterns.length > 0) {
    matchingPatterns.slice(0, 3).forEach((p) => {
      parts.push(`• ${escapeMarkdownV2(p.title[lang])}`);
    });
  }

  // Known reports
  const phoneReputationLine = renderPhoneReputationObservation(result, lang);
  if (phoneReputationLine) {
    parts.push(phoneReputationLine);
  } else if (result.knownReports > 0) {
    parts.push(escapeMarkdownV2(bt("known_reports", lang, { count: result.knownReports })));
  }

  if (parts.length === 0) return "";

  // Limit combined to 3 lines
  const content = parts.slice(0, 3).join("\n");
  return formatSectionBlock("what_noticed", lang, content);
}

/**
 * Renders the "why dangerous" section for high_risk level.
 */
function renderWhyDangerous(result: RunCheckResult, lang: Lang): string {
  const parts: string[] = [];

  if (result.type === "telegram" && result.explanation !== null) {
    const truncated = truncateExplanation(
      result.explanation,
      isForwardSourceBrief(result.explanation)
        ? { maxLines: 6, maxChars: 380 }
        : { maxLines: 4, maxChars: 340 },
    );
    parts.push(escapeMarkdownV2(truncated));
  }

  // Reason labels
  const reasonLines = result.reasons
    .map((code) => REASON_LABELS[code]?.[lang])
    .filter((label): label is string => Boolean(label))
    .slice(0, result.type === "telegram" ? 2 : 3);
  if (reasonLines.length > 0) {
    parts.push(...reasonLines.map((label) => `• ${escapeMarkdownV2(label)}`));
  }

  // Explanation as supplementary context
  if (result.type !== "telegram" && result.explanation !== null) {
    const truncated = truncateExplanation(
      result.explanation,
      isForwardSourceBrief(result.explanation) ? { maxLines: 6, maxChars: 380 } : undefined,
    );
    parts.push(escapeMarkdownV2(truncated));
  }

  if (parts.length === 0) return "";

  const content = parts.join("\n");
  return formatSectionBlock("why_dangerous", lang, content);
}

/**
 * Renders the "where to report" section.
 */
function renderWhereReport(result: RunCheckResult, lang: Lang): string {
  // Reporting instructions (static, trilingual)
  const reportInstructions: Record<Lang, string[]> = {
    ru: [
      "Сохраните скриншоты переписки",
      "Подайте заявление: Cyber Police — 102",
      "Заблокируйте контакт",
    ],
    uz: [
      "Yozishmalar skrinshotini saqlang",
      "Ariza bering: Cyber Police — 102",
      "Kontaktni bloklang",
    ],
    en: ["Save chat screenshots", "File a report: Cyber Police — 102", "Block the contact"],
  };

  const items = reportInstructions[lang].slice(0, 3);
  const list = items.map((item) => `• ${escapeMarkdownV2(item)}`).join("\n");
  return formatSectionBlock("where_report", lang, list);
}

/**
 * Renders the "send more context" prompt for unknown level.
 */
function renderMoreContext(result: RunCheckResult, lang: Lang): string {
  const neutralContext = detectNeutralContext(result);
  const content = neutralContext
    ? bt(NEUTRAL_CONTEXT_PROMPT_KEY[neutralContext], lang)
    : bt("prompt_more_context", lang);
  return escapeMarkdownV2(content);
}

/**
 * Renders the "action now" section for high_risk — urgent steps.
 */
function renderActionNow(result: RunCheckResult, lang: Lang): string {
  const adviceItems = filterAdvice(result.level, result.reasons, lang);

  // Fallback to generic urgent steps if no specific advice
  const items =
    adviceItems.length > 0 ? adviceItems.slice(0, 3) : [bt("advice_send_more_context", lang)];

  const list = items.map((item) => `• ${escapeMarkdownV2(item)}`).join("\n");
  return formatSectionBlock("action_now", lang, list);
}

/**
 * Helper: format a section block with emoji header + bold title + content.
 * If the section has no title key, returns only the content.
 */
function formatSectionBlock(sectionId: SectionId, lang: Lang, content: string): string {
  const emoji = SECTION_EMOJI[sectionId];
  const titleKey = SECTION_TITLE_KEY[sectionId];

  if (!titleKey) {
    // Sections like verdict / more_context_prompt that have no title line
    return content;
  }

  const title = bt(titleKey, lang);
  const header = emoji
    ? `${emoji} ${bold(escapeMarkdownV2(title))}`
    : bold(escapeMarkdownV2(title));

  return `${header}\n${content}`;
}

/**
 * Dispatches to the correct sub-renderer for a given section ID.
 */
function renderSection(sectionId: SectionId, result: RunCheckResult, lang: Lang): string {
  switch (sectionId) {
    case "verdict":
      return renderVerdict(result, lang);
    case "brief":
      return renderBrief(result, lang);
    case "reasons":
      return renderReasons(result, lang);
    case "what_noticed":
      return renderWhatNoticed(result, lang);
    case "action_now":
      return renderActionNow(result, lang);
    case "safe_steps":
      return renderAdvice(result, lang);
    case "why_dangerous":
      return renderWhyDangerous(result, lang);
    case "where_report":
      return renderWhereReport(result, lang);
    case "more_context_prompt":
      return renderMoreContext(result, lang);
    default:
      return "";
  }
}

/**
 * Applies 4096-char overflow protection.
 * Progressively drops trailing sections while keeping:
 * - Risk_Header (always)
 * - Verdict (always — first section in template)
 * - First action section (index 1 in rendered sections, i.e. index 2 in the template)
 */
function applyOverflowProtection(header: string, sections: string[]): string {
  // Always keep header separate; sections[0] is verdict, sections[1] is first action section
  const minKeep = Math.min(2, sections.length); // Keep at least verdict + first action section

  let candidate = joinSections(header, sections);
  if (candidate.length <= TELEGRAM_MAX_CHARS) return candidate;

  // Progressively drop from the end
  let kept = sections.slice();
  while (kept.length > minKeep) {
    kept = kept.slice(0, -1);
    candidate = joinSections(header, kept);
    if (candidate.length <= TELEGRAM_MAX_CHARS) return candidate;
  }

  return candidate;
}

/**
 * Joins risk header + rendered section blocks with thin separators.
 */
function joinSections(header: string, sections: string[]): string {
  const nonEmpty = sections.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) return header;

  const sectionBlock = nonEmpty.join(`\n${THIN_SEPARATOR}\n`);
  return `${header}\n\n${sectionBlock}`;
}

/**
 * Template-driven result formatter (Result Message UX v2).
 *
 * 1. Renders the Risk_Header
 * 2. Looks up TEMPLATES[result.level] for section order
 * 3. For each section in the template, calls the appropriate sub-renderer
 * 4. Filters out empty results
 * 5. Joins with thin separator (┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈)
 * 6. Applies 4096 overflow protection
 * 7. Returns { text, keyboard }
 */
export function formatCheckResult(result: RunCheckResult, lang: Lang): FormattedResult {
  const passportText = renderRiskPassport(result, lang);
  if (passportText) {
    return {
      text: passportText,
      keyboard: buildResultKeyboard(result, lang),
    };
  }

  // Render Risk_Header (always present)
  const header = renderRiskHeader(result, lang);

  // Look up template for this risk level
  const template = TEMPLATES[result.level];

  // Render each section
  const renderedSections = template
    .map((sectionId) => renderSection(sectionId, result, lang))
    .filter((s) => s.length > 0);

  // Apply overflow protection and join with separators
  const text = applyOverflowProtection(header, renderedSections);

  return {
    text,
    keyboard: buildResultKeyboard(result, lang),
  };
}

/** Кнопки результата: Report / Check another, + Emergency при high_risk (R4.6, R20.3). */
function buildResultKeyboard(result: RunCheckResult, lang: Lang): InlineKeyboard {
  const level = result.level;
  const row: InlineButton[] = [
    { text: bt("btn_report", lang), callback_data: CB.report },
    { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
  ];
  const keyboard: InlineKeyboard = [];
  if (shouldAskWhatTheyRequested(result)) {
    keyboard.push(...buildAskedContextKeyboardRows(lang));
  }
  keyboard.push(row, [{ text: bt("btn_why", lang), callback_data: CB.why }]);
  if (level === "high_risk") {
    keyboard.push([
      { text: bt("btn_notify_trusted", lang), callback_data: CB.notifyTrusted },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ]);
  }
  return keyboard;
}

function shouldAskWhatTheyRequested(result: RunCheckResult): boolean {
  if (result.level !== "unknown") return false;
  const context = detectNeutralContext(result);
  return context === "phone" || context === "telegram_profile";
}

import { buildEmergencyText } from "@/lib/telegram/emergency";

/** Трилингвальный чек-лист экстренных шагов (R20). MarkdownV2-экранирован. */
export function formatEmergencyChecklist(lang: Lang): string {
  return escapeMarkdownV2(buildEmergencyText(lang));
}

/** Текст команды /help (R3.1). MarkdownV2-экранирован. */
export function formatHelp(lang: Lang): string {
  return escapeMarkdownV2(bt("help", lang));
}

/** Текст команды /safety (R3.2, R3.3). MarkdownV2-экранирован. */
export function formatSafety(lang: Lang): string {
  return escapeMarkdownV2(bt("safety", lang));
}

/**
 * Приветствие /start: текст + кнопки выбора языка (R1.1, R1.5).
 * callback_data — "lang:ru" / "lang:uz" / "lang:en" (см. CB.lang).
 */
export function formatWelcome(lang: Lang): { text: string; keyboard: InlineKeyboard } {
  const keyboard: InlineKeyboard = [
    [{ text: "\u{1F198} " + bt("btn_quick_panic", lang), callback_data: CB.emergency }],
    [
      { text: "\u{1F50D} " + bt("btn_quick_check", lang), callback_data: CB.checkAnother },
      { text: "\u{1F46A} " + bt("btn_quick_family", lang), callback_data: CB.familyMenu },
    ],
    [
      { text: "\u{1F4F0} " + bt("btn_quick_digest", lang), callback_data: CB.digest },
      { text: "\u{1F4E2} " + bt("btn_quick_report", lang), callback_data: CB.report },
    ],
    [
      { text: "\u{1F6E1} " + bt("btn_quick_safety", lang), callback_data: CB.safety },
      { text: "\u{2753} " + bt("btn_quick_how", lang), callback_data: CB.howItWorks },
    ],
    [{ text: "\u{1F310} " + bt("btn_quick_lang", lang), callback_data: CB.showLang }],
  ];
  return {
    text: escapeMarkdownV2(bt("welcome", lang)),
    keyboard,
  };
}
