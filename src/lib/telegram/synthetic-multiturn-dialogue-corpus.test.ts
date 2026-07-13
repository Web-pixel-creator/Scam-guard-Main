import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyMetaIntent, getMetaIntentResponse } from "@/lib/meta-intent";
import { evaluateText, scoreFromCodes } from "@/lib/risk/rules";
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  buildLastCheckFollowUpText,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import {
  enforceTelegramReplyContract,
  getTelegramIntentContract,
} from "@/lib/telegram/intent-contract";
import { formatCheckResult } from "@/lib/telegram/format";
import {
  SYNTHETIC_MULTITURN_DIALOGUE_CATEGORIES,
  SYNTHETIC_MULTITURN_DIALOGUE_CORPUS,
  SYNTHETIC_MULTITURN_DIALOGUE_STATS,
  SYNTHETIC_MULTITURN_FIXED_NOW,
} from "@/lib/telegram/synthetic-multiturn-dialogue-corpus";

// This suite is deterministic QA, not model training and not a record of live
// Telegram chats. Any accidental provider or reputation lookup is a failure.
describe("1,000 synthetic offline multi-turn dialogues", () => {
  let fetchGuard: ReturnType<typeof vi.fn>;
  const forbiddenUserFacingJargon =
    /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|threshold|routing\s+table|deterministic|детерминирован\w*|детерминист\w*|deterministik)\b/iu;

  beforeEach(() => {
    fetchGuard = vi.fn(() => {
      throw new Error("synthetic multi-turn corpus must not access the network or an API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("exports exact, reproducible coverage statistics", () => {
    expect(SYNTHETIC_MULTITURN_DIALOGUE_CORPUS).toHaveLength(1000);
    expect(SYNTHETIC_MULTITURN_DIALOGUE_STATS).toMatchObject({
      totalDialogues: 1000,
      totalUserTurns: 2500,
      categoryCounts: {
        code_theft: 150,
        safe_account_transfer: 130,
        credential_theft: 120,
        malware_or_remote_access: 110,
        qr_account_action: 110,
        ordinary_to_capability: 120,
        meta_exploration: 140,
        ordinary_chitchat: 120,
      },
      languageCounts: { ru: 334, uz: 333, en: 333 },
      turnCounts: { 2: 500, 3: 500 },
    });
    expect(SYNTHETIC_MULTITURN_DIALOGUE_STATS.routeCounts["input.risk_check"]).toBe(620);
    expect(
      Object.entries(SYNTHETIC_MULTITURN_DIALOGUE_STATS.routeCounts)
        .filter(([route]) => route.startsWith("followup."))
        .reduce((total, [, count]) => total + count, 0),
    ).toBe(930);
    expect(
      Object.entries(SYNTHETIC_MULTITURN_DIALOGUE_STATS.routeCounts)
        .filter(([route]) => route.startsWith("meta."))
        .reduce((total, [, count]) => total + count, 0),
    ).toBe(950);
  });

  it("contains unique dialogue sequences, not 1,000 copies of one prefixed prompt", () => {
    const ids = SYNTHETIC_MULTITURN_DIALOGUE_CORPUS.map((dialogue) => dialogue.id);
    const sequences = SYNTHETIC_MULTITURN_DIALOGUE_CORPUS.map((dialogue) =>
      dialogue.turns.map((turn) => turn.utterance).join("\u241e"),
    );

    expect(new Set(ids).size).toBe(1000);
    expect(new Set(sequences).size).toBe(1000);
    expect(new Set(SYNTHETIC_MULTITURN_DIALOGUE_CORPUS.map((row) => row.category))).toEqual(
      new Set(SYNTHETIC_MULTITURN_DIALOGUE_CATEGORIES),
    );
    for (const dialogue of SYNTHETIC_MULTITURN_DIALOGUE_CORPUS) {
      expect(dialogue.turns.length, dialogue.id).toBeGreaterThanOrEqual(2);
      expect(dialogue.turns.length, dialogue.id).toBeLessThanOrEqual(3);
      expect(
        dialogue.turns.every((turn) => turn.utterance.trim().length > 0),
        dialogue.id,
      ).toBe(true);
    }
  });

  it("covers every canonical follow-up action with a recent-check response", () => {
    const covered = new Set(
      SYNTHETIC_MULTITURN_DIALOGUE_CORPUS.flatMap((dialogue) =>
        dialogue.turns
          .filter((turn) => turn.kind === "followup")
          .map((turn) => turn.expectedAction),
      ),
    );
    expect(covered).toEqual(new Set(ALL_LAST_CHECK_FOLLOW_UP_ACTIONS));
  });

  it.each(SYNTHETIC_MULTITURN_DIALOGUE_CORPUS)(
    "validates every turn and reply contract in $id ($category/$lang)",
    (dialogue) => {
      for (const turn of dialogue.turns) {
        const contract = getTelegramIntentContract(turn.expectedRoute);
        const directEffect = contract.channels.direct;
        expect(directEffect, `${dialogue.id}/${turn.utterance}`).toBeDefined();

        if (turn.kind === "risk_check") {
          const reasons = evaluateText(turn.utterance);
          expect(classifyMetaIntent(turn.utterance), turn.utterance).toBeNull();
          expect(reasons.length, turn.utterance).toBeGreaterThan(0);
          for (const reason of turn.expectedReasons) {
            expect(reasons, `${dialogue.id}/${turn.utterance}`).toContain(reason);
          }
          const { score, level } = scoreFromCodes(reasons);
          const storedReasons = dialogue.lastCheck?.reasons ?? [];
          expect(dialogue.lastCheck?.level, dialogue.id).toBe(level);
          expect(storedReasons.length, dialogue.id).toBeLessThanOrEqual(3);
          expect(
            storedReasons.every((reason) => reasons.some((actual) => actual === reason)),
            dialogue.id,
          ).toBe(true);
          const formatted = formatCheckResult(
            {
              type: "text",
              display: "[synthetic text]",
              level,
              score,
              reasons,
              explanation: null,
              knownReports: 0,
              verifiedContact: null,
              brandEvidence: [],
            },
            dialogue.lang,
          );
          expect(contract).toMatchObject({
            family: "risk_input",
            action: "run.risk_check",
            context: "fresh_artifact",
            response: {
              provenance: "visible_or_typed_sources_only",
              safeAction: "required",
            },
          });
          expect(directEffect).toEqual({
            persistence: "required_check_row",
            trustedContact: "high_risk_only",
          });
          expect(formatted.text.trim().length, dialogue.id).toBeGreaterThan(40);
          expect(formatted.text.length, dialogue.id).toBeLessThanOrEqual(4096);
          expect(formatted.text, dialogue.id).not.toMatch(/\{[a-zA-Z0-9_]+\}/u);
          expect(formatted.text, dialogue.id).not.toMatch(forbiddenUserFacingJargon);
          expect(formatted.keyboard.length, dialogue.id).toBeGreaterThan(0);
          continue;
        }

        if (turn.kind === "meta") {
          expect(classifyMetaIntent(turn.utterance), turn.utterance).toBe(turn.expectedIntent);
          const response = getMetaIntentResponse(turn.expectedIntent, dialogue.lang);
          expect(contract).toMatchObject({
            family: "meta",
            action: "reply.meta",
            context: "none",
          });
          expect(directEffect).toEqual({
            persistence: "forbidden",
            trustedContact: "forbidden",
          });
          expect(
            enforceTelegramReplyContract(turn.expectedRoute, "direct", response),
            dialogue.id,
          ).toBe(response);
          expect(response.trim().length, dialogue.id).toBeGreaterThan(20);
          expect(response, dialogue.id).not.toMatch(/\{[a-zA-Z0-9_]+\}/u);
          expect(response, dialogue.id).not.toMatch(forbiddenUserFacingJargon);
          continue;
        }

        expect(dialogue.lastCheck, dialogue.id).toBeDefined();
        expect(
          classifyLastCheckFollowUp(
            turn.utterance,
            { lastCheck: dialogue.lastCheck },
            SYNTHETIC_MULTITURN_FIXED_NOW,
          ),
          turn.utterance,
        ).toBe(turn.expectedAction);
        const response = buildLastCheckFollowUpText(
          turn.expectedAction,
          dialogue.lastCheck!,
          dialogue.lang,
          turn.utterance,
        );
        expect(contract).toMatchObject({
          family: "followup",
          action: "reply.followup",
          context: "recent_or_orphan_check",
          response: { safeAction: "required" },
        });
        expect(directEffect).toEqual({ persistence: "forbidden", trustedContact: "forbidden" });
        expect(
          enforceTelegramReplyContract(turn.expectedRoute, "direct", response),
          dialogue.id,
        ).toBe(response);
        expect(response.trim().length, dialogue.id).toBeGreaterThan(20);
        expect(response, dialogue.id).not.toMatch(/\{[a-zA-Z0-9_]+\}/u);
        expect(response, dialogue.id).not.toMatch(forbiddenUserFacingJargon);
      }
    },
  );
});
