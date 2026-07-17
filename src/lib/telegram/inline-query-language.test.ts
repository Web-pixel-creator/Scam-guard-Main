import { describe, expect, it } from "vitest";

import { ADVERSARIAL_HUMAN_SCENARIO_CORPUS } from "@/lib/telegram/adversarial-human-scenario-corpus";
import { resolveInlineQueryLanguage } from "@/lib/telegram/inline-query-language";

describe("resolveInlineQueryLanguage", () => {
  it.each([
    ["Bank operatsiyasini bekor qilish uchun SMS kodni ayting", "ru", "uz"],
    ["Shaxsni tasdiqlash uchun pasport rasmini yuboring", "ru", "uz"],
    ["A bank agent says I must tell them the SMS code to cancel a transaction", "ru", "en"],
    ["Should I trust this payment link?", "uz", "en"],
    ["Пришел SМS-кoд и просят егo сказать", "en", "ru"],
    ["Менга кодни айтинг", "ru", "uz"],
    ["СМС кодни айтинг деб ёзишяпти", "ru", "uz"],
    ["Kod beraymi?", "ru", "uz"],
    ["Tell OTP?", "ru", "en"],
    ["рахмат катта рахмат", "ru", "uz"],
    ["telefon qilishdi bankdan deb kod so'rashyapti aytmadim to'g'ri qildimmi", "en", "uz"],
    ["bezopasniy schyotga pul o'tkazing deyishyapti", "ru", "uz"],
    ["ishga olamiz kuniga 500 ming avval 200 ming komissiya to'lang", "ru", "uz"],
  ] as const)("detects %s", (text, fallback, expected) => {
    expect(resolveInlineQueryLanguage(text, fallback)).toBe(expected);
  });

  it.each([
    ["https://example.com", "uz"],
    ["@lucky_promo_qa", "en"],
    ["seed phrase: apple bicycle candle", "ru"],
    ["SMS code", "ru"],
  ] as const)("keeps %s on the saved language when evidence is weak", (text, fallback) => {
    expect(resolveInlineQueryLanguage(text, fallback)).toBe(fallback);
  });

  it.each([
    ["Мне позвонили из банка и попросили код", "en", "ru"],
    ["The bank called and asked for my phone code", "uz", "en"],
  ] as const)("does not steal a clearly non-Uzbek sentence: %s", (text, fallback, expected) => {
    expect(resolveInlineQueryLanguage(text, fallback)).toBe(expected);
  });

  it("detects all natural-language variants in the RU/UZ/EN adversarial corpus", () => {
    const fallbackByLanguage = { ru: "en", uz: "ru", en: "uz" } as const;
    const misses = ADVERSARIAL_HUMAN_SCENARIO_CORPUS.flatMap((scenario) => {
      const actual = resolveInlineQueryLanguage(scenario.query, fallbackByLanguage[scenario.lang]);
      return actual === scenario.lang ? [] : [`${scenario.id}: ${actual}`];
    });

    expect(misses).toEqual([]);
  });
});
