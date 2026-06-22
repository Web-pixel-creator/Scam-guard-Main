import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sendMessage: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  escapeMarkdownV2: (value: string) => value,
  sendMessage: hoisted.sendMessage,
}));

vi.mock("@/lib/config.server", () => ({
  getPublicAppUrl: () => "https://example.test",
}));

import {
  formatModerationNoticeForTelegram,
  notifyModeration,
} from "@/lib/telegram/moderation-notifier.server";

const ORIGINAL_CHAT = process.env.TELEGRAM_MODERATION_CHAT_ID;

beforeEach(() => {
  hoisted.sendMessage.mockClear();
  delete process.env.TELEGRAM_MODERATION_CHAT_ID;
});

afterEach(() => {
  if (ORIGINAL_CHAT === undefined) delete process.env.TELEGRAM_MODERATION_CHAT_ID;
  else process.env.TELEGRAM_MODERATION_CHAT_ID = ORIGINAL_CHAT;
});

describe("moderation notifier", () => {
  it("stays disabled when no moderation chat is configured", async () => {
    const result = await notifyModeration({
      kind: "report",
      entityType: "telegram",
      redactedValue: "@fa***nk",
      language: "ru",
    });

    expect(result).toEqual({ ok: false });
    expect(hoisted.sendMessage).not.toHaveBeenCalled();
  });

  it("sends reports to the moderation chat with admin link only", async () => {
    process.env.TELEGRAM_MODERATION_CHAT_ID = "-1001234567890";

    const result = await notifyModeration({
      kind: "report",
      entityType: "phone",
      redactedValue: "+998 90 123 45 67",
      scamType: "fake bank https://evil.example/login?token=abcdef1234567890",
      city: "Tashkent",
      amountLostUzs: 1250000,
      language: "ru",
    });

    expect(result).toEqual({ ok: true });
    expect(hoisted.sendMessage).toHaveBeenCalledTimes(1);
    const calls = hoisted.sendMessage.mock.calls as unknown as Array<
      [
        {
          chatId: number;
          text: string;
          keyboard?: unknown;
          disablePreview?: boolean;
        },
      ]
    >;
    const payload = calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload?.chatId).toBe(-1001234567890);
    expect(payload?.keyboard).toEqual([
      [{ text: "Открыть админку", url: "https://example.test/admin" }],
    ]);
    expect(payload?.disablePreview).toBe(true);
    expect(payload?.text).not.toContain("+998 90 123 45 67");
    expect(payload?.text).not.toContain("https://evil.example");
    expect(payload?.text).not.toContain("abcdef1234567890");
    expect(payload?.text).toContain("новая жалоба");
    expect(payload?.text).toContain("Уведомление для модераторов");
    expect(payload?.text).toContain("Что проверить");
    expect(payload?.text).toContain("Почему объект скрыт");
    expect(payload?.text).toContain("Полный username/номер доступен в админке");
  });

  it("formats incident-only reports without a public target", () => {
    const text = formatModerationNoticeForTelegram({
      kind: "report",
      entityType: "text",
      redactedValue: "incident",
      language: "ru",
      incidentOnly: true,
    });

    expect(text).toContain("incident-only: no public target");
    expect(text).toContain("В этот чат уходит только маска");
  });

  it("formats duplicate reports as moderation alerts without implying a new public row", () => {
    const text = formatModerationNoticeForTelegram({
      kind: "report",
      entityType: "telegram",
      redactedValue: "@ui•••eb",
      scamType: "delivery",
      city: "Tashkent",
      language: "ru",
      duplicateOfExisting: true,
    });

    expect(text).toContain("повторная жалоба");
    expect(text).toContain("На эту цель уже жаловались сегодня");
    expect(text).toContain("учитываем повтор как дополнительный сигнал");
    expect(text).toContain("@ui•••eb");
  });

  it("formats appeals without leaking raw URLs", () => {
    const text = formatModerationNoticeForTelegram({
      kind: "appeal",
      targetType: "url",
      targetDisplay: "https://example.com/private/path?code=abcdef1234567890",
      language: "en",
    });

    expect(text).toContain("новая апелляция");
    expect(text).toContain("Уведомление для модераторов");
    expect(text).not.toContain("https://example.com");
    expect(text).not.toContain("abcdef1234567890");
  });

  it("formats smoke tests as non-user alerts", () => {
    const text = formatModerationNoticeForTelegram({
      kind: "smoke",
      label: "manual https://example.com/check abcdef1234567890",
    });

    expect(text).toContain("moderation alert smoke test");
    expect(text).toContain("No user report");
    expect(text).not.toContain("https://example.com");
    expect(text).not.toContain("abcdef1234567890");
  });
});
