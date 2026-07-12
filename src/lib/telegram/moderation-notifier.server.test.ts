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
  buildHighSignalResearchModerationNotice,
  formatModerationNoticeForTelegram,
  notifyHighSignalResearchModeration,
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
    expect(payload?.text).toContain("Служебное уведомление для модераторов");
    expect(payload?.text).toContain("Что проверить");
    expect(payload?.text).toContain("Почему номер/username скрыт");
    expect(payload?.text).toContain("Полный номер/username, решение и история цели доступны");
  });

  it("sanitizes credential classes again at the Telegram moderation egress", async () => {
    process.env.TELEGRAM_MODERATION_CHAT_ID = "-1001234567890";
    const markers = [
      "notifier-secret",
      "9 1 4 2 8 7",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ];

    const result = await notifyModeration({
      kind: "report",
      entityType: "text",
      redactedValue: `password ${markers[0]}`,
      scamType: `OTP: ${markers[1]}`,
      city: `seed phrase: ${markers[2]}`,
      language: "en",
    });

    expect(result).toEqual({ ok: true });
    const calls = hoisted.sendMessage.mock.calls as unknown as Array<[{ text: string }]>;
    const payload = calls[0][0];
    for (const marker of markers) expect(payload.text).not.toContain(marker);
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
    expect(text).toContain("В этот Telegram-чат уходит только маска и краткая сводка");
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

    expect(text).toContain("повторный сигнал");
    expect(text).toContain("На эту цель уже жаловались сегодня");
    expect(text).toContain("Повторный сигнал учтён");
    expect(text).toContain("повышает приоритет проверки");
    expect(text).toContain("отдельная публичная запись не создана");
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
    expect(text).toContain("Служебное уведомление для модераторов");
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

  it("builds a high-signal research notice from public trend metadata only", () => {
    const notice = buildHighSignalResearchModerationNotice({
      limit: 5,
      generatedAt: new Date("2026-07-02T10:00:00.000Z"),
    });

    expect(notice.kind).toBe("research");
    expect(notice.items.length).toBeGreaterThan(0);
    expect(notice.items.length).toBeLessThanOrEqual(5);
    expect(notice.generatedAt).toBe("2026-07-02T10:00:00.000Z");

    for (const item of notice.items) {
      expect(item.source).toMatch(/^(research_feed|moderated_aggregate)$/);
      expect(item.severity).toMatch(/^(critical|high)$/);
      expect(item.reasonCodes.length).toBeGreaterThan(0);
      expect(item).not.toHaveProperty("rawReport");
      expect(item).not.toHaveProperty("ocrText");
      expect(item).not.toHaveProperty("url");
      expect(item).not.toHaveProperty("userId");
    }
  });

  it("formats research alerts without raw report-shaped evidence", () => {
    const text = formatModerationNoticeForTelegram({
      kind: "research",
      generatedAt: "2026-07-02T10:00:00.000Z",
      items: [
        {
          id: "suspicious-https://evil.example/private?code=abcdef1234567890",
          category: "telegram",
          severity: "critical",
          source: "research_feed",
          title: "Аккаунт +998 90 123 45 67 просит перейти на https://evil.example",
          reasonCodes: ["telegram_account_takeover_phishing", "abcdef1234567890"],
        },
      ],
    });

    expect(text).toContain("research items на модерацию");
    expect(text).toContain("Граница приватности");
    expect(text).toContain("сырых постов");
    expect(text).not.toContain("+998 90 123 45 67");
    expect(text).not.toContain("https://evil.example");
    expect(text).not.toContain("abcdef1234567890");
  });

  it("can send high-signal research alerts through the moderation chat only", async () => {
    process.env.TELEGRAM_MODERATION_CHAT_ID = "-1001234567890";

    const result = await notifyHighSignalResearchModeration({ limit: 2 });

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
    expect(payload?.chatId).toBe(-1001234567890);
    expect(payload?.keyboard).toEqual([
      [{ text: "Открыть админку", url: "https://example.test/admin" }],
    ]);
    expect(payload?.disablePreview).toBe(true);
    expect(payload?.text).toContain("research items на модерацию");
    expect(payload?.text).not.toMatch(/https?:\/\/|t\.me\//);
    expect(payload?.text).not.toContain("+998");
  });
});
