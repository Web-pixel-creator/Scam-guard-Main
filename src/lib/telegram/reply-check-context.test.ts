import { describe, expect, it } from "vitest";
import type { LastCheckSnapshot, ReportDraft } from "@/lib/telegram/session.server";
import {
  MAX_REPLY_CHECK_CONTEXTS,
  REPLY_CHECK_CONTEXT_WINDOW_MS,
  rememberReplyCheckContext,
  resolveReplyCheckContext,
  resolveReplyGuardianContext,
} from "@/lib/telegram/reply-check-context";

const NOW = new Date("2026-07-16T12:00:00.000Z");

function snapshot(
  reasons: string[],
  at = NOW.toISOString(),
  level: LastCheckSnapshot["level"] = "suspicious",
): LastCheckSnapshot {
  return {
    level,
    type: "url",
    context: "generic",
    reasons,
    provenance: {
      methods: ["url_structure"],
      sources: ["visible_input"],
      limitations: ["signal_not_proof"],
    },
    at,
  };
}

describe("Telegram Reply check context", () => {
  it("resolves result A after result B was stored", () => {
    let data: ReportDraft = {};
    data = rememberReplyCheckContext(data, 101, snapshot(["weird_domain"]), NOW);
    data = rememberReplyCheckContext(data, 102, snapshot(["asks_for_sms_code"]), NOW);

    expect(resolveReplyCheckContext(data, 101, NOW)?.reasons).toEqual(["weird_domain"]);
    expect(resolveReplyCheckContext(data, 102, NOW)?.reasons).toEqual(["asks_for_sms_code"]);
  });

  it("binds Guardian guidance to the same outgoing message without raw evidence", () => {
    const guardian = {
      level: "high_risk" as const,
      type: "text" as const,
      reasons: ["asks_for_sms_code" as const],
      at: NOW.toISOString(),
    };
    const data = rememberReplyCheckContext(
      {},
      101,
      snapshot(["asks_for_sms_code"], NOW.toISOString(), "high_risk"),
      NOW,
      guardian,
    );

    expect(resolveReplyGuardianContext(data, 101, NOW)).toEqual(guardian);
    expect(resolveReplyGuardianContext(data, 999, NOW)).toBeNull();
  });

  it("deduplicates message ids and keeps only the bounded newest window", () => {
    let data: ReportDraft = {};
    for (let index = 1; index <= MAX_REPLY_CHECK_CONTEXTS + 4; index += 1) {
      data = rememberReplyCheckContext(data, index, snapshot([`reason_${index}`]), NOW);
    }
    data = rememberReplyCheckContext(data, MAX_REPLY_CHECK_CONTEXTS + 4, snapshot(["latest"]), NOW);

    expect(data.replyCheckContexts).toHaveLength(MAX_REPLY_CHECK_CONTEXTS);
    expect(resolveReplyCheckContext(data, 1, NOW)).toBeNull();
    expect(resolveReplyCheckContext(data, MAX_REPLY_CHECK_CONTEXTS + 4, NOW)?.reasons).toEqual([
      "latest",
    ]);
  });

  it("expires a binding at the same 20 minute boundary as normal follow-ups", () => {
    const old = new Date(NOW.getTime() - REPLY_CHECK_CONTEXT_WINDOW_MS - 1).toISOString();
    const data = rememberReplyCheckContext({}, 101, snapshot(["weird_domain"], old), NOW);

    expect(resolveReplyCheckContext(data, 101, NOW)).toBeNull();
  });

  it("rebuilds persisted JSON without raw or malformed fields", () => {
    const data = {
      replyCheckContexts: [
        {
          messageId: 101,
          snapshot: {
            ...snapshot(["weird_domain"]),
            display: "https://secret.example/token",
            raw: "OTP 123456",
            reasons: ["weird_domain", "bad reason with spaces"],
          },
          quotedText: "password: secret",
        },
      ],
    } as unknown as ReportDraft;

    const resolved = resolveReplyCheckContext(data, 101, NOW);
    expect(resolved).toEqual({
      ...snapshot(["weird_domain"]),
      reasons: ["weird_domain"],
    });
    expect(JSON.stringify(resolved)).not.toContain("secret");
    expect(JSON.stringify(resolved)).not.toContain("123456");
  });

  it("rejects invalid Telegram message ids", () => {
    const data = rememberReplyCheckContext({}, -1, snapshot(["weird_domain"]), NOW);
    expect(data.replyCheckContexts).toBeUndefined();
    expect(resolveReplyCheckContext(data, -1, NOW)).toBeNull();
  });
});
