import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  chatActions: [] as Array<{ chatId: number; action: string }>,
  runCheck: vi.fn(),
  saveSession: vi.fn(),
  publicPostEvidence: vi.fn(),
}));

function safeResult(input: string) {
  return {
    type: "text" as const,
    display: input,
    level: "safe" as const,
    score: 0,
    reasons: [] as string[],
    explanation: "No obvious scam signals.",
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
  };
}

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: hoisted.runCheck,
  analyzeImageCore: vi.fn(),
  transcribeVoiceCore: vi.fn(),
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: vi.fn(),
}));

vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return Promise.resolve({ ok: true });
  },
  sendChatAction: (chatId: number, action: string) => {
    hoisted.chatActions.push({ chatId, action });
    return Promise.resolve();
  },
  getFile: vi.fn(),
  downloadFileAsDataUrl: vi.fn(),
  getChatInfo: vi.fn(),
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: hoisted.saveSession,
  loadSession: vi.fn(),
  resetScenario: vi.fn(),
}));

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: hoisted.publicPostEvidence,
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));

vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: (_input: string, result: unknown) => Promise.resolve(result),
}));

vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: (_input: string, result: unknown) => Promise.resolve(result),
}));

import { handleCheck } from "./check";

function ctx(userId = 42): HandlerCtx {
  const session: Session = {
    telegramUserId: userId,
    lang: "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
  };
  return { chatId: 100 + userId, userId, session };
}

describe("handleCheck speed helpers", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    hoisted.sentMessages.length = 0;
    hoisted.chatActions.length = 0;
    hoisted.publicPostEvidence.mockResolvedValue(null);
    hoisted.runCheck.mockImplementation(({ input }: { input: string }) =>
      Promise.resolve(safeResult(input)),
    );
    hoisted.saveSession.mockResolvedValue({ ok: true });
  });

  it("reuses a short-lived cached result for repeated normalized text by the same user", async () => {
    await handleCheck("Cache Regression 2026 text", ctx(7101));
    await handleCheck("  cache   regression 2026 TEXT  ", ctx(7101));

    expect(hoisted.runCheck).toHaveBeenCalledTimes(1);
    expect(hoisted.sentMessages).toHaveLength(2);
    expect(hoisted.saveSession).toHaveBeenCalledTimes(2);
  });

  it("does not share cached check results between users", async () => {
    await handleCheck("shared-looking cache regression text", ctx(7102));
    await handleCheck("shared-looking cache regression text", ctx(7103));

    expect(hoisted.runCheck).toHaveBeenCalledTimes(2);
  });

  it("sends a visible processing status when a check takes noticeable time", async () => {
    vi.useFakeTimers();
    let resolveCheck!: () => void;
    hoisted.runCheck.mockImplementationOnce(
      ({ input }: { input: string }) =>
        new Promise((resolve) => {
          resolveCheck = () => resolve(safeResult(input));
        }),
    );

    const pending = handleCheck("slow cache status regression text", ctx(7104));
    await vi.advanceTimersByTimeAsync(1000);

    expect(hoisted.sentMessages.some((message) => message.text.includes("Проверяю"))).toBe(true);

    resolveCheck();
    await pending;
    vi.useRealTimers();
  });
});
