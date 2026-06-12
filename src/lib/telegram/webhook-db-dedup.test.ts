import process from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dispatchCalls: 0,
  claimResult: "claimed" as "claimed" | "duplicate" | "unavailable",
}));

vi.mock("@/lib/telegram/router", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/router")>();
  return {
    ...actual,
    dispatchUpdate: vi.fn(async () => {
      h.dispatchCalls++;
    }),
  };
});

vi.mock("@/lib/telegram/handlers", () => ({
  installTelegramHandlers: () => {},
}));

vi.mock("@/lib/telegram/webhook-dedup.server", () => ({
  claimTelegramWebhookUpdate: vi.fn(async () => h.claimResult),
}));

import { __resetTelegramWebhookDedupeForTests, handleTelegramWebhook } from "./webhook.server";

const WEBHOOK_URL = "https://example.com/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const ORIG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ORIG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

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
  h.claimResult = "claimed";
  process.env.TELEGRAM_WEBHOOK_SECRET = "secret";
  process.env.TELEGRAM_BOT_TOKEN = "bot-token";
  __resetTelegramWebhookDedupeForTests();
});

afterEach(() => {
  if (ORIG_SECRET === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = ORIG_SECRET;
  if (ORIG_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = ORIG_TOKEN;
  vi.restoreAllMocks();
});

describe("webhook Postgres dedup", () => {
  it("dispatches when the shared dedup claim is new", async () => {
    const response = await handleTelegramWebhook(request(101));

    expect(response.status).toBe(200);
    expect(h.dispatchCalls).toBe(1);
  });

  it("acks but does not dispatch when Postgres already saw the update_id", async () => {
    h.claimResult = "duplicate";

    const response = await handleTelegramWebhook(request(102));

    expect(response.status).toBe(200);
    expect(h.dispatchCalls).toBe(0);
  });

  it("fails open when shared dedup is unavailable", async () => {
    h.claimResult = "unavailable";

    const response = await handleTelegramWebhook(request(103));

    expect(response.status).toBe(200);
    expect(h.dispatchCalls).toBe(1);
  });
});
