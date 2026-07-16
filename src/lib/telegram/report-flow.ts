import { bt } from "@/lib/telegram/bot-i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

export const REPORT_SKIP_CALLBACK = "report_skip";
export const REPORT_NO_VALUE_CALLBACK = "report_no_value";
export const REPORT_RETRY_CALLBACK = "report_retry";

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
): T & ReportCallbackData {
  return {
    ...data,
    reportCallbackBinding: {
      messageId,
      action,
      scenario,
      at: new Date().toISOString(),
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
): boolean {
  if (messageId === undefined || !Number.isSafeInteger(messageId) || messageId <= 0) return false;
  if (!data || typeof data !== "object") return false;

  const binding = (data as ReportCallbackData).reportCallbackBinding;
  return Boolean(
    binding &&
    binding.messageId === messageId &&
    binding.action === action &&
    binding.scenario === scenario &&
    typeof binding.at === "string",
  );
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
