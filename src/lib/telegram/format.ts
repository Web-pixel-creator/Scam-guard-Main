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
//   "check_another"  → prompt for new content to check (btn «Проверить ещё»)
//   "emergency"      → send the emergency checklist (btn «Я уже отправил…»)
//   "lang:ru" | "lang:uz" | "lang:en" → switch Language (welcome buttons)
// These exact strings are exported as CB below for reuse by the router.

import { bt } from "@/lib/telegram/bot-i18n";
import {
  escapeMarkdownV2,
  type InlineButton,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import { t, type Lang } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type RiskLevel } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";

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

/** Стабильные callback_data строки (см. контракт выше; используются роутером). */
export const CB = {
  report: "report",
  checkAnother: "check_another",
  emergency: "emergency",
  why: "why",
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

/**
 * Формат ответа проверки (порядок блоков — из дизайна):
 *  1) эмодзи + локализованная метка уровня (t risk_*),
 *  2) блок объяснения ТОЛЬКО если explanation !== null (R13.3),
 *  3) список REASON_LABELS[reason][lang] (R4.4),
 *  4) ADVICE[level][lang] — ВСЕГДА присутствует, даже без AI (R13.1, R13.2),
 *  5) knownReports>0 → строка о подтверждённых жалобах (R4.11),
 *  6) кнопки Report / Check another; при high_risk доп. кнопка Emergency (R20.3).
 * Гарантия: текст использует только result.display (маскированное) — никогда
 * сырой ввод (R7.5).
 */
export function formatCheckResult(result: RunCheckResult, lang: Lang): FormattedResult {
  const parts: string[] = [];

  // 1) эмодзи + метка уровня (метка — пользовательская строка, экранируем).
  const levelLabel = t(RISK_LABEL_KEY[result.level], lang);
  parts.push(
    `${RISK_EMOJI[result.level]} ${bold(escapeMarkdownV2(levelLabel))}\n${escapeMarkdownV2("━━━━━━━━━━━━━━━━━━━━")}`,
  );

  // 1b) Verified contact badge + spoofing warning (D-011).
  if (result.verifiedContact) {
    const orgName = result.verifiedContact.orgName;
    // If level is still high_risk/suspicious despite the match → dangerous behavior detected.
    if (result.level === "high_risk" || result.level === "suspicious") {
      parts.push(escapeMarkdownV2(bt("verified_with_danger", lang, { org: orgName })));
    } else {
      parts.push(escapeMarkdownV2(bt("verified_match", lang, { org: orgName })));
      parts.push(escapeMarkdownV2(bt("verified_spoofing_warning", lang)));
    }
  }
  if (result.explanation !== null) {
    const title = t("ai_explanation", lang);
    parts.push(`${bold(escapeMarkdownV2(title))}\n${escapeMarkdownV2(result.explanation)}`);
  }

  // 3) список обнаруженных reason-кодов через REASON_LABELS (R4.4).
  const reasonLines = result.reasons
    .map((code) => REASON_LABELS[code]?.[lang])
    .filter((label): label is string => Boolean(label));
  if (reasonLines.length > 0) {
    const whyTitle = t("why_title", lang);
    const list = reasonLines.map((label) => `• ${escapeMarkdownV2(label)}`).join("\n");
    parts.push(`${bold(escapeMarkdownV2(whyTitle))}\n${list}`);
  }

  // 4) ADVICE — ВСЕГДА присутствует, даже при explanation === null (R13.1, R13.2).
  const adviceTitle = t("what_to_do", lang);
  const adviceItems = ADVICE[result.level][lang];
  const adviceList = adviceItems.map((item) => `• ${escapeMarkdownV2(item)}`).join("\n");
  parts.push(`${bold(escapeMarkdownV2(adviceTitle))}\n${adviceList}`);

  // 5) подтверждённые жалобы — только если knownReports > 0 (R4.11).
  if (result.knownReports > 0) {
    parts.push(escapeMarkdownV2(bt("known_reports", lang, { count: result.knownReports })));
  }

  return {
    text: parts.join("\n\n"), // blocks separated by double newline; visual separators added inline
    keyboard: buildResultKeyboard(result.level, lang),
  };
}

/** Кнопки результата: Report / Check another, + Emergency при high_risk (R4.6, R20.3). */
function buildResultKeyboard(level: RiskLevel, lang: Lang): InlineKeyboard {
  const row: InlineButton[] = [
    { text: bt("btn_report", lang), callback_data: CB.report },
    { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
  ];
  const keyboard: InlineKeyboard = [row, [{ text: bt("btn_why", lang), callback_data: CB.why }]];
  if (level === "high_risk") {
    keyboard.push([{ text: bt("btn_emergency", lang), callback_data: CB.emergency }]);
  }
  return keyboard;
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
    [
      { text: bt("btn_lang_ru", lang), callback_data: CB.lang("ru") },
      { text: bt("btn_lang_uz", lang), callback_data: CB.lang("uz") },
      { text: bt("btn_lang_en", lang), callback_data: CB.lang("en") },
    ],
    [
      { text: "\u{1F50D} " + bt("btn_quick_check", lang), callback_data: CB.checkAnother },
      { text: "\u{1F4E2} " + bt("btn_quick_report", lang), callback_data: CB.report },
    ],
    [{ text: "\u{1F198} " + bt("btn_quick_panic", lang), callback_data: CB.emergency }],
  ];
  return {
    text: escapeMarkdownV2(bt("welcome", lang)),
    keyboard,
  };
}
