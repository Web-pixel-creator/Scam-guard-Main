// Gratitude and identity coverage — regressions from the 2026-07-16 elderly
// QA run. Blessed/endearing gratitude and "who are you / is it free" openers
// previously fell through to the generic "not enough data" verdict card.
import { describe, expect, it } from "vitest";

import {
  buildOrphanCheckFollowUpText,
  classifyAcknowledgementFollowUp,
  classifyOrphanCheckFollowUp,
} from "@/lib/telegram/check-followup";

describe("pure gratitude phrases", () => {
  const gratitude = [
    "спасибо дорогой дай бог здоровья",
    "спасибо большое",
    "Спасибо, дорогая!",
    "рахмат катта рахмат",
    "катта рахмат сизга",
    "raxmat katta raxmat",
    "rahmat sizga",
    "thank you so much",
    "thanks a lot",
  ];

  it.each(gratitude)("acknowledges %s with and without a recent check", (text) => {
    expect(classifyAcknowledgementFollowUp(text)).toBe("acknowledgement");
    expect(classifyOrphanCheckFollowUp(text)).toBe("acknowledgement");
  });

  it("keeps gratitude wrapped around a real question out of the acknowledgement path", () => {
    for (const text of [
      "спасибо а это точно безопасно",
      "рахмат лекин кодни айтдим нима қилай",
      "thanks but what about the link",
    ]) {
      expect(classifyAcknowledgementFollowUp(text)).toBeNull();
    }
  });

  it("keeps ambiguous bare acks out of the orphan path", () => {
    for (const text of ["ок", "понял", "хорошо"]) {
      expect(classifyOrphanCheckFollowUp(text)).toBeNull();
    }
  });

  it("renders a warm localized orphan acknowledgement", () => {
    for (const lang of ["ru", "uz", "en"] as const) {
      const reply = buildOrphanCheckFollowUpText("acknowledgement", lang);
      expect(reply.length).toBeGreaterThan(20);
      expect(reply).not.toMatch(/недостаточно данных|yetarli emas|not enough data/i);
    }
  });
});

describe("identity and is-it-free openers", () => {
  const identity = [
    "ты кто такой",
    "ты кто такой это бесплатно?",
    "а вы кто такие",
    "кто ты такой?",
    "это бесплатно?",
    "сколько это стоит",
    "Siz kimsiz botmisiz odammisiz",
    "bu bepulmi",
    "is it free",
  ];

  it.each(identity)("routes %s to the identity answer", (text) => {
    expect(classifyOrphanCheckFollowUp(text)).toBe("identity");
  });

  it("mentions that the service is free in every language", () => {
    for (const lang of ["ru", "uz", "en"] as const) {
      expect(buildOrphanCheckFollowUpText("identity", lang)).toMatch(/бесплатн|bepul|free/i);
    }
  });

  it("does not swallow real check payloads", () => {
    expect(classifyOrphanCheckFollowUp("кто ты такой посмотри http://kapita1bank.uz")).toBeNull();
    expect(classifyOrphanCheckFollowUp("бесплатно установить apk который прислали?")).toBeNull();
  });
});
