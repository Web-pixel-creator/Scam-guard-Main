import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<{ input: string; type?: string }>,
  getChatInfoCalls: 0,
  reputationCalls: 0,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: { input: string; type?: string }) => {
    hoisted.runCheckCalls.push(params);
    return Promise.resolve({
      type: params.type === "text" ? "text" : "telegram",
      display: "@ui•••eb",
      level: "unknown",
      score: 5,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    });
  },
  analyzeImageCore: () => Promise.resolve(null),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return Promise.resolve({ ok: true });
  },
  sendChatAction: () => Promise.resolve(),
  getFile: () => Promise.resolve(null),
  downloadFileAsDataUrl: () => Promise.resolve(null),
  getChatInfo: () => {
    hoisted.getChatInfoCalls += 1;
    return Promise.resolve({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    });
  },
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: (input: string) =>
    input.includes("t.me/TonZnatok/123")
      ? Promise.resolve({
          target: { username: "TonZnatok", postId: "123" },
          text: "Розыгрыш NFT: пройти капчу и проголосовать",
          links: ["https://voting.blockchain-life.com"],
          checkInput:
            "Telegram public post: https://t.me/TonZnatok/123\n\nPublic post text:\nРозыгрыш NFT: пройти капчу и проголосовать\n\nVisible post links:\nhttps://voting.blockchain-life.com",
        })
      : Promise.resolve(null),
  enrichTelegramPublicPostResult: (result: { explanation: string | null }, evidence: unknown) =>
    evidence
      ? {
          ...result,
          explanation:
            "Источник: публичный Telegram-пост @TonZnatok/123. Я проверил только видимый текст/ссылки.",
        }
      : result,
}));

vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: (_input: string, result: unknown) => {
    hoisted.reputationCalls += 1;
    return Promise.resolve(result);
  },
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: () => Promise.resolve(),
}));

import { handleCheck } from "@/lib/telegram/handlers/check";
import type { Session } from "@/lib/telegram/session.server";

const session: Session = {
  telegramUserId: 42,
  lang: "ru",
  scenario: "none",
  scenarioStep: 0,
  scenarioData: {},
  updatedAt: new Date(0).toISOString(),
};

describe("handleCheck telegram metadata enrichment", () => {
  beforeEach(() => {
    hoisted.sentMessages.length = 0;
    hoisted.runCheckCalls.length = 0;
    hoisted.getChatInfoCalls = 0;
    hoisted.reputationCalls = 0;
  });

  it("renders a Telegram metadata limitation instead of a generic unknown-only answer", async () => {
    await handleCheck("@UiWebWeb", { chatId: 100, userId: 42, session });

    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Telegram-паспорт: @UiWebWeb");
    expect(hoisted.sentMessages[0].text).toContain("Bot API не видит этот username");
    expect(hoisted.sentMessages[0].text).toMatch(/это не доказательство скама/i);
    expect(hoisted.sentMessages[0].text).toContain("SCAM-метка");
    expect(hoisted.sentMessages[0].text).toContain("подтвержд. жалоб в Ishonch Guard не найдено");
    expect(hoisted.sentMessages[0].text).toContain("сообщение/скрин");
    expect(hoisted.getChatInfoCalls).toBe(1);
    expect(hoisted.reputationCalls).toBe(1);
  });

  it("routes public Telegram post content into the check pipeline before metadata fallback", async () => {
    await handleCheck("https://t.me/TonZnatok/123", { chatId: 100, userId: 42, session });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0]).toMatchObject({ type: "text" });
    expect(hoisted.runCheckCalls[0].input).toContain("Розыгрыш NFT");
    expect(hoisted.runCheckCalls[0].input).toContain("https://voting.blockchain-life.com");
    expect(hoisted.getChatInfoCalls).toBe(0);
    expect(hoisted.reputationCalls).toBe(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("публичный Telegram-пост");
  });
});
