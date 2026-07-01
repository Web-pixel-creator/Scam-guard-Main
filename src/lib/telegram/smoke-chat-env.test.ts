import { describe, expect, it } from "vitest";

import { chatTypeForId, readTelegramSmokeChatId } from "../../../scripts/telegram-smoke-chat";

describe("telegram smoke chat config", () => {
  it("requires a dedicated QA chat when moderation chat is configured", () => {
    expect(() =>
      readTelegramSmokeChatId({
        TELEGRAM_MODERATION_CHAT_ID: "-1001234567890",
      }),
    ).toThrow(/TELEGRAM_QA_CHAT_ID is not set/);
  });

  it("rejects QA chat that points at the moderation chat", () => {
    expect(() =>
      readTelegramSmokeChatId({
        TELEGRAM_QA_CHAT_ID: "-1001234567890",
        TELEGRAM_MODERATION_CHAT_ID: "-1001234567890",
      }),
    ).toThrow(/must not equal/);
  });

  it("accepts a separate QA chat id", () => {
    expect(
      readTelegramSmokeChatId({
        TELEGRAM_QA_CHAT_ID: "123456789",
        TELEGRAM_MODERATION_CHAT_ID: "-1001234567890",
      }),
    ).toBe(123456789);
  });

  it("keeps Telegram chat type detection available to smoke scripts", () => {
    expect(chatTypeForId(123456789)).toBe("private");
    expect(chatTypeForId(-123456789)).toBe("group");
    expect(chatTypeForId(-1001234567890)).toBe("supergroup");
  });
});
