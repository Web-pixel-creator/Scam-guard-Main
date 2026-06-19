import { getPublicAppUrl } from "@/lib/config.server";
import { type InputType, redactText } from "@/lib/risk/detect";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

type ModerationNoticeKind = "report" | "appeal";

export interface ModerationReportNotice {
  kind: "report";
  entityType: InputType;
  redactedValue: string;
  scamType?: string | null;
  city?: string | null;
  amountLostUzs?: number | null;
  language: Lang;
  incidentOnly?: boolean;
}

export interface ModerationAppealNotice {
  kind: "appeal";
  targetType: InputType;
  targetDisplay: string;
  language: Lang;
}

export type ModerationNotice = ModerationReportNotice | ModerationAppealNotice;

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
  if (notice.kind === "appeal") {
    return `${notice.targetType}: ${scrub(notice.targetDisplay, MAX_TARGET)}`;
  }
  if (notice.incidentOnly) return "incident-only: no public target";
  return `${notice.entityType}: ${scrub(notice.redactedValue, MAX_TARGET)}`;
}

function formatAmount(value?: number | null): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "not specified";
  return `${Math.round(value).toLocaleString("en-US")} UZS`;
}

export function formatModerationNoticeForTelegram(notice: ModerationNotice): string {
  if (notice.kind === "appeal") {
    return [
      "Ishonch Guard: new reputation appeal",
      "",
      `Target: ${targetLabel(notice)}`,
      `Language: ${notice.language}`,
      "",
      "Open the admin panel to review the redacted request.",
    ].join("\n");
  }

  const lines = [
    "Ishonch Guard: new user report",
    "",
    `Target: ${targetLabel(notice)}`,
    `Type: ${scrub(notice.scamType ?? "not specified")}`,
    `City: ${scrub(notice.city ?? "not specified")}`,
    `Loss: ${formatAmount(notice.amountLostUzs)}`,
    `Language: ${notice.language}`,
    "",
    "Raw text, screenshots, codes, full numbers and URLs are not sent here.",
  ];
  return lines.join("\n");
}

function moderationKeyboard(): InlineKeyboard {
  return [[{ text: "Open admin", url: `${getPublicAppUrl()}/admin` }]];
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
