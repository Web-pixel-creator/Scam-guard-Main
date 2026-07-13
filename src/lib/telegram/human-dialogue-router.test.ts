import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HUMAN_DIALOGUE_CORPUS } from "@/lib/telegram/human-dialogue-corpus";
import {
  dispatchUpdate,
  type DispatchDeps,
  type Handlers,
  type TelegramUpdate,
} from "@/lib/telegram/router";
import { withSessionChatScope, type Session } from "@/lib/telegram/session.server";

type HandlerCall = { name: keyof Handlers; arg: unknown };

function messageUpdate(text: string, languageCode: string): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: 100, language_code: languageCode },
      chat: { id: 100, type: "private" },
      text,
    },
  } as TelegramUpdate;
}

function sessionFor(lang: Session["lang"], withRecentResult: boolean): Session {
  return {
    telegramUserId: 100,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: withRecentResult
      ? withSessionChatScope(
          {
            lastCheck: {
              level: "suspicious",
              type: "url",
              context: "generic",
              reasons: ["weird_domain"],
              provenance: {
                methods: ["url_structure"],
                sources: ["visible_input"],
                limitations: ["signal_not_proof"],
              },
              at: new Date().toISOString(),
            },
          },
          100,
          "private",
        )
      : {},
    updatedAt: new Date().toISOString(),
  };
}

function spyHandlers(calls: HandlerCall[]): Handlers {
  const record =
    (name: keyof Handlers) =>
    async (arg: unknown): Promise<void> => {
      calls.push({ name, arg });
    };

  return {
    handleCommand: record("handleCommand"),
    handleScenarioStep: record("handleScenarioStep"),
    handleScenarioImage: record("handleScenarioImage"),
    handleCheck: record("handleCheck"),
    handleMetaIntent: record("handleMetaIntent"),
    handleImage: record("handleImage"),
    handleVoice: record("handleVoice"),
    handlePhoneFromContact: record("handlePhoneFromContact"),
    handleCallback: record("handleCallback"),
    handleOutOfScope: record("handleOutOfScope"),
    handleInlineQuery: record("handleInlineQuery"),
  };
}

describe("human dialogue corpus through the Telegram router", () => {
  let fetchGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchGuard = vi.fn(() => {
      throw new Error("offline human dialogue router QA must not access the network");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("routes all 1,008 cases with real recent-result state and no external side effects", async () => {
    let metaReplies = 0;
    let contextualFollowUps = 0;

    for (const row of HUMAN_DIALOGUE_CORPUS) {
      const calls: HandlerCall[] = [];
      const session = sessionFor(row.lang, row.context === "after_result");
      const deps: DispatchDeps = {
        handlers: spyHandlers(calls),
        loadSession: vi.fn(async () => session),
        resetScenario: vi.fn(async () => undefined),
      };

      await dispatchUpdate(messageUpdate(row.utterance, row.lang), deps);

      expect(calls, row.id).toHaveLength(1);
      const shouldUseRecentResult =
        row.context === "after_result" &&
        (row.expectedIntent === "explain_risk" ||
          (row.expectedIntent === "how_do_you_check" && row.variant !== 5 && row.variant !== 6));

      if (shouldUseRecentResult) {
        expect(calls[0].name, row.id).toBe("handleCheck");
        expect(calls[0].arg, row.id).toBe(row.utterance);
        contextualFollowUps += 1;
      } else {
        expect(calls[0].name, row.id).toBe("handleMetaIntent");
        expect(calls[0].arg, row.id).toBe(row.expectedIntent);
        metaReplies += 1;
      }
    }

    expect(metaReplies).toBe(966);
    expect(contextualFollowUps).toBe(42);
  });
});
