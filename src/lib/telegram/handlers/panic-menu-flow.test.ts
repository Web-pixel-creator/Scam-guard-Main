// Tests for panic menu submenu/edit flow (task 7.7).
//
// Verifies the panic callback handler in misc.ts for:
//   - `panic:more` sends a visible page 2 keyboard
//   - `panic:more2` sends a visible page 3 keyboard
//   - `panic:back` sends a visible page 1 keyboard
//   - `panic:back2` sends a visible page 2 keyboard
//   - `panic:N` sends a new message (not edit)
//
// Validates: Requirements 4.2, 4.3, 4.5
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuardianAngelSnapshot } from "@/lib/telegram/guardian-angel";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

// ---------------------------------------------------------------------------
// Hoisted capture buffers for mocks
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  sendCalls: [] as { chatId: number; text: string; keyboard?: unknown }[],
  editCalls: [] as { chatId: number; messageId: number; text: string; keyboard?: unknown }[],
  answerCalls: [] as string[],
  saveCalls: [] as { userId: number; patch: unknown }[],
  audioCalls: [] as unknown[],
  // Mutable editMessageText result — swap per test.
  editResult: { current: { ok: true } as { ok: boolean } },
}));

// Mock the Telegram API module
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    h.sendCalls.push({ chatId: opts.chatId, text: opts.text, keyboard: opts.keyboard });
    return Promise.resolve({ ok: true });
  },
  sendAudioFile: (opts: unknown) => {
    h.audioCalls.push(opts);
    return Promise.resolve({ ok: true });
  },
  editMessageText: (opts: {
    chatId: number;
    messageId: number;
    text: string;
    keyboard?: unknown;
  }) => {
    h.editCalls.push({
      chatId: opts.chatId,
      messageId: opts.messageId,
      text: opts.text,
      keyboard: opts.keyboard,
    });
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
  saveSession: (userId: number, patch: unknown) => {
    h.saveCalls.push({ userId, patch });
    return Promise.resolve({ ok: true });
  },
  resetScenario: () => Promise.resolve(),
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

import { handleCallback } from "./misc";
import { bt } from "@/lib/telegram/bot-i18n";
import {
  buildPanicKeyboardPage1,
  buildPanicKeyboardPage2,
  buildPanicKeyboardPage3,
  buildPanicMenuText,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";

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

function callbackData(keyboard: unknown): string[] {
  if (!Array.isArray(keyboard)) return [];
  return (keyboard as { callback_data?: string }[][])
    .flat()
    .map((b) => b.callback_data)
    .filter((d): d is string => typeof d === "string");
}

beforeEach(() => {
  h.sendCalls.length = 0;
  h.editCalls.length = 0;
  h.answerCalls.length = 0;
  h.saveCalls.length = 0;
  h.audioCalls.length = 0;
  h.editResult.current = { ok: true };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("voice_correct callback", () => {
  it("asks for a corrected transcript and routes the next message through text check", async () => {
    await handleCallback("voice_correct", makeCtx());

    expect(h.saveCalls).toEqual([
      {
        userId: USER_ID,
        patch: expect.objectContaining({
          scenario: "await_check",
          scenarioStep: 0,
        }),
      },
    ]);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toContain("исправленный текст");
  });
});

// ===========================================================================
// panic:more → sends page 2
// ===========================================================================

describe("panic:more — sends page 2", () => {
  it("sends a new visible message with page 2 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:more", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
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
// panic:more2 → sends page 3
// ===========================================================================

describe("panic:more2 — sends page 3", () => {
  it("sends a new visible message with page 3 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:more2", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage3("ru"));
  });

  it("sends a new message when messageId is absent", async () => {
    const ctx = makeCtx({ messageId: undefined });
    await handleCallback("panic:more2", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage3("ru"));
  });
});

// ===========================================================================
// panic:back → sends page 1
// ===========================================================================

describe("panic:back — sends page 1", () => {
  it("sends a new visible message with page 1 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:back", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage1("ru"));
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
// panic:back2 → sends page 2
// ===========================================================================

describe("panic:back2 — sends page 2", () => {
  it("sends a new visible message with page 2 keyboard when messageId is present", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:back2", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
  });

  it("sends a new message when messageId is absent", async () => {
    const ctx = makeCtx({ messageId: undefined });
    await handleCallback("panic:back2", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
  });
});

// ===========================================================================
// Pagination should never edit old SOS cards.
// ===========================================================================

describe("panic pagination — visible response contract", () => {
  it("does not attempt editMessageText even if the API edit path would fail", async () => {
    h.editResult.current = { ok: false };
    const ctx = makeCtx();
    await handleCallback("panic:more", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toBe(buildPanicMenuText("ru"));
    expect(h.sendCalls[0].keyboard).toEqual(buildPanicKeyboardPage2("ru"));
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

  it("sends a new message for panic:15 (not edit)", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:15", ctx);

    expect(h.editCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    expect(h.sendCalls[0].text).toContain("Госвыплата");
  });

  it("adds contextual follow-up buttons to scenario text messages", async () => {
    const ctx = makeCtx();
    await handleCallback("panic:3", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual(
      expect.arrayContaining([
        "panicctx:3:more",
        "panicctx:3:contacts",
        "panicctx:3:script",
        "family:notify",
      ]),
    );
  });

  it("keeps live-call government context for follow-up callback text", async () => {
    const base = makeCtx();
    const ctx = makeCtx({
      session: {
        ...base.session,
        scenarioData: {
          lastPanicId: 6,
          lastPanicAt: new Date(0).toISOString(),
          lastLiveCallContext: "government",
        },
      },
    });

    await handleCallback("panicctx:6:contacts", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Официальный канал госоргана");
    expect(h.sendCalls[0].text).not.toContain("Проверьте мой счёт");
    expect(h.saveCalls).toHaveLength(1);
    expect(h.saveCalls[0].patch).toEqual(
      expect.objectContaining({
        scenarioData: expect.objectContaining({
          lastPanicId: 6,
          lastLiveCallContext: "government",
        }),
      }),
    );
  });

  it("handles every panic scenario button with a concrete response and stored context", async () => {
    const panicIds: PanicScenarioId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    for (const panicId of panicIds) {
      h.sendCalls.length = 0;
      h.editCalls.length = 0;
      h.saveCalls.length = 0;

      await handleCallback(`panic:${panicId}`, makeCtx());

      expect(h.editCalls, `panic:${panicId}`).toHaveLength(0);
      expect(h.sendCalls, `panic:${panicId}`).toHaveLength(1);
      expect(h.sendCalls[0].chatId, `panic:${panicId}`).toBe(CHAT_ID);
      expect(h.sendCalls[0].text.length, `panic:${panicId}`).toBeGreaterThan(40);
      expect(h.saveCalls, `panic:${panicId}`).toHaveLength(1);
      expect(h.saveCalls[0].patch, `panic:${panicId}`).toEqual(
        expect.objectContaining({
          scenario: "none",
          scenarioStep: 0,
          scenarioData: expect.objectContaining({
            lastPanicId: panicId,
            chatScope: expect.objectContaining({ chatId: CHAT_ID }),
          }),
        }),
      );
    }
  });
});

// ===========================================================================
// livecall:tell_family — distinct guidance, not a duplicate hangup response
// ===========================================================================

describe("livecall:tell_family — routes to Family Shield notify", () => {
  it("sends a dedicated family response (manual fallback when storage is unavailable)", async () => {
    const ctx = makeCtx();
    await handleCallback("livecall:tell_family", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(CHAT_ID);
    // In tests Supabase is not available, so the real notify attempt degrades
    // to the manual "call a relative yourself" advice instead of failing silently.
    expect(h.sendCalls[0].text).toContain("позвоните близкому вручную");
    expect(h.sendCalls[0].text).not.toBe(bt("live_call_hangup", "ru"));
  });
});

describe("Guardian Angel callbacks", () => {
  const guardianActions = [
    "guardian:next",
    "guardian:done",
    "guardian:safe_call",
    "guardian:full_plan",
  ] as const;

  function makeGuardianCtx(): HandlerCtx {
    const at = new Date().toISOString();
    const guardian: GuardianAngelSnapshot = {
      level: "high_risk",
      type: "url",
      reasons: ["asks_for_sms_code", "impersonates_bank"],
      at,
    };
    return makeCtx({
      session: {
        telegramUserId: USER_ID,
        lang: "ru",
        scenario: "none",
        scenarioStep: 0,
        scenarioData: {
          guardian,
          replyCheckContexts: [
            {
              messageId: MESSAGE_ID,
              snapshot: {
                level: "high_risk",
                type: "url",
                context: "generic",
                reasons: [...guardian.reasons],
                at,
              },
              guardian,
            },
          ],
        },
        updatedAt: new Date(0).toISOString(),
      } as Session,
    });
  }

  it("answers the next-step callback from stored safe high-risk context", async () => {
    const ctx = makeGuardianCtx();

    await handleCallback("guardian:next", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Следующий безопасный шаг");
    expect(callbackData(h.sendCalls[0].keyboard)).toContain("guardian:done");
  });

  it.each(guardianActions)(
    "answers %s from stored safe high-risk context",
    async (guardianAction) => {
      await handleCallback(guardianAction, makeGuardianCtx());

      expect(h.sendCalls).toHaveLength(1);
      expect(h.sendCalls[0].text.length).toBeGreaterThan(40);
      expect(callbackData(h.sendCalls[0].keyboard)).toEqual(
        expect.arrayContaining([
          "guardian:next",
          "guardian:done",
          "guardian:safe_call",
          "guardian:full_plan",
          "check_another",
        ]),
      );
    },
  );

  it("uses Guardian A from the clicked message even when current session Guardian is B", async () => {
    const ctx = makeGuardianCtx();
    ctx.session.scenarioData.guardian = {
      level: "high_risk",
      type: "payment",
      reasons: ["investment_fast_profit_pitch"],
      at: new Date().toISOString(),
    };

    await handleCallback("guardian:safe_call", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("банк");
    expect(h.sendCalls[0].text).not.toContain("крипт");
  });

  it("never falls back to the current Guardian when the clicked message has no binding", async () => {
    const ctx = makeGuardianCtx();
    ctx.session.scenarioData.replyCheckContexts = [];

    await handleCallback("guardian:next", ctx);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("не вижу активной опасной проверки");
    expect(h.sendCalls[0].keyboard).toBeUndefined();
  });

  it("acknowledges a stale Guardian voice callback without invoking audio generation", async () => {
    const ctx = makeGuardianCtx();
    ctx.session.scenarioData.replyCheckContexts = [];

    await handleCallback("voiceout:guardian", ctx, "guardian-voice-stale");

    expect(h.answerCalls).toEqual(["guardian-voice-stale"]);
    expect(h.audioCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("нет безопасного контекста");
  });

  it("does not pretend to remember a high-risk context when none is stored", async () => {
    await handleCallback("guardian:next", makeCtx());

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("не вижу активной опасной проверки");
    expect(h.sendCalls[0].keyboard).toBeUndefined();
  });

  it.each(guardianActions)(
    "does not answer %s with stale details when no Guardian context is stored",
    async (guardianAction) => {
      await handleCallback(guardianAction, makeCtx());

      expect(h.sendCalls).toHaveLength(1);
      expect(h.sendCalls[0].text.length).toBeGreaterThan(40);
      expect(h.sendCalls[0].keyboard).toBeUndefined();
    },
  );
});
