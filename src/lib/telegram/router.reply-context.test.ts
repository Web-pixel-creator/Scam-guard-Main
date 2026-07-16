import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchUpdate,
  telegramUpdateSchema,
  type HandlerCtx,
  type Handlers,
  type TelegramUpdate,
} from "@/lib/telegram/router";
import type { GuardianAngelSnapshot } from "@/lib/telegram/guardian-angel";
import { rememberReplyCheckContext } from "@/lib/telegram/reply-check-context";
import type { LastCheckSnapshot, Session } from "@/lib/telegram/session.server";

function snapshot(reason: string): LastCheckSnapshot {
  return {
    level: "suspicious",
    type: "url",
    context: "generic",
    reasons: [reason],
    at: new Date().toISOString(),
  };
}

function session(): Session {
  const resultA = snapshot("weird_domain");
  const resultB = snapshot("asks_for_sms_code");
  const guardianA: GuardianAngelSnapshot = {
    level: "high_risk",
    type: "url",
    reasons: ["impersonates_bank"],
    at: resultA.at,
  };
  const withA = rememberReplyCheckContext(
    { chatScope: { chatId: 42, chatType: "private" }, lastCheck: resultB },
    101,
    resultA,
    undefined,
    guardianA,
  );
  return {
    telegramUserId: 42,
    lang: "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: rememberReplyCheckContext(withA, 102, resultB),
    updatedAt: new Date().toISOString(),
  };
}

function handlers() {
  const handleCheck = vi.fn<Handlers["handleCheck"]>();
  const handleMetaIntent = vi.fn<Handlers["handleMetaIntent"]>();
  const noOp = vi.fn(async () => undefined);
  const value: Handlers = {
    handleCommand: noOp,
    handleScenarioStep: noOp,
    handleScenarioImage: noOp,
    handleCheck,
    handleMetaIntent,
    handleImage: noOp,
    handleVoice: noOp,
    handlePhoneFromContact: noOp,
    handleCallback: noOp,
    handleOutOfScope: noOp,
    handleInlineQuery: noOp,
  };
  return { value, handleCheck, handleMetaIntent };
}

function replyUpdate(messageId: number, text = "Почему домен подозрительный?"): TelegramUpdate {
  return telegramUpdateSchema.parse({
    update_id: messageId + 1_000,
    message: {
      message_id: messageId + 2_000,
      from: { id: 42, first_name: "QA", language_code: "ru" },
      chat: { id: 42, type: "private" },
      text,
      reply_to_message: {
        message_id: messageId,
        from: { id: 777, is_bot: true, username: "scamguard_bot" },
        text: "quoted OTP 123456 must be stripped",
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("router genuine Telegram Reply context", () => {
  it("strips quoted message content at the Zod boundary", () => {
    const update = replyUpdate(101);
    expect(update.message?.reply_to_message).toEqual({
      message_id: 101,
      from: { id: 777, is_bot: true, username: "scamguard_bot" },
    });
    expect(JSON.stringify(update)).not.toContain("123456");
  });

  it("passes the exact result A snapshot even when current lastCheck is B", async () => {
    const h = handlers();
    await dispatchUpdate(replyUpdate(101), {
      handlers: h.value,
      loadSession: async () => session(),
      resetScenario: async () => undefined,
    });

    expect(h.handleCheck).toHaveBeenCalledTimes(1);
    const ctx = h.handleCheck.mock.calls[0][1] as HandlerCtx;
    expect(ctx.replyToOwnBotMessage).toBe(true);
    expect(ctx.replyToMessageId).toBe(101);
    expect(ctx.replyCheckSnapshot?.reasons).toEqual(["weird_domain"]);
    expect(ctx.replyGuardianSnapshot?.reasons).toEqual(["impersonates_bank"]);
    expect(ctx.session.scenarioData.lastCheck?.reasons).toEqual(["asks_for_sms_code"]);
    expect(h.handleMetaIntent).not.toHaveBeenCalled();
  });

  it("marks an old own-bot result without a binding but never invents a snapshot", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "scamguard_bot");
    const h = handlers();
    await dispatchUpdate(replyUpdate(999), {
      handlers: h.value,
      loadSession: async () => session(),
      resetScenario: async () => undefined,
    });

    const ctx = h.handleCheck.mock.calls[0][1] as HandlerCtx;
    expect(ctx.replyToOwnBotMessage).toBe(true);
    expect(ctx.replyCheckSnapshot).toBeUndefined();
  });

  it("does not trust another bot username as this bot", async () => {
    const h = handlers();
    const update = telegramUpdateSchema.parse({
      ...replyUpdate(999),
      message: {
        ...replyUpdate(999).message,
        text: "кто ты?",
        reply_to_message: {
          message_id: 999,
          from: { id: 888, is_bot: true, username: "another_bot" },
        },
      },
    });
    await dispatchUpdate(update, {
      handlers: h.value,
      loadSession: async () => session(),
      resetScenario: async () => undefined,
    });

    expect(h.handleCheck).toHaveBeenCalledTimes(1);
    const ctx = h.handleCheck.mock.calls[0][1] as HandlerCtx;
    expect(ctx.replyToOwnBotMessage).toBeUndefined();
    expect(h.handleMetaIntent).not.toHaveBeenCalled();
  });
});
