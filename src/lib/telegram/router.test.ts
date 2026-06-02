// Unit tests for the Telegram update router (`router.ts`).
//
// Task 8.8 — exercises the PURE routing logic and the EFFECTFUL dispatch with
// injected dependencies (no I/O, no real Supabase/Telegram calls):
//
//   - `parseCommand`  : command parsing, "@botusername" suffix, args, case,
//                       unknown commands, bare "/".
//   - `decideRoute`   : fixed priority callback > command > scenario step >
//                       content (type), forwarded text as ordinary check.
//   - `dispatchUpdate`: command interrupts an active scenario (resetScenario is
//                       called, the command — not the scenario step — runs, and
//                       the command handler sees a neutral session).
//
// We DON'T touch router.ts / session.server.ts. The effectful tests inject a
// fake `handlers`/`loadSession`/`resetScenario` via the optional `deps` arg, so
// the dispatch logic stays fully observable.
//
// Validates: Requirements 4.7, 4.9, 11.5, 15.3, 15.4
import { describe, it, expect, vi } from "vitest";
import {
  parseCommand,
  decideRoute,
  extractTarget,
  dispatchUpdate,
  type TelegramUpdate,
  type Handlers,
  type HandlerCtx,
  type DispatchDeps,
} from "./router";
import type { Session, Scenario } from "./session.server";

// ---------------------------------------------------------------------------
// Test helpers — build valid Sessions and Telegram updates
// ---------------------------------------------------------------------------

/** A neutral session (no active scenario) for the given user. */
function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    telegramUserId: 100,
    lang: "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

/** A `message` update from `from.id`/`chat.id` carrying the given message fields. */
function messageUpdate(
  message: Record<string, unknown>,
  opts: { userId?: number; chatId?: number } = {},
): TelegramUpdate {
  const userId = opts.userId ?? 100;
  const chatId = opts.chatId ?? userId;
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: userId },
      chat: { id: chatId },
      ...message,
    },
  } as unknown as TelegramUpdate;
}

/** A `callback_query` update. */
function callbackUpdate(
  data: string,
  opts: { userId?: number; chatId?: number } = {},
): TelegramUpdate {
  const userId = opts.userId ?? 100;
  const chatId = opts.chatId ?? userId;
  return {
    update_id: 1,
    callback_query: {
      id: "cb1",
      from: { id: userId },
      message: { chat: { id: chatId } },
      data,
    },
  } as unknown as TelegramUpdate;
}

/**
 * Build a fake `Handlers` whose methods only record that they were called and
 * with what context. Lets the dispatch tests assert exactly one handler fired
 * and that the command handler saw a neutral session.
 */
function makeSpyHandlers(): {
  handlers: Handlers;
  calls: { name: keyof Handlers; arg: unknown; ctx: HandlerCtx; callbackQueryId?: string }[];
} {
  const calls: {
    name: keyof Handlers;
    arg: unknown;
    ctx: HandlerCtx;
    callbackQueryId?: string;
  }[] = [];
  const record =
    (name: keyof Handlers) =>
    async (arg: unknown, ctx: HandlerCtx, callbackQueryId?: string): Promise<void> => {
      calls.push({ name, arg, ctx, callbackQueryId });
    };
  const handlers: Handlers = {
    handleCommand: record("handleCommand"),
    handleScenarioStep: record("handleScenarioStep"),
    handleCheck: record("handleCheck"),
    handleImage: record("handleImage"),
    handlePhoneFromContact: record("handlePhoneFromContact"),
    handleCallback: record("handleCallback"),
    handleOutOfScope: record("handleOutOfScope"),
  };
  return { handlers, calls };
}

// ===========================================================================
// parseCommand
// ===========================================================================

