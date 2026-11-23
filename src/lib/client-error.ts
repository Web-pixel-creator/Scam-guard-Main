import { t, type Lang } from "@/lib/i18n";

const CHECK_UNAVAILABLE: Record<Lang, string> = {
  ru: "Проверка временно недоступна. Попробуйте ещё раз через минуту или воспользуйтесь Telegram-ботом.",
  uz: "Tekshiruv vaqtincha ishlamayapti. Bir daqiqadan keyin qayta urinib ko‘ring yoki Telegram botdan foydalaning.",
  en: "Checking is temporarily unavailable. Try again in a minute or use the Telegram bot.",
};

// No connection is a different situation from a broken server: say so, and
// that the typed text is still there.
const OFFLINE: Record<Lang, string> = {
  ru: "Нет подключения к интернету. Проверьте связь и отправьте ещё раз — введённый текст сохранён.",
  uz: "Internetga ulanish yo‘q. Aloqani tekshirib, qayta yuboring — kiritgan matningiz saqlangan.",
  en: "No internet connection. Check it and send again — what you typed is still here.",
};

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function offlineMessage(lang: Lang): string {
  return OFFLINE[lang];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
}

export type SafeClientErrorReason = "rate_limited" | "unavailable";

export function safeClientErrorReason(error: unknown): SafeClientErrorReason {
  const msg = getErrorMessage(error).toLowerCase();
  if (msg.includes("rate_limited") || msg.includes("429")) return "rate_limited";

  return "unavailable";
}

export function safeCheckErrorMessage(error: unknown, lang: Lang): string {
  if (isOffline()) return OFFLINE[lang];
  if (safeClientErrorReason(error) === "rate_limited") return t("rate_limited", lang);

  return CHECK_UNAVAILABLE[lang];
}
