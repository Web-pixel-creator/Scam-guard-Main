import { getPublicAppUrl } from "@/lib/config.server";
import { type InputType, redactText } from "@/lib/risk/detect";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

type ModerationNoticeKind = "report" | "appeal" | "smoke";

export interface ModerationReportNotice {
  kind: "report";
  entityType: InputType;
  redactedValue: string;
  scamType?: string | null;
  city?: string | null;
  amountLostUzs?: number | null;
  language: Lang;
  incidentOnly?: boolean;
  duplicateOfExisting?: boolean;
}

export interface ModerationAppealNotice {
  kind: "appeal";
  targetType: InputType;
  targetDisplay: string;
  language: Lang;
}

export interface ModerationSmokeNotice {
  kind: "smoke";
  label?: string | null;
}

export type ModerationNotice =
  | ModerationReportNotice
  | ModerationAppealNotice
  | ModerationSmokeNotice;

const MAX_FIELD = 80;
const MAX_TARGET = 64;
const SENSITIVE_URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
const TELEGRAM_INVITE_RE = /\b(?:t\.me|telegram\.me)\/\+[A-Za-z0-9_-]+/gi;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{16,}\b/g;

function getModerationChatId(): number | null {
  const raw = process.env.TELEGRAM_MODERATION_CHAT_ID?.trim();
  if (!raw) return null;

  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function scrub(value: string, max = MAX_FIELD): string {
  const redacted = redactText(value)
    .replace(SENSITIVE_URL_RE, "[link]")
    .replace(TELEGRAM_INVITE_RE, "[telegram invite]")
    .replace(LONG_TOKEN_RE, "[token]")
    .replace(/\s+/g, " ")
    .trim();
  if (redacted.length <= max) return redacted;
  return `${redacted.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function targetLabel(notice: ModerationNotice): string {
  if (notice.kind === "smoke") return "smoke-test";
  if (notice.kind === "appeal") {
    return `${notice.targetType}: ${scrub(notice.targetDisplay, MAX_TARGET)}`;
  }
  if (notice.incidentOnly) return "incident-only: no public target";
  return `${notice.entityType}: ${scrub(notice.redactedValue, MAX_TARGET)}`;
}

function formatAmount(value?: number | null): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "не указан";
  return `${Math.round(value).toLocaleString("en-US")} UZS`;
}

export function formatModerationNoticeForTelegram(notice: ModerationNotice): string {
  if (notice.kind === "smoke") {
    return [
      "Ishonch Guard: moderation alert smoke test",
      "",
      `Label: ${scrub(notice.label ?? "manual operator check")}`,
      "",
      "No user report, screenshot, OCR, code, card data, phone number or URL was sent.",
    ].join("\n");
  }

  if (notice.kind === "appeal") {
    return [
      "🛡 Ishonch Guard: новая апелляция",
      "Служебное уведомление для модераторов.",
      "",
      "📌 Что проверить",
      `• Объект: ${targetLabel(notice)}`,
      `• Язык: ${notice.language}`,
      "",
      "🔐 Где смотреть детали",
      "Решение, статус и история цели доступны в админке после входа.",
      "",
      "Не пересылайте сюда коды, карты, пароли, скриншоты или полные контакты.",
    ].join("\n");
  }

  const lines = [
    notice.duplicateOfExisting
      ? "🛡 Ishonch Guard: повторный сигнал"
      : "🛡 Ishonch Guard: новая жалоба",
    "Служебное уведомление для модераторов.",
    "",
    "📌 Что проверить",
    `• Объект: ${targetLabel(notice)}`,
    `• Тип схемы: ${scrub(notice.scamType ?? "не указан")}`,
    `• Город: ${scrub(notice.city ?? "не указан")}`,
    `• Ущерб: ${formatAmount(notice.amountLostUzs)}`,
    `• Язык: ${notice.language}`,
    "",
    notice.duplicateOfExisting
      ? "ℹ️ На эту цель уже жаловались сегодня. Повторный сигнал учтён и повышает приоритет проверки, но отдельная публичная запись не создана."
      : null,
    notice.duplicateOfExisting ? "" : null,
    "🔐 Почему номер/username скрыт",
    "В этот Telegram-чат уходит только маска и краткая сводка. Полный номер/username, решение и история цели доступны в админке после входа.",
    "",
    "Не пересылайте сюда коды, карты, пароли, скриншоты или полные контакты.",
  ].filter((line): line is string => line !== null);
  return lines.join("\n");
}

function moderationKeyboard(): InlineKeyboard {
  return [[{ text: "Открыть админку", url: `${getPublicAppUrl()}/admin` }]];
}

export async function notifyModeration(notice: ModerationNotice): Promise<{ ok: boolean }> {
  const chatId = getModerationChatId();
  if (chatId === null) return { ok: false };

  try {
    return await sendMessage({
      chatId,
      text: escapeMarkdownV2(formatModerationNoticeForTelegram(notice)),
      keyboard: moderationKeyboard(),
      disablePreview: true,
    });
  } catch (e) {
    console.error("moderation notification failed", e instanceof Error ? e.message : "unknown");
    return { ok: false };
  }
}
