import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: () =>
    Promise.resolve({
      type: "telegram",
      display: "@ui•••eb",
      level: "unknown",
      score: 5,
      reasons: ["unknown_sender"],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
      brandEvidence: [],
    }),
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
  getChatInfo: () =>
    Promise.resolve({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    }),
  escapeMarkdownV2: (s: string) => s,
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
  });

  it("renders a Telegram metadata limitation instead of a generic unknown-only answer", async () => {
    await handleCheck("@UiWebWeb", { chatId: 100, userId: 42, session });

    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain(
      "Не удалось получить публичные данные @UiWebWeb",
    );
    expect(hoisted.sentMessages[0].text).toContain("Это не доказательство скама");
  });
});
