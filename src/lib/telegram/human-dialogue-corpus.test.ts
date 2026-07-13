import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "@/lib/meta-intent";
import {
  HUMAN_DIALOGUE_CONTEXTS,
  HUMAN_DIALOGUE_CORPUS,
  HUMAN_DIALOGUE_TOPICS,
} from "@/lib/telegram/human-dialogue-corpus";
import {
  canonicalMetaIntentId,
  enforceTelegramReplyContract,
  getTelegramIntentContract,
} from "@/lib/telegram/intent-contract";

// These tests exercise deterministic routing and localized templates only.
// They neither train a model nor represent 1,008 independent live Telegram
// chats. Every external network attempt is a test failure.
describe("curated human-style Telegram meta-dialogue corpus", () => {
  let fetchGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchGuard = vi.fn(() => {
      throw new Error("human dialogue corpus must not access the network");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("contains exactly 1,008 unique and evenly balanced context cases", () => {
    expect(HUMAN_DIALOGUE_TOPICS).toHaveLength(14);
    expect(HUMAN_DIALOGUE_CONTEXTS).toEqual(["fresh", "after_result", "after_help"]);
    expect(HUMAN_DIALOGUE_CORPUS).toHaveLength(1008);
    expect(new Set(HUMAN_DIALOGUE_CORPUS.map((row) => row.id)).size).toBe(1008);
    expect(new Set(HUMAN_DIALOGUE_CORPUS.map((row) => row.utterance)).size).toBe(1008);

    for (const topic of HUMAN_DIALOGUE_TOPICS) {
      const topicRows = HUMAN_DIALOGUE_CORPUS.filter((row) => row.topic === topic);
      expect(topicRows, topic).toHaveLength(72);

      for (const lang of ["ru", "uz", "en"] as const) {
        for (const context of HUMAN_DIALOGUE_CONTEXTS) {
          const slice = topicRows.filter((row) => row.lang === lang && row.context === context);
          expect(slice, `${topic}/${lang}/${context}`).toHaveLength(8);
          expect(new Set(slice.map((row) => row.variant))).toEqual(
            new Set([1, 2, 3, 4, 5, 6, 7, 8]),
          );
        }
      }
    }

    for (const lang of ["ru", "uz", "en"] as const) {
      expect(
        HUMAN_DIALOGUE_CORPUS.filter((row) => row.lang === lang),
        `language ${lang}`,
      ).toHaveLength(336);
    }

    for (const context of HUMAN_DIALOGUE_CONTEXTS) {
      expect(
        HUMAN_DIALOGUE_CORPUS.filter((row) => row.context === context),
        `context ${context}`,
      ).toHaveLength(336);
    }
  });

  it.each(HUMAN_DIALOGUE_CORPUS)("classifies $id as $expectedIntent", (row) => {
    expect(classifyMetaIntent(row.utterance), row.utterance).toBe(row.expectedIntent);
  });

  it("returns nonempty localized human-readable replies for every expected intent", () => {
    const intentIds = new Set(HUMAN_DIALOGUE_CORPUS.map((row) => row.expectedIntent));
    const forbiddenJargon =
      /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|threshold|weight|routing table)\b/iu;

    for (const intent of intentIds) {
      const replies = (["ru", "uz", "en"] as const).map((lang) =>
        getMetaIntentResponse(intent, lang),
      );

      expect(new Set(replies).size, `localized ${intent}`).toBe(3);
      for (const reply of replies) {
        expect(reply.trim().length, intent).toBeGreaterThan(20);
        expect(reply.length, intent).toBeLessThanOrEqual(4096);
        expect(reply, intent).not.toBe(`meta_${intent}`);
        expect(reply, intent).not.toMatch(forbiddenJargon);
        expect(reply, intent).not.toMatch(/\{[a-zA-Z0-9_]+\}/u);
        expect(reply, intent).not.toMatch(/\?{3,}|!{4,}/u);
      }
    }
  });

  it("keeps every corpus route reply-only and free of check/contact side effects", () => {
    for (const row of HUMAN_DIALOGUE_CORPUS) {
      const intentId = canonicalMetaIntentId(row.expectedIntent);
      const contract = getTelegramIntentContract(intentId);
      const response = getMetaIntentResponse(row.expectedIntent, row.lang);

      expect(contract.family, row.id).toBe("meta");
      expect(contract.action, row.id).toBe("reply.meta");
      expect(contract.context, row.id).toBe("none");
      expect(contract.channels.direct, row.id).toEqual({
        persistence: "forbidden",
        trustedContact: "forbidden",
      });
      expect(contract.channels.inline, row.id).toBeUndefined();
      expect(enforceTelegramReplyContract(intentId, "direct", response), row.id).toBe(response);
    }
  });

  it.each([
    ["link", "Можешь проверить ссылку https://bank-check.example/login?"],
    ["phone", "Can you check this phone number +998 90 000 00 00?"],
    ["image", "Проверишь скриншот с адресом https://image-check.example/view?"],
    ["account", "Telegram akkauntini tekshirasizmi: @qa_example_user?"],
    ["message", "Can you check this message: your bank card is blocked, send the SMS code"],
    ["qr", "Проверишь QR-код, он открыл https://qr-check.example/login?"],
  ])("does not intercept a capability phrase carrying an actual %s artifact", (_kind, text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it("does not intercept forwarded text as a bot meta-question", () => {
    for (const row of HUMAN_DIALOGUE_CORPUS) {
      expect(classifyMetaIntent(row.utterance, { isForwarded: true }), row.id).toBeNull();
    }
  });

  it("types every corpus expectation as a canonical MetaIntent", () => {
    const assertMetaIntent = (_intent: MetaIntent): void => undefined;
    for (const row of HUMAN_DIALOGUE_CORPUS) assertMetaIntent(row.expectedIntent);
  });
});
