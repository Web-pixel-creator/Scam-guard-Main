// Tests for panic menu submenu/edit flow (task 7.7).
//
// Verifies the panic callback handler in misc.ts for:
//   - `panic:more` triggers `editMessageText` with page 2 keyboard
//   - `panic:back` triggers `editMessageText` with page 1 keyboard
//   - Fallback: when edit fails, a new message is sent
//   - `panic:N` sends a new message (not edit)
//
// Validates: Requirements 4.2, 4.3, 4.5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

// ---------------------------------------------------------------------------
// Hoisted capture buffers for mocks
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  sendCalls: [] as { chatId: number; text: string; keyboard?: unknown }[],
  editCalls: [] as { chatId: number; messageId: number; text: string; keyboard?: unknown }[],
  answerCalls: [] as string[],
  // Mutable editMessageText result — swap per test.
  editResult: { current: { ok: true } as { ok: boolean } },
}));

// Mock the Telegram API module
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    h.sendCalls.push({ chatId: opts.chatId, text: opts.text, keyboard: opts.keyboard });
    return Promise.resolve({ ok: true });
  },
  editMessageText: (opts: { chatId: number; messageId: number; text: string; keyboard?: unknown }) => {
    h.editCalls.push({ chatId: opts.chatId, messageId: opts.messageId, text: opts.text, keyboard: opts.keyboard });
    return Promise.resolve(h.editResult.current);
  },
  answerCallbackQuery: (id: string) => {
    h.answerCalls.push(id);
    return Promise.resolve();
  },
  escapeMarkdownV2: (s: string) => s,
}));

// Mock the session store (not used by panic flow, but misc.ts imports it)
vi.mock("@/lib/telegram/session.server", () => ({
  setLanguage: () => Promise.resolve({ ok: true }),
  saveSession: () => Promise.resolve({ ok: true }),
  resetScenario: () => Promise.resolve(),
}));

import { handleCallback } from "./misc";
import { buildPanicKeyboardPage1, buildPanicKeyboardPage2, buildPanicMenuText } from "@/lib/telegram/emergency";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 100;
const CHAT_ID = 200;
const MESSAGE_ID = 42;

function makeCtx(overrides: Partial<HandlerCtx> = {}): HandlerCtx {
  return {
    chatId: CHAT_ID,
    userId: USER_ID,
    session: {
      telegramUserId: USER_ID,
      lang: "ru",
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
      updatedAt: new Date(0).toISOString(),
    } as Session,
    messageId: MESSAGE_ID,
    ...overrides,
  };
}

beforeEach(() => {
  h.sendCalls.length = 0;
  h.editCalls.length = 0;
  h.answerCalls.length = 0;
  h.editResult.current = { ok: true };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// panic:more → editMessageText with page 2
// ===========================================================================

describe("panic:more — navigates to page 2", () => {
  it("calls editMessageText with page 2 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:more", ctx);

    expect(h.editCalls).toHaveLength(1);
    expect(h.editCalls[0].chatId).toBe(CHAT_ID);
    expect(h.editCalls[0].messageId).toBe(MESSAGE_ID);
    expect(h.editCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.editCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
    // No fallback sendMessage
    expect(h.sendCalls).toHaveLength(0);
  });

  it("sends a new message when messageId is absent", async () => {
    const ctx = makeCtx({ messageId: undefined });
    await handleCallback("panic:more", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
  });
});

// ===========================================================================
// panic:back → editMessageText with page 1
// ===========================================================================

describe("panic:back — navigates to page 1", () => {
  it("calls editMessageText with page 1 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:back", ctx);

    expect(h.editCalls).toHaveLength(1);
    expect(h.editCalls[0].chatId).toBe(CHAT_ID);
    expect(h.editCalls[0].messageId).toBe(MESSAGE_ID);
    expect(h.editCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.editCalls[0].keyboard).toEqual(buildPanicKeyboardPage1("ru"));
    // No fallback sendMessage
    expect(h.sendCalls).toHaveLength(0);
  });

  it("sends a new message when messageId is absent", async () => {
    const ctx = makeCtx({ messageId: undefined });
    await handleCallback("panic:back", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage1("ru"));
  });
});

// ===========================================================================
// Fallback: when editMessageText fails, a new message is sent
// ===========================================================================

describe("panic pagination — fallback when edit fails", () => {
  it("sends a new message when editMessageText returns { ok: false } for panic:more", async () => {
    h.editResult.current = { ok: false };
    const ctx = makeCtx();
    await handleCallback("panic:more", ctx);

    // Edit was attempted
    expect(h.editCalls).toHaveLength(1);
    // Fallback: new message sent
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
  });

  it("sends a new message when editMessageText returns { ok: false } for panic:back", async () => {
    h.editResult.current = { ok: false };
    const ctx = makeCtx();
    await handleCallback("panic:back", ctx);

    // Edit was attempted
    expect(h.editCalls).toHaveLength(1);
    // Fallback: new message sent
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage1("ru"));
  });
});

// ===========================================================================
// panic:N — sends a new message (not edit)
// ===========================================================================

describe("panic:N — scenario text sent as a new message", () => {
  it("sends a new message for panic:1 (not edit)", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:1", ctx);

    // Should NOT attempt to edit
    expect(h.editCalls).toHaveLength(0);
    // Should send a new message
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    // Text should contain scenario content (verified contacts, etc.)
    expect(h.sendCalls[0].text).toContain("SMS");
  });

  it("sends a new message for panic:5 (not edit)", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:5", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toContain("Telegram");
  });

  it("sends a new message for panic:10 (not edit)", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:10", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
  });

  it("does not use keyboard for scenario text messages", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:3", ctx);

    expect(h.sendCalls).toHaveLength(1);
    // No keyboard passed for scenario texts
    expect(h.sendCalls[0].keyboard).toBeUndefined();
  });
});
