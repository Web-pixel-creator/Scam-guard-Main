export type TelegramDeliveryMode = "webhook" | "polling";

export function parseTelegramDeliveryMode(value: string | null | undefined): TelegramDeliveryMode {
  const normalized = value?.trim().toLowerCase() || "webhook";
  if (normalized !== "webhook" && normalized !== "polling") {
    throw new Error("TELEGRAM_UPDATE_DELIVERY_MODE must be webhook or polling");
  }
  return normalized;
}

export function expectedAuthenticatedWebhookStatus(mode: TelegramDeliveryMode): number {
  return mode === "webhook" ? 200 : 503;
}

export function telegramDeliveryInfoIsHealthy(input: {
  mode: TelegramDeliveryMode;
  hasWebhookUrl: boolean;
  pendingUpdates: number;
  hasRecentError: boolean;
}): boolean {
  const urlMatchesMode = input.mode === "webhook" ? input.hasWebhookUrl : !input.hasWebhookUrl;
  const errorIsHealthy = input.mode === "polling" || !input.hasRecentError;
  return urlMatchesMode && input.pendingUpdates === 0 && errorIsHealthy;
}
