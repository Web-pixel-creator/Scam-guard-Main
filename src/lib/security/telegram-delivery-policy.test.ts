import { describe, expect, it } from "vitest";
import {
  expectedAuthenticatedWebhookStatus,
  parseTelegramDeliveryMode,
  telegramDeliveryInfoIsHealthy,
} from "./telegram-delivery-policy";

describe("Telegram delivery policy", () => {
  it("defaults to webhook and rejects unknown modes", () => {
    expect(parseTelegramDeliveryMode(undefined)).toBe("webhook");
    expect(parseTelegramDeliveryMode(" POLLING ")).toBe("polling");
    expect(() => parseTelegramDeliveryMode("hybrid")).toThrow(
      "TELEGRAM_UPDATE_DELIVERY_MODE must be webhook or polling",
    );
  });

  it("expects authenticated webhook shutdown in polling mode", () => {
    expect(expectedAuthenticatedWebhookStatus("webhook")).toBe(200);
    expect(expectedAuthenticatedWebhookStatus("polling")).toBe(503);
  });

  it("accepts only delivery state matching the configured mode", () => {
    expect(
      telegramDeliveryInfoIsHealthy({
        mode: "polling",
        hasWebhookUrl: false,
        pendingUpdates: 0,
        hasRecentError: false,
      }),
    ).toBe(true);
    expect(
      telegramDeliveryInfoIsHealthy({
        mode: "polling",
        hasWebhookUrl: true,
        pendingUpdates: 0,
        hasRecentError: false,
      }),
    ).toBe(false);
    expect(
      telegramDeliveryInfoIsHealthy({
        mode: "webhook",
        hasWebhookUrl: true,
        pendingUpdates: 1,
        hasRecentError: false,
      }),
    ).toBe(false);
  });
});
