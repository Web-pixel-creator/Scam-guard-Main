import { describe, expect, it, vi } from "vitest";
import { createTelegramQaFetchGuard } from "./qa-fetch-guard.server";

const TOKEN = "123456:qa_test_token";
const QA_CHAT_ID = 12345;

function telegramResponse(messageId = 77): Response {
  return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("production Telegram QA fetch guard", () => {
  it("forwards non-Telegram requests unchanged", async () => {
    const originalFetch = vi.fn(async () => new Response("ok"));
    const guard = createTelegramQaFetchGuard({
      botToken: TOKEN,
      qaChatId: QA_CHAT_ID,
      originalFetch: originalFetch as typeof fetch,
    });

    const response = await guard.fetch("https://example.com/health");

    expect(response.status).toBe(200);
    expect(originalFetch).toHaveBeenCalledOnce();
    expect(guard.violations).toEqual([]);
  });

  it("allows and records sendMessage only for the configured QA chat", async () => {
    const originalFetch = vi.fn(async () => telegramResponse(91));
    const guard = createTelegramQaFetchGuard({
      botToken: TOKEN,
      qaChatId: QA_CHAT_ID,
      originalFetch: originalFetch as typeof fetch,
    });

    const response = await guard.fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: QA_CHAT_ID, text: "QA reply", parse_mode: "MarkdownV2" }),
    });

    expect(response.status).toBe(200);
    expect(originalFetch).toHaveBeenCalledOnce();
    expect(guard.violations).toEqual([]);
    expect(guard.messages).toEqual([
      {
        method: "sendMessage",
        text: "QA reply",
        parseMode: "MarkdownV2",
        responseOk: true,
        messageId: 91,
      },
    ]);
  });

  it("blocks a sendMessage targeting any other chat", async () => {
    const originalFetch = vi.fn(async () => telegramResponse());
    const guard = createTelegramQaFetchGuard({
      botToken: TOKEN,
      qaChatId: QA_CHAT_ID,
      originalFetch: originalFetch as typeof fetch,
    });

    const response = await guard.fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      body: JSON.stringify({ chat_id: QA_CHAT_ID + 1, text: "wrong target" }),
    });

    expect(response.status).toBe(403);
    expect(originalFetch).not.toHaveBeenCalled();
    expect(guard.messages).toEqual([]);
    expect(guard.violations).toEqual([
      "sendMessage targeted a chat other than TELEGRAM_QA_CHAT_ID",
    ]);
  });

  it("blocks unexpected methods and credentials", async () => {
    const originalFetch = vi.fn(async () => telegramResponse());
    const guard = createTelegramQaFetchGuard({
      botToken: TOKEN,
      qaChatId: QA_CHAT_ID,
      originalFetch: originalFetch as typeof fetch,
    });

    const unexpectedMethod = await guard.fetch(
      `https://api.telegram.org/bot${TOKEN}/deleteWebhook`,
      { method: "POST", body: "{}" },
    );
    const unexpectedToken = await guard.fetch(
      "https://api.telegram.org/bot999999:other/sendMessage",
      { method: "POST", body: JSON.stringify({ chat_id: QA_CHAT_ID, text: "no" }) },
    );

    expect(unexpectedMethod.status).toBe(403);
    expect(unexpectedToken.status).toBe(403);
    expect(originalFetch).not.toHaveBeenCalled();
    expect(guard.violations).toEqual([
      "unexpected Telegram Bot API method: deleteWebhook",
      "unexpected Telegram API credential or path",
    ]);
  });
});
