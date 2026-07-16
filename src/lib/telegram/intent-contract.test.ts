import { describe, expect, it } from "vitest";

import { ALL_META_INTENTS } from "@/lib/meta-intent";
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  classifyAcknowledgementFollowUp,
  classifyOrphanCheckFollowUp,
} from "@/lib/telegram/check-followup";
import { PANIC_SCENARIO_IDS } from "@/lib/telegram/emergency";
import {
  canonicalFollowUpIntentId,
  canonicalPanicIntentId,
  canonicalVictimIntentId,
  enforceTelegramReplyContract,
  getTelegramIntentContract,
  TELEGRAM_INTENT_CONTRACTS,
} from "@/lib/telegram/intent-contract";
import { LIVE_PHRASE_CASES } from "@/lib/telegram/live-phrase-cases";
import { ALL_VICTIM_INTENTS } from "@/lib/telegram/victim-intent";

describe("canonical Telegram intent/action contract", () => {
  it("contains exactly one contract for every supported intent family", () => {
    const expectedCount =
      ALL_META_INTENTS.length +
      ALL_VICTIM_INTENTS.length +
      ALL_LAST_CHECK_FOLLOW_UP_ACTIONS.length +
      PANIC_SCENARIO_IDS.length +
      1;

    expect(TELEGRAM_INTENT_CONTRACTS).toHaveLength(expectedCount);
    expect(new Set(TELEGRAM_INTENT_CONTRACTS.map((contract) => contract.id)).size).toBe(
      expectedCount,
    );
  });

  it("forbids check rows and trusted-contact effects for every reply-only intent", () => {
    const replyOnly = TELEGRAM_INTENT_CONTRACTS.filter((contract) =>
      ["reply.meta", "reply.victim_guidance", "reply.followup"].includes(contract.action),
    );

    expect(replyOnly.length).toBeGreaterThan(60);
    for (const contract of replyOnly) {
      expect(contract.channels.direct).toEqual({
        persistence: "forbidden",
        trustedContact: "forbidden",
      });
      expect(contract.response.localized).toBe(true);
      expect(contract.response.nonAccusatory).toBe(true);
      expect(contract.response.rawEvidencePersistence).toBe("forbidden");
    }
  });

  it("keeps direct and Inline risk-check persistence boundaries distinct", () => {
    const contract = getTelegramIntentContract("input.risk_check");

    expect(contract.action).toBe("run.risk_check");
    expect(contract.channels.direct).toEqual({
      persistence: "required_check_row",
      trustedContact: "high_risk_only",
    });
    expect(contract.channels.inline).toEqual({
      persistence: "forbidden",
      trustedContact: "forbidden",
    });
  });

  it("enforces reply-only channel and Telegram length limits at runtime", () => {
    expect(enforceTelegramReplyContract("followup.confidence", "direct", "safe reply")).toBe(
      "safe reply",
    );
    expect(() =>
      enforceTelegramReplyContract("followup.confidence", "inline", "unsupported"),
    ).toThrow("does not support inline");
    expect(() => enforceTelegramReplyContract("input.risk_check", "direct", "reply")).toThrow(
      "not reply-only",
    );
    expect(() =>
      enforceTelegramReplyContract("followup.confidence", "direct", "x".repeat(4097)),
    ).toThrow("exceeds contract limit");
  });

  it("maps every existing 238-row live phrase expectation to a canonical contract", () => {
    expect(LIVE_PHRASE_CASES).toHaveLength(238);

    for (const row of LIVE_PHRASE_CASES) {
      if (row.expected.kind === "victim_intent") {
        expect(getTelegramIntentContract(canonicalVictimIntentId(row.expected.intent)).action).toBe(
          "reply.victim_guidance",
        );
        continue;
      }
      if (row.expected.kind === "panic") {
        expect(getTelegramIntentContract(canonicalPanicIntentId(row.expected.panicId)).action).toBe(
          "open.emergency",
        );
        continue;
      }
      if (row.expected.kind === "risk_pipeline") {
        expect(getTelegramIntentContract("input.risk_check").action).toBe("run.risk_check");
        continue;
      }
      if (row.expected.route === "sensitive_secret") {
        expect(getTelegramIntentContract(canonicalVictimIntentId("code_request")).action).toBe(
          "reply.victim_guidance",
        );
        continue;
      }

      const action =
        classifyOrphanCheckFollowUp(row.text) ?? classifyAcknowledgementFollowUp(row.text);
      expect(action, row.text).not.toBeNull();
      expect(getTelegramIntentContract(canonicalFollowUpIntentId(action!)).action).toBe(
        "reply.followup",
      );
    }
  });
});
