import { describe, expect, it } from "vitest";

import {
  classifyLiveCallContext,
  classifyTextPanicIntent,
  classifyVoicePanicIntent,
  isNegatedVoiceDoneIntent,
  normalizeVoiceIntentText,
} from "@/lib/telegram/text-panic-intent";

describe("pure Telegram text panic intent", () => {
  it.each([
    ["Я уже отправил код из SMS.", 1],
    ["I installed AnyDesk and allowed screen access.", 2],
    ["Men pul o'tkazdim.", 3],
    ["I already sent my CVV.", 4],
    ["Я отсканировал QR для входа в Telegram.", 5],
    ["Мне сейчас звонят из банка.", 6],
    ["ya perevel dengi na kartu", 3],
  ] as const)("classifies an active or already-completed emergency: %s", (text, panicId) => {
    expect(classifyTextPanicIntent(text)).toBe(panicId);
  });

  it.each([
    "Я не отправил код.",
    "Я уже почти сказала код, но решила сначала спросить.",
    "Я чуть не назвал код из SMS.",
    "Men kodni yubormadim.",
    "I did not send the verification code.",
    "I almost shared the SMS code but stopped.",
    "Men pul o'tkazmayman.",
  ])("keeps a negated action outside panic: %s", (text) => {
    expect(isNegatedVoiceDoneIntent(text)).toBe(true);
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it.each([
    "Мама уже сообщила им код.",
    "Мошенник написал: я уже перевёл деньги.",
    "Scammer wrote: I already sent the money.",
    "U kishi aytdi: men kodni yubordim.",
    "They asked me to send a code.",
  ])("does not invent a first-person completed emergency: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it("does not issue live-call panic instructions for a completed Uzbek call report", () => {
    expect(
      classifyTextPanicIntent("Menga turli noma'lum raqamlardan qayta-qayta qo'ng'iroq qilishdi."),
    ).toBeNull();
    expect(classifyTextPanicIntent("Menga noma'lum raqam qo'ng'iroq qilishyapti.")).toBe(6);
  });

  it.each([
    "Menga akam qo'ng'iroq qildi, shoshilinch pul so'radi",
    "Menga Beeline operatori telefon qildi, raqam bloklanadi deyapti",
    "Menga Soliqdan qo'ng'iroq qildi, SMS kod so'radi",
  ])("keeps an Uzbek call with an explicit active danger on panic guidance: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBe(6);
  });

  it("does not treat forwarded text as the sender's emergency", () => {
    expect(
      classifyTextPanicIntent("Я уже отправил код из SMS.", {
        kind: "channel",
        title: "Example",
        username: "example_channel",
      }),
    ).toBeNull();
  });

  it.each([
    ["Мне сейчас звонят, сын срочно просит деньги.", "relative"],
    ["Мне сейчас звонят из налоговой и просят PINFL.", "government"],
    ["Menga hozir Beeline operatori qo'ng'iroq qilyapti.", "operator"],
    ["A bank caller is on the line.", "bank"],
    ["Someone is calling me right now.", "generic"],
  ] as const)("classifies live-call context in priority order: %s", (text, context) => {
    expect(classifyVoicePanicIntent(text)).toBe(6);
    expect(classifyLiveCallContext(text)).toBe(context);
  });

  it("normalizes Unicode apostrophes and Uzbek Cyrillic letters deterministically", () => {
    expect(normalizeVoiceIntentText("  ҚЎҒИРЎҚ  O‘RNATDIM  ")).toBe("кугирук o'rnatdim");
  });

  it.each([
    "код уже продиктовала им",
    "я им назвала цифры из смс",
    "они уже знают мой код",
    "сказала им шесть цифр которые пришли",
    "raqamlarni aytvordim",
    "sms kodni aytvordim",
  ])("routes a colloquial completed code disclosure to aftercare: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBe(1);
  });

  it.each(["pulni otkazvordim", "pulni o'tkazvordim"])(
    "routes a colloquial completed transfer to aftercare: %s",
    (text) => {
      expect(classifyTextPanicIntent(text)).toBe(3);
    },
  );

  it.each([
    "Код уже продиктовала мама.",
    "Он сказал: «они уже знают мой код».",
    "Они знают мой код домофона.",
    "Raqamlarni aytvormadim.",
    "Pulni otkazvormadim.",
  ])("does not turn third-party, physical-access, or negated text into aftercare: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
  });
});