describe("parseCommand (R4.9)", () => {
  it("parses a bare command without an argument", () => {
    expect(parseCommand("/report")).toEqual({ command: "/report", arg: "" });
  });

  it("parses a command with an argument", () => {
    expect(parseCommand("/check текст")).toEqual({ command: "/check", arg: "текст" });
  });

  it("strips the @botusername suffix and keeps the argument", () => {
    expect(parseCommand("/check@MyBot текст")).toEqual({
      command: "/check",
      arg: "текст",
    });
  });

  it("handles @botusername with no argument", () => {
    expect(parseCommand("/help@IshonchGuardBot")).toEqual({ command: "/help", arg: "" });
  });

  it("is case-insensitive and normalises the command to lowercase", () => {
    expect(parseCommand("/HELP")).toEqual({ command: "/help", arg: "" });
    expect(parseCommand("/Check ABC")).toEqual({ command: "/check", arg: "ABC" });
  });

  it("returns null for an unknown command", () => {
    expect(parseCommand("/foo")).toBeNull();
    expect(parseCommand("/foo bar")).toBeNull();
  });

  it("returns null for a bare slash", () => {
    expect(parseCommand("/")).toBeNull();
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("hello world")).toBeNull();
    expect(parseCommand("")).toBeNull();
  });

  it("trims surrounding/leading whitespace and collapses the argument", () => {
    expect(parseCommand("  /check   текст с пробелами  ")).toEqual({
      command: "/check",
      arg: "текст с пробелами",
    });
  });

  it("recognises every known command", () => {
    for (const cmd of [
      "/start",
      "/lang",
      "/help",
      "/safety",
      "/check",
      "/report",
      "/emergency",
      "/panic",
    ]) {
      expect(parseCommand(cmd)).toEqual({ command: cmd, arg: "" });
    }
  });
});

// ===========================================================================
// decideRoute — priority ordering (PURE)
// ===========================================================================

describe("decideRoute priority: callback > command > scenario step > content", () => {
  it("routes a callback query as a callback (top priority)", () => {
    const update = callbackUpdate("lang:uz");
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "callback", data: "lang:uz", callbackQueryId: "cb1" });
  });

  it("routes a known command as a command", () => {
    const update = messageUpdate({ text: "/check текст" });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({
      kind: "command",
      command: { command: "/check", arg: "текст" },
    });
  });

  it("routes an unknown slash-command as unknownCommand", () => {
    const update = messageUpdate({ text: "/foo" });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "unknownCommand" });
  });

  it("a command beats an active scenario step (R15.4 — command wins)", () => {
    const update = messageUpdate({ text: "/help" });
    const session = makeSession({ scenario: "report_value", scenarioStep: 1 });
    const action = decideRoute(update, session);
    // The route is the COMMAND, not the scenario step.
    expect(action).toEqual({ kind: "command", command: { command: "/help", arg: "" } });
  });

  it("a non-command message during an active scenario is a scenario step (R15.3)", () => {
    const update = messageUpdate({ text: "+998901112233" });
    const session = makeSession({ scenario: "report_value", scenarioStep: 1 });
    const action = decideRoute(update, session);
    expect(action).toEqual({ kind: "scenarioStep", text: "+998901112233" });
  });

  it("uses caption as the scenario-step text when text is absent", () => {
    const update = messageUpdate({ caption: "описание" });
    const session = makeSession({ scenario: "report_desc", scenarioStep: 2 });
    const action = decideRoute(update, session);
    expect(action).toEqual({ kind: "scenarioStep", text: "описание" });
  });

  it("routes plain text (no scenario) as a check", () => {
    const update = messageUpdate({ text: "https://example.com" });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "check", content: "https://example.com" });
  });
});

// ===========================================================================
// decideRoute — content-type routing (only when no scenario is active)
// ===========================================================================

describe("decideRoute content types (no active scenario)", () => {
  it("routes a photo as an image, picking the largest file_size", () => {
    const update = messageUpdate({
      photo: [
        { file_id: "small", file_size: 100 },
        { file_id: "large", file_size: 5000 },
        { file_id: "mid", file_size: 1000 },
      ],
    });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "image", fileId: "large" });
  });

  it("routes an image document as an image", () => {
    const update = messageUpdate({
      document: { file_id: "doc1", mime_type: "image/png", file_size: 2048 },
    });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "image", fileId: "doc1" });
  });

  it("routes a contact card as a contact", () => {
    const update = messageUpdate({
      contact: { phone_number: "+998901234567", first_name: "Ali" },
    });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "contact", phone: "+998901234567" });
  });

  it.each([
    ["voice", "voice"],
    ["audio", "audio"],
    ["video", "video"],
    ["sticker", "sticker"],
  ] as const)("routes a %s message as out-of-scope (%s)", (field, reason) => {
    const update = messageUpdate({ [field]: { file_id: "x" } });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "outOfScope", reason });
  });

  it("routes an empty message as out-of-scope (empty)", () => {
    const update = messageUpdate({});
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "outOfScope", reason: "empty" });
  });

  it("ignores an update with neither message nor callback", () => {
    const update = { update_id: 1 } as unknown as TelegramUpdate;
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({ kind: "ignore" });
  });
});

