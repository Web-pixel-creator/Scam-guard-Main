import { bt } from "@/lib/telegram/bot-i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

export const REPORT_SKIP_CALLBACK = "report_skip";
export const REPORT_NO_VALUE_CALLBACK = "report_no_value";
export const REPORT_RETRY_CALLBACK = "report_retry";
/** Keep report buttons aligned with the bot's other short-lived conversation context. */
export const REPORT_CALLBACK_BINDING_TTL_MS = 20 * 60 * 1000;

export type ReportCallbackAction =
  | typeof REPORT_SKIP_CALLBACK
  | typeof REPORT_NO_VALUE_CALLBACK
  | typeof REPORT_RETRY_CALLBACK;

export type ReportCallbackScenario =
  | "report_value"
  | "report_scamType"
  | "report_city"
  | "report_amount";

export interface ReportCallbackBinding {
  messageId: number;
  action: ReportCallbackAction;
  scenario: ReportCallbackScenario;
  at: string;
}

interface ReportCallbackData {
  reportCallbackBinding?: ReportCallbackBinding;
}

function parseReportCallbackBindingTime(value: string): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  // Bindings are written with Date#toISOString. Reject permissive Date.parse
  // inputs (for example "0" or a date without a time) instead of guessing.
  return new Date(timestamp).toISOString() === value ? timestamp : null;
}

/**
 * Attach a report action to the exact Telegram prompt that exposed it.
 * Only enum metadata and a Telegram message id are stored; report evidence is
 * never copied into the binding.
 */
export function withReportCallbackBinding<T extends object>(
  data: T,
  messageId: number,
  action: ReportCallbackAction,
  scenario: ReportCallbackScenario,
  now: Date = new Date(),
): T & ReportCallbackData {
  return {
    ...data,
    reportCallbackBinding: {
      messageId,
      action,
      scenario,
      at: now.toISOString(),
    },
  };
}

export function withoutReportCallbackBinding<T extends ReportCallbackData>(data: T): T {
  const clean = { ...data };
  delete clean.reportCallbackBinding;
  return clean;
}

/** Fail closed for missing, malformed, stale, or cross-step callbacks. */
export function matchesReportCallbackBinding(
  data: unknown,
  messageId: number | undefined,
  action: ReportCallbackAction,
  scenario: ReportCallbackScenario,
  now: Date = new Date(),
): boolean {
  if (messageId === undefined || !Number.isSafeInteger(messageId) || messageId <= 0) return false;
  if (!data || typeof data !== "object") return false;

  const binding = (data as ReportCallbackData).reportCallbackBinding;
  if (
    !binding ||
    binding.messageId !== messageId ||
    binding.action !== action ||
    binding.scenario !== scenario ||
    typeof binding.at !== "string"
  ) {
    return false;
  }

  const boundAt = parseReportCallbackBindingTime(binding.at);
  const nowMs = now.getTime();
  if (boundAt === null || !Number.isFinite(nowMs)) return false;

  const ageMs = nowMs - boundAt;
  return ageMs >= 0 && ageMs <= REPORT_CALLBACK_BINDING_TTL_MS;
}

export function reportValueKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_report_no_value", lang), callback_data: REPORT_NO_VALUE_CALLBACK }]];
}

export function reportSkipKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_skip", lang), callback_data: REPORT_SKIP_CALLBACK }]];
}

export function reportRetryKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_report_retry", lang), callback_data: REPORT_RETRY_CALLBACK }]];
}
