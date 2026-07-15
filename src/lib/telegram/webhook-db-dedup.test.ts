import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dispatchCalls: 0,
  dispatchError: null as unknown,
  claimResult: "acquired" as "acquired" | "completed" | "unavailable",
}));

vi.mock("@/lib/telegram/router", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/router")>();
  return {
    ...actual,
    dispatchUpdate: vi.fn(async () => {
      h.dispatchCalls++;
      if (h.dispatchError) throw h.dispatchError;
    }),
  };
});

vi.mock("@/lib/telegram/handlers", () => ({
  installTelegramHandlers: () => {},
}));

vi.mock("@/lib/telegram/update-lifecycle.server", () => ({
  beginTelegramUpdate: vi.fn(async (updateId: number) =>
    h.claimResult === "acquired"
      ? {
          decision: "acquired",
          attemptCount: 1,
          lease: {
            updateId,
            leaseToken: "00000000-0000-4000-8000-000000000001",
            processingFence: 1,
            leaseExpiresAt: "2099-01-01T00:00:00.000Z",
          },
        }
      : h.claimResult === "completed"
        ? { decision: "completed" }
        : { decision: "unavailable", retryAfterSec: 1 },
  ),
  completeTelegramUpdate: vi.fn(async () => true),
  markTelegramUpdateFailure: vi.fn(async () => true),
}));

import { TelegramInlineAnswerDeliveryError } from "./inline-answer-delivery-error";
import {
  __resetTelegramWebhookDedupeForTests,
  executeAndCompleteTelegramUpdate,
  handleTelegramWebhook,
} from "./webhook.server";

const WEBHOOK_URL = "https://example.com/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const ORIG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ORIG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ORIG_DELIVERY_MODE = process.env.TELEGRAM_UPDATE_DELIVERY_MODE;

function request(updateId: number): Request {
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [SECRET_HEADER]: "secret",
    },
    body: JSON.stringify({
      update_id: updateId,
      message: {
        message_id: 1,
        from: { id: 1001, language_code: "ru" },
        chat: { id: 5001 },
        text: "hello",
      },
    }),
  });
}

beforeEach(() => {
  h.dispatchCalls = 0;
  h.dispatchError = null;
  h.claimResult = "acquired";
  process.env.TELEGRAM_WEBHOOK_SECRET = "secret";
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  process.env.TELEGRAM_UPDATE_DELIVERY_MODE = "webhook";
  __resetTelegramWebhookDedupeForTests();
});

afterEach(() => {
  if (ORIG_SECRET === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = ORIG_SECRET;
  if (ORIG_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = ORIG_TOKEN;
  if (ORIG_DELIVERY_MODE === undefined) delete process.env.TELEGRAM_UPDATE_DELIVERY_MODE;
  else process.env.TELEGRAM_UPDATE_DELIVERY_MODE = ORIG_DELIVERY_MODE;
  vi.restoreAllMocks();
});

describe("webhook Postgres dedup", () => {
  it("dispatches when the shared dedup claim is new", async () => {
    const response = await handleTelegramWebhook(request(101));

    expect(response.status).toBe(200);
    expect(h.dispatchCalls).toBe(1);
  });

  it("acks but does not dispatch when Postgres already saw the update_id", async () => {
    h.claimResult = "completed";

    const response = await handleTelegramWebhook(request(102));

    expect(response.status).toBe(200);
    expect(h.dispatchCalls).toBe(0);
  });

  it("fails closed with a retry response when shared dedup is unavailable", async () => {
    h.claimResult = "unavailable";

    const response = await handleTelegramWebhook(request(103));

    expect(response.status).toBe(503);
    expect(h.dispatchCalls).toBe(0);
  });

  it("does not poison local dedup when a shared dedup outage is retried successfully", async () => {
    h.claimResult = "unavailable";

    const failed = await handleTelegramWebhook(request(104));
    expect(failed.status).toBe(503);
    expect(h.dispatchCalls).toBe(0);

    h.claimResult = "acquired";
    const retried = await handleTelegramWebhook(request(104));

    expect(retried.status).toBe(200);
    expect(h.dispatchCalls).toBe(1);
  });

  it("keeps authenticated webhook deliveries retryable after polling cutover", async () => {
    process.env.TELEGRAM_UPDATE_DELIVERY_MODE = "polling";

    const response = await handleTelegramWebhook(request(105));

    expect(response.status).toBe(503);
    expect(h.dispatchCalls).toBe(0);
  });

  it("preserves a sanitized Inline delivery delay for the polling caller", async () => {
    const deliveryError = new TelegramInlineAnswerDeliveryError(17_000);
    h.dispatchError = deliveryError;

    await expect(
      executeAndCompleteTelegramUpdate(
        {
          update_id: 106,
          inline_query: {
            id: "inline-106",
            from: { id: 1001, first_name: "Test", language_code: "ru" },
            query: "private query that must not be logged",
          },
        },
        {
          updateId: 106,
          leaseToken: "00000000-0000-4000-8000-000000000106",
          processingFence: 1,
          leaseExpiresAt: "2099-01-01T00:00:00.000Z",
        },
      ),
    ).rejects.toBe(deliveryError);

    expect(deliveryError.retryAfterMs).toBe(17_000);
  });
});
