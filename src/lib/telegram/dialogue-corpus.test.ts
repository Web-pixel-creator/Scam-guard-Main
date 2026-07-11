import type { RunCheckResult } from "@/lib/risk/check-core";
import { describe, expect, it } from "vitest";

import {
  buildAcknowledgementFollowUpText,
  buildImageUnreadableSnapshot,
  buildLastCheckFollowUpText,
  buildLastCheckSnapshot,
  buildOrphanCheckFollowUpText,
  classifyAcknowledgementFollowUp,
  classifyLastCheckFollowUp,
  classifyOrphanCheckFollowUp,
} from "@/lib/telegram/check-followup";
import { TELEGRAM_DIALOGUE_CORPUS } from "@/lib/telegram/dialogue-corpus";
import { getTelegramIntentContract } from "@/lib/telegram/intent-contract";
import type { LastCheckSnapshot, ReportDraft } from "@/lib/telegram/session.server";

const NOW = new Date("2026-07-11T18:30:00.000Z");

function result(level: RunCheckResult["level"]): RunCheckResult {
  return {
    type: "text",
    display: "[redacted]",
    level,
    score: 0,
    reasons: level === "high_risk" ? ["asks_for_sms_code"] : [],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
  };
}

function recentSnapshot(
  context: (typeof TELEGRAM_DIALOGUE_CORPUS)[number]["context"],
): LastCheckSnapshot {
  if (context === "recent_image_unreadable") return buildImageUnreadableSnapshot(NOW);
  const level = context.replace("recent_", "") as RunCheckResult["level"];
  return buildLastCheckSnapshot(result(level), NOW);
}

function scenario(snapshot: LastCheckSnapshot): ReportDraft {
  return { lastCheck: snapshot };
}

describe("canonical Telegram multi-turn dialogue corpus", () => {
  it("contains 1,248 unique RU/UZ/EN context rows", () => {
    expect(TELEGRAM_DIALOGUE_CORPUS).toHaveLength(1248);
    expect(new Set(TELEGRAM_DIALOGUE_CORPUS.map((row) => row.id)).size).toBe(1248);
    expect(new Set(TELEGRAM_DIALOGUE_CORPUS.map((row) => row.lang))).toEqual(
      new Set(["ru", "uz", "en"]),
    );
  });

  it.each(TELEGRAM_DIALOGUE_CORPUS)("routes $id according to its dialogue context", (row) => {
    const contract = getTelegramIntentContract(row.intentId);
    expect(contract.action).toBe("reply.followup");
    expect(contract.channels.direct?.persistence).toBe("forbidden");

    if (row.context.startsWith("recent_")) {
      const snapshot = recentSnapshot(row.context);
      const action = classifyLastCheckFollowUp(row.utterance, scenario(snapshot), NOW);
      expect(action).toBe(row.action);
      const text = buildLastCheckFollowUpText(action!, snapshot, row.lang);
      expect(text.trim().length).toBeGreaterThan(20);
      expect(text.length).toBeLessThanOrEqual(contract.response.maxChars);
      return;
    }

    if (row.context === "orphan") {
      const action =
        classifyOrphanCheckFollowUp(row.utterance) ??
        classifyAcknowledgementFollowUp(row.utterance);
      expect(action).toBe(row.action);
      const text =
        action === "acknowledgement"
          ? buildAcknowledgementFollowUpText(row.lang)
          : buildOrphanCheckFollowUpText(action!, row.lang);
      expect(text.trim().length).toBeGreaterThan(20);
      expect(text.length).toBeLessThanOrEqual(contract.response.maxChars);
      return;
    }

    if (row.context === "stale") {
      const stale = buildLastCheckSnapshot(
        result("suspicious"),
        new Date(NOW.getTime() - 21 * 60_000),
      );
      expect(classifyLastCheckFollowUp(row.utterance, scenario(stale), NOW)).toBeNull();
      return;
    }

    const snapshot = buildLastCheckSnapshot(result("suspicious"), NOW);
    expect(classifyLastCheckFollowUp(row.utterance, scenario(snapshot), NOW)).toBeNull();
    expect(classifyOrphanCheckFollowUp(row.utterance)).toBeNull();
    expect(classifyAcknowledgementFollowUp(row.utterance)).toBeNull();
    expect(getTelegramIntentContract("input.risk_check").channels.direct?.persistence).toBe(
      "required_check_row",
    );
  });
});