// ===========================================================================
// decideRoute — forwarded message handled as ordinary text input (R11.5)
// ===========================================================================

describe("decideRoute forwarded message (R11.5)", () => {
  it("treats a forwarded text message as an ordinary check", () => {
    const update = messageUpdate({
      text: "Срочно переведите деньги на безопасный счёт",
      forward_origin: { type: "user", sender_user: { id: 999 } },
    });
    const action = decideRoute(update, makeSession());
    expect(action).toEqual({
      kind: "check",
      content: "Срочно переведите деньги на безопасный счёт",
    });
  });

  it("treats a forwarded message during an active scenario as the scenario step", () => {
    // Forward still arrives as text; while a scenario is active it is the answer
    // to the current step (priority: scenario step > content type).
    const update = messageUpdate({
      text: "forwarded value",
      forward_origin: { type: "channel" },
    });
    const session = makeSession({ scenario: "report_value", scenarioStep: 1 });
    const action = decideRoute(update, session);
    expect(action).toEqual({ kind: "scenarioStep", text: "forwarded value" });
  });
});

// ===========================================================================
// extractTarget
// ===========================================================================

describe("extractTarget", () => {
  it("uses from.id / chat.id for a message", () => {
    const update = messageUpdate({ text: "hi" }, { userId: 7, chatId: -42 });
    expect(extractTarget(update)).toEqual({ userId: 7, chatId: -42 });
  });

  it("uses callback from.id and the callback message chat id", () => {
    const update = callbackUpdate("x", { userId: 7, chatId: -42 });
    expect(extractTarget(update)).toEqual({ userId: 7, chatId: -42 });
  });

  it("falls back to from.id as chat id when the callback message is absent", () => {
    const update = {
      update_id: 1,
      callback_query: { id: "cb", from: { id: 7 }, data: "x" },
    } as unknown as TelegramUpdate;
    expect(extractTarget(update)).toEqual({ userId: 7, chatId: 7 });
  });

  it("returns null for a message without a sender", () => {
    const update = {
      update_id: 1,
      message: { message_id: 1, chat: { id: 1 }, text: "channel post" },
    } as unknown as TelegramUpdate;
    expect(extractTarget(update)).toBeNull();
  });
});

// ===========================================================================
// dispatchUpdate — effectful dispatch with injected deps
// ===========================================================================

/** Build a `deps` object: spy handlers + a loadSession returning `session`. */
function makeDeps(session: Session): {
  deps: DispatchDeps;
  calls: ReturnType<typeof makeSpyHandlers>["calls"];
  loadSession: ReturnType<typeof vi.fn>;
  resetScenario: ReturnType<typeof vi.fn>;
} {
  const { handlers, calls } = makeSpyHandlers();
  const loadSession = vi.fn(async (_userId: number) => session);
  const resetScenario = vi.fn(async (_userId: number) => {});
  return {
    deps: { handlers, loadSession, resetScenario },
    calls,
    loadSession,
    resetScenario,
  };
}

