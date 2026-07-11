import { describe, expect, it } from "vitest";

import {
  hasSafeTelegramWebhookConcurrency,
  TELEGRAM_WEBHOOK_MAX_CONNECTIONS,
} from "./webhook-delivery-policy";

describe("Telegram webhook delivery containment", () => {
  it("pins the pre-lifecycle webhook to one simultaneous connection", () => {
    expect(TELEGRAM_WEBHOOK_MAX_CONNECTIONS).toBe(1);
    expect(hasSafeTelegramWebhookConcurrency(1)).toBe(true);
    expect(hasSafeTelegramWebhookConcurrency(40)).toBe(false);
    expect(hasSafeTelegramWebhookConcurrency(undefined)).toBe(false);
  });
});
