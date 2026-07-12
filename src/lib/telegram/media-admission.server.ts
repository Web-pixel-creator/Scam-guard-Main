import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";

const IMAGE_DOWNLOAD_RATE_LIMIT = 10;
const IMAGE_DOWNLOAD_RATE_WINDOW_MS = 60_000;

export function telegramImageDownloadBudgetKey(userId: number): string {
  return `telegram-image:tg:${userId}`;
}

/**
 * Claims the shared Telegram image-download budget before any Bot API metadata
 * lookup or body download. The later OCR/check budget remains a separate tier.
 */
export async function claimTelegramImageDownloadBudget(userId: number): Promise<void> {
  const result = await checkSharedRateLimit(
    "check",
    telegramImageDownloadBudgetKey(userId),
    IMAGE_DOWNLOAD_RATE_LIMIT,
    IMAGE_DOWNLOAD_RATE_WINDOW_MS,
  );
  if (result.ok) return;

  const error = new Error("rate_limited") as Error & { status: 429; retryAfter: number };
  error.status = 429;
  error.retryAfter = result.retryAfterSec;
  throw error;
}
