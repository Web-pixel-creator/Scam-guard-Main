import { getPublicAppUrl } from "@/lib/config.server";
import { type InputType, redactText } from "@/lib/risk/detect";
import {
  getTrendSeverityRank,
  PUBLIC_SCHEME_TRENDS,
  type PublicSchemeTrend,
  type SchemeTrendCategory,
  type SchemeTrendSeverity,
  type SchemeTrendSource,
} from "@/lib/trust/scheme-trends";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

type ModerationNoticeKind = "report" | "appeal" | "research" | "smoke";

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

export interface ModerationResearchItem {
  id: string;
  category: SchemeTrendCategory;
  severity: SchemeTrendSeverity;
  source: SchemeTrendSource;
  title: string;
  reasonCodes: readonly string[];
}

export interface ModerationResearchNotice {
  kind: "research";
  items: readonly ModerationResearchItem[];
  generatedAt?: string | null;
}

export interface ModerationSmokeNotice {
  kind: "smoke";
  label?: string | null;
}

export type ModerationNotice =
  | ModerationReportNotice
  | ModerationAppealNotice
  | ModerationResearchNotice
  | ModerationSmokeNotice;

const MAX_FIELD = 80;
const MAX_TARGET = 64;
const MAX_RESEARCH_ITEMS = 5;
const SENSITIVE_URL_RE = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
const TELEGRAM_INVITE_RE = /\b(?:t\.me|telegram\.me)\/\+[A-Za-z0-9_-]+/gi;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{16,}\b/g;
const HIGH_SIGNAL_SOURCES = new Set<SchemeTrendSource>(["research_feed", "moderated_aggregate"]);
const HIGH_SIGNAL_SEVERITIES = new Set<SchemeTrendSeverity>(["critical", "high"]);

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
  if (notice.kind === "research") return "research-items";
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

function toResearchItem(trend: PublicSchemeTrend): ModerationResearchItem {
  return {
    id: trend.id,
    category: trend.category,
    severity: trend.severity,
    source: trend.source,
    title: trend.title.ru,
    reasonCodes: trend.reasonCodes,
  };
}

export function buildHighSignalResearchModerationNotice(
  options: { limit?: number; generatedAt?: Date } = {},
): ModerationResearchNotice {
  const limit = Math.min(
    Math.max(1, Math.floor(options.limit ?? MAX_RESEARCH_ITEMS)),
    MAX_RESEARCH_ITEMS,
  );
  const items = PUBLIC_SCHEME_TRENDS.filter((trend) => trend.status === "active_watch")
    .filter((trend) => HIGH_SIGNAL_SOURCES.has(trend.source))
    .filter((trend) => HIGH_SIGNAL_SEVERITIES.has(trend.severity))
    .sort((a, b) => {
      const severityDiff = getTrendSeverityRank(b.severity) - getTrendSeverityRank(a.severity);
      if (severityDiff !== 0) return severityDiff;
      return a.id.localeCompare(b.id);
    })
    .slice(0, limit)
    .map(toResearchItem);

  return {
    kind: "research",
    items,
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
  };
}

function formatResearchItem(item: ModerationResearchItem, index: number): string {
  const codes = item.reasonCodes
    .map((code) => scrub(code, 40))
    .slice(0, 4)
    .join(", ");
  return [
    `${index + 1}. ${scrub(item.title, 72)}`,
    `   • id: ${scrub(item.id, 48)}`,
    `   • severity/source: ${item.severity} / ${item.source}`,
    `   • category: ${item.category}`,
    `   • reason codes: ${codes || "not mapped"}`,
  ].join("\n");
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

  if (notice.kind === "research") {
    const items = notice.items.slice(0, MAX_RESEARCH_ITEMS);
    const generated = notice.generatedAt ? scrub(notice.generatedAt, 32) : "not specified";
    const itemLines =
      items.length > 0
        ? items.map((item, index) => formatResearchItem(item, index)).join("\n\n")
        : "Нет high-signal research items для отправки.";

    return [
      "🛡 Ishonch Guard: research items на модерацию",
      "Служебное уведомление для модераторов.",
      "",
      `Сформировано: ${generated}`,
      "",
      "📌 Что проверить",
      itemLines,
      "",
      "🔐 Граница приватности",
      "Это сводка по уже публичным/курируемым категориям. Здесь нет сырых постов, жалоб, OCR, скриншотов, кодов, карт, полных номеров, URL или user ids.",
      "",
      "Что делать: проверьте wording и решите, нужно ли переводить тему в правила, дайджест или публичную educational-карточку.",
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

export async function notifyHighSignalResearchModeration(
  options: { limit?: number } = {},
): Promise<{ ok: boolean }> {
  return notifyModeration(buildHighSignalResearchModerationNotice(options));
}
