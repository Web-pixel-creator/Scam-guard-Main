// Telegram may open up to 40 webhook connections by default. Until the bot has
// a durable processing/ordering lifecycle (D-070 / SG-P1-009), keep delivery
// globally serialized as a containment measure. This limits concurrency; it is
// not documented by Telegram as a strict ordering or crash-recovery guarantee.
export const TELEGRAM_WEBHOOK_MAX_CONNECTIONS = 1;

export function hasSafeTelegramWebhookConcurrency(value: unknown): boolean {
  return value === TELEGRAM_WEBHOOK_MAX_CONNECTIONS;
}