describe("dispatchUpdate priority routing", () => {
  it("dispatches a callback to handleCallback", async () => {
    const { deps, calls } = makeDeps(makeSession());
    await dispatchUpdate(callbackUpdate("lang:en"), deps);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleCallback");
    expect(calls[0].arg).toBe("lang:en");
    expect(calls[0].callbackQueryId).toBe("cb1");
  });

  it("dispatches a command to handleCommand", async () => {
    const { deps, calls } = makeDeps(makeSession());
    await dispatchUpdate(messageUpdate({ text: "/safety" }), deps);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleCommand");
    expect(calls[0].arg).toEqual({ command: "/safety", arg: "" });
  });

  it("dispatches plain text to handleCheck", async () => {
    const { deps, calls } = makeDeps(makeSession());
    await dispatchUpdate(messageUpdate({ text: "check me" }), deps);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleCheck");
    expect(calls[0].arg).toBe("check me");
  });

  it("dispatches a scenario-step message to handleScenarioStep when a scenario is active", async () => {
    const session = makeSession({ scenario: "report_desc", scenarioStep: 2 });
    const { deps, calls, resetScenario } = makeDeps(session);
    await dispatchUpdate(messageUpdate({ text: "это описание" }), deps);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleScenarioStep");
    expect(calls[0].arg).toBe("это описание");
    // No scenario was interrupted, so no reset.
    expect(resetScenario).not.toHaveBeenCalled();
  });

  it("dispatches an unknown command to handleOutOfScope(unknown_command)", async () => {
    const { deps, calls } = makeDeps(makeSession());
    await dispatchUpdate(messageUpdate({ text: "/foo" }), deps);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleOutOfScope");
    expect(calls[0].arg).toBe("unknown_command");
  });

  it("does nothing for a non-actionable update (no target)", async () => {
    const { deps, calls, loadSession } = makeDeps(makeSession());
    await dispatchUpdate({ update_id: 1 } as unknown as TelegramUpdate, deps);
    expect(calls).toHaveLength(0);
    expect(loadSession).not.toHaveBeenCalled();
  });
});

describe("dispatchUpdate — command interrupts an active scenario (R15.4)", () => {
  it("resets the scenario, runs the COMMAND (not the step), and the handler sees a neutral session", async () => {
    const activeSession = makeSession({
      scenario: "report_value" as Scenario,
      scenarioStep: 1,
      scenarioData: { value: "+998901112233" },
    });
    const { deps, calls, resetScenario, loadSession } = makeDeps(activeSession);

    await dispatchUpdate(messageUpdate({ text: "/help" }), deps);

    // The session was loaded for the user.
    expect(loadSession).toHaveBeenCalledWith(100);
    // R15.4 — the active scenario was reset before handling the command.
    expect(resetScenario).toHaveBeenCalledTimes(1);
    expect(resetScenario).toHaveBeenCalledWith(100);

    // Exactly the COMMAND handler ran — NOT the scenario-step handler.
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleCommand");
    expect(calls[0].arg).toEqual({ command: "/help", arg: "" });

    // The command handler sees a NEUTRAL session (scenario cleared).
    expect(calls[0].ctx.session).toMatchObject({
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
    });
  });

  it("resets the scenario for an unknown command too, then routes to out-of-scope", async () => {
    const activeSession = makeSession({ scenario: "report_desc", scenarioStep: 2 });
    const { deps, calls, resetScenario } = makeDeps(activeSession);

    await dispatchUpdate(messageUpdate({ text: "/foo" }), deps);

    expect(resetScenario).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleOutOfScope");
    expect(calls[0].arg).toBe("unknown_command");
    // The (out-of-scope) handler also sees the neutralised session.
    expect(calls[0].ctx.session.scenario).toBe("none");
  });

  it("does NOT reset when a non-command message arrives during a scenario", async () => {
    const activeSession = makeSession({ scenario: "report_value", scenarioStep: 1 });
    const { deps, calls, resetScenario } = makeDeps(activeSession);

    await dispatchUpdate(messageUpdate({ text: "some answer" }), deps);

    expect(resetScenario).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleScenarioStep");
    // The step handler still sees the ACTIVE scenario (untouched).
    expect(calls[0].ctx.session.scenario).toBe("report_value");
  });

  it("does NOT reset when there is no active scenario and a command arrives", async () => {
    const { deps, calls, resetScenario } = makeDeps(makeSession());
    await dispatchUpdate(messageUpdate({ text: "/start" }), deps);
    expect(resetScenario).not.toHaveBeenCalled();
    expect(calls[0].name).toBe("handleCommand");
  });
});

describe("dispatchUpdate — forwarded message routed as a check (R11.5)", () => {
  it("forwarded text with no active scenario goes to handleCheck", async () => {
    const { deps, calls } = makeDeps(makeSession());
    await dispatchUpdate(
      messageUpdate({
        text: "Поздравляем! Вы выиграли приз, перейдите по ссылке",
        forward_origin: { type: "hidden_user" },
      }),
      deps,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("handleCheck");
    expect(calls[0].arg).toBe("Поздравляем! Вы выиграли приз, перейдите по ссылке");
  });
});
