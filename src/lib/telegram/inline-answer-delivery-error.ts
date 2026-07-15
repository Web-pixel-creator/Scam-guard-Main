const DEFAULT_INLINE_DELIVERY_RETRY_MS = 2_000;
const MIN_INLINE_DELIVERY_RETRY_MS = 1_000;
const MAX_INLINE_DELIVERY_RETRY_MS = 60_000;

function boundedRetryMs(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) {
    return DEFAULT_INLINE_DELIVERY_RETRY_MS;
  }
  return Math.min(
    MAX_INLINE_DELIVERY_RETRY_MS,
    Math.max(MIN_INLINE_DELIVERY_RETRY_MS, value as number),
  );
}

export function inlineDeliveryRetryMsFromSeconds(retryAfterSec: number | undefined): number {
  if (!Number.isSafeInteger(retryAfterSec) || (retryAfterSec ?? 0) <= 0) {
    return DEFAULT_INLINE_DELIVERY_RETRY_MS;
  }
  const boundedSeconds = Math.min(MAX_INLINE_DELIVERY_RETRY_MS / 1_000, retryAfterSec as number);
  return boundedRetryMs(boundedSeconds * 1_000);
}

/**
 * Sanitized control-flow error for a retryable Inline answer delivery.
 * It intentionally carries no query, result, Bot API description or token.
 */
export class TelegramInlineAnswerDeliveryError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs = DEFAULT_INLINE_DELIVERY_RETRY_MS) {
    super("telegram_inline_answer_transient");
    this.name = "TelegramInlineAnswerDeliveryError";
    this.retryAfterMs = boundedRetryMs(retryAfterMs);
  }
}

export function inlineDeliveryRetryAfterMs(error: unknown): number | null {
  return error instanceof TelegramInlineAnswerDeliveryError ? error.retryAfterMs : null;
}
