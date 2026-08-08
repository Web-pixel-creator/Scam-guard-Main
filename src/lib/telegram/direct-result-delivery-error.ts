const DEFAULT_DIRECT_DELIVERY_RETRY_MS = 2_000;
const MIN_DIRECT_DELIVERY_RETRY_MS = 1_000;
const MAX_DIRECT_DELIVERY_RETRY_MS = 60_000;

function boundedRetryMs(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    return DEFAULT_DIRECT_DELIVERY_RETRY_MS;
  }
  return Math.min(
    MAX_DIRECT_DELIVERY_RETRY_MS,
    Math.max(MIN_DIRECT_DELIVERY_RETRY_MS, value as number),
  );
}

export function directDeliveryRetryMsFromSeconds(retryAfterSec: number | undefined): number {
  if (!Number.isSafeInteger(retryAfterSec) || (retryAfterSec ?? 0) <= 0) {
    return DEFAULT_DIRECT_DELIVERY_RETRY_MS;
  }
  const boundedSeconds = Math.min(MAX_DIRECT_DELIVERY_RETRY_MS / 1_000, retryAfterSec as number);
  return boundedRetryMs(boundedSeconds * 1_000);
}

/**
 * Sanitized control-flow error for a definitely-undelivered, retryable Direct
 * result. It intentionally carries no chat, message, Bot API description or
 * token. Ambiguous and permanent outcomes must never use this error.
 */
export class TelegramDirectResultDeliveryError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs = DEFAULT_DIRECT_DELIVERY_RETRY_MS) {
    super("telegram_direct_result_transient");
    this.name = "TelegramDirectResultDeliveryError";
    this.retryAfterMs = boundedRetryMs(retryAfterMs);
  }
}

export function directDeliveryRetryAfterMs(error: unknown): number | null {
  return error instanceof TelegramDirectResultDeliveryError ? error.retryAfterMs : null;
}
