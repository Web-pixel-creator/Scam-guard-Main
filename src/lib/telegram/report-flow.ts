import { bt } from "@/lib/telegram/bot-i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import type { Lang } from "@/lib/i18n";

export const REPORT_SKIP_CALLBACK = "report_skip";
export const REPORT_NO_VALUE_CALLBACK = "report_no_value";
export const REPORT_RETRY_CALLBACK = "report_retry";

export function reportValueKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_report_no_value", lang), callback_data: REPORT_NO_VALUE_CALLBACK }]];
}

export function reportSkipKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_skip", lang), callback_data: REPORT_SKIP_CALLBACK }]];
}

export function reportRetryKeyboard(lang: Lang): InlineKeyboard {
  return [[{ text: bt("btn_report_retry", lang), callback_data: REPORT_RETRY_CALLBACK }]];
}
