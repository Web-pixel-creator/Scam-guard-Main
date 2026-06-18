import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LastCheckSnapshot, Session } from "@/lib/telegram/session.server";

const hoisted = vi.hoisted(() => ({
  sentMessages: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckCalls: [] as Array<{ input: string; type?: string }>,
  saveSessionCalls: [] as Array<{ userId: number; patch: unknown }>,
}));

vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: { input: string; type?: string }) => {
    hoisted.runCheckCalls.push(params);
    return Promise.resolve({
      type: params.type ?? "url",
      display: params.input,
      level: "high_risk",
      score: 80,
      reasons: ["phishing_url"],
      explanation: "Fresh risk check.",
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
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: (userId: number, patch: unknown) => {
    hoisted.saveSessionCalls.push({ userId, patch });
    return Promise.resolve({ ok: true });
  },
}));

vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: () => Promise.resolve(null),
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));

vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: (_input: string, result: unknown) => Promise.resolve(result),
}));

vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: (_input: string, result: unknown) => Promise.resolve(result),
}));

import { handleCheck } from "@/lib/telegram/handlers/check";

function sessionWith(lastCheck?: LastCheckSnapshot): Session {
  return {
    telegramUserId: 42,
    lang: "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: lastCheck ? { lastCheck } : {},
    updatedAt: new Date().toISOString(),
  };
}

function snapshot(overrides: Partial<LastCheckSnapshot> = {}): LastCheckSnapshot {
  return {
    level: "safe",
    type: "text",
    context: "qr_menu",
    at: new Date().toISOString(),
    ...overrides,
  };
}

describe("handleCheck follow-up routing", () => {
  beforeEach(() => {
    hoisted.sentMessages.length = 0;
    hoisted.runCheckCalls.length = 0;
    hoisted.saveSessionCalls.length = 0;
  });

  it("answers confidence follow-ups from the last result instead of running a new check", async () => {
    await handleCheck("Точно?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "qr_menu", level: "safe" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages).toHaveLength(1);
    expect(hoisted.sentMessages[0].text).toContain("Не могу гарантировать на 100%");
    expect(hoisted.sentMessages[0].text).toContain("QR");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers next-step follow-ups after high-risk results", async () => {
    await handleCheck("Что еще посоветуешь?", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "generic", level: "high_risk" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Следующий безопасный шаг");
    expect(hoisted.sentMessages[0].text).toContain("Остановите разговор");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("answers bank-number follow-ups with official callback guidance", async () => {
    await handleCheck("Дай мне номер банка", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot({ context: "phone", type: "phone", level: "unknown" })),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Официальный обратный звонок");
    expect(hoisted.sentMessages[0].text).toContain("1340");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });

  it("still sends a real artifact to the risk pipeline", async () => {
    await handleCheck("Точно? https://kapitalbank.uz.evil.com/login", {
      chatId: 100,
      userId: 42,
      session: sessionWith(snapshot()),
    });

    expect(hoisted.runCheckCalls).toHaveLength(1);
    expect(hoisted.runCheckCalls[0].input).toContain("https://kapitalbank.uz.evil.com/login");
  });

  it("adds Guardian Angel guidance and stores only safe metadata after high-risk checks", async () => {
    await handleCheck("https://kapitalbank.uz.evil.com/login", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.sentMessages).toHaveLength(2);
    expect(hoisted.sentMessages[1].text).toContain("Я рядом");
    expect(hoisted.sentMessages[1].text).toContain("не новая проверка");
    expect(hoisted.sentMessages[1].text).toContain("один безопасный шаг");
    const callbacks = (hoisted.sentMessages[1].keyboard as { callback_data?: string }[][])
      .flat()
      .map((button) => button.callback_data);
    expect(callbacks).toContain("guardian:next");
    expect(callbacks).toContain("family:notify");

    expect(hoisted.saveSessionCalls).toHaveLength(1);
    const saved = JSON.stringify(hoisted.saveSessionCalls[0].patch);
    expect(saved).toContain('"guardian"');
    expect(saved).toContain('"high_risk"');
    expect(saved).not.toContain("kapitalbank.uz.evil.com");
    expect(saved).not.toContain("Fresh risk check");
  });

  it("answers orphan helper phrases without a fake insufficient-data card", async () => {
    await handleCheck("дай номер банка", {
      chatId: 100,
      userId: 42,
      session: sessionWith(),
    });

    expect(hoisted.runCheckCalls).toHaveLength(0);
    expect(hoisted.sentMessages[0].text).toContain("Официальный обратный звонок");
    expect(hoisted.sentMessages[0].text).not.toContain("Недостаточно данных");
  });
});
