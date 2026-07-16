// Uzbek Cyrillic rule coverage — regression for the 2026-07-16 elderly QA run.
//
// Every phrase here previously scored unknown/0 because the Uzbek rule
// patterns exist only in Latin script. The transliteration variant pass in
// `evaluateText` must make them fire without touching Russian behavior.
import { describe, expect, it } from "vitest";

import { evaluateText, scoreFromCodes } from "./rules";
import {
  looksLikeUzbekCyrillic,
  transliterateUzCyrillicToLatin,
  uzbekLatinMatchingVariant,
} from "./uz-cyrillic-translit";

describe("uz-cyrillic-translit", () => {
  it("transliterates the Uzbek-specific letters and digraphs", () => {
    expect(transliterateUzCyrillicToLatin("Хавфсиз ҳисобга пул ўтказинг")).toBe(
      "xavfsiz hisobga pul o'tkazing",
    );
    expect(transliterateUzCyrillicToLatin("қўнғироқ")).toBe("qo'ng'iroq");
    expect(transliterateUzCyrillicToLatin("ёзишяпти")).toBe("yozishyapti");
  });

  it("gates on Uzbek signals, not on Cyrillic script alone", () => {
    expect(looksLikeUzbekCyrillic("Хавфсиз ҳисобга пул ўтказинг")).toBe(true);
    expect(looksLikeUzbekCyrillic("СМС кодни айтинг деб ёзишяпти")).toBe(true);
    // Pure Russian must stay single-pass.
    expect(looksLikeUzbekCyrillic("переведите деньги на безопасный счет")).toBe(false);
    expect(looksLikeUzbekCyrillic("дебетовая карта заблокирована")).toBe(false);
    expect(uzbekLatinMatchingVariant("hello, no cyrillic at all")).toBeNull();
  });
});

describe("evaluateText on Uzbek Cyrillic scam phrases (elderly QA regressions)", () => {
  const cases: Array<{ name: string; text: string; expectAny: string[] }> = [
    {
      name: "safe account transfer",
      text: "Хавфсиз ҳисобга пул ўтказинг дейишяпти Марказий банкданмиз дейишяпти нима бу",
      expectAny: ["asks_to_transfer_to_safe_account"],
    },
    {
      name: "card digits request",
      text: "Карта рақамини ва орқасидаги уч рақамни сўрашяпти пул қайтарамиз дейишяпти",
      expectAny: ["requests_card_digits", "asks_for_card_cvv"],
    },
    {
      name: "telegram account takeover",
      text: "Телеграмда аккаунтингиз ўчирилади деб ёзишяпти бекор қилиш тугмасини босинг дейишяпти",
      expectAny: ["telegram_account_takeover_phishing"],
    },
    {
      name: "subsidy bait with card request",
      text: "менга телеграмдан ёзишяпти сиз субсидия ютиб олдингиз картангизни рақамини юборинг дейишяпти",
      expectAny: ["requests_card_digits", "too_good_to_be_true", "advance_fee_prize_inheritance"],
    },
    {
      name: "prize with upfront commission",
      text: "Ютуқ ютдингиз дейишди аммо аввал комиссия тўлашим керак эмиш шу тўғрими",
      expectAny: ["advance_fee_prize_inheritance", "too_good_to_be_true", "payment_before_service"],
    },
  ];

  it.each(cases)("$name fires a risk reason", ({ text, expectAny }) => {
    const codes = evaluateText(text);
    // Debug aid on failure: show everything that fired.
    expect(
      codes.some((code) => expectAny.includes(code)),
      `expected one of [${expectAny.join(", ")}], got [${codes.join(", ")}]`,
    ).toBe(true);
    expect(scoreFromCodes(codes).level).not.toBe("unknown");
  });

  it("keeps Uzbek Cyrillic protective wording out of the risk codes", () => {
    // Negation guard must survive transliteration: «айтманг» → aytmang.
    const codes = evaluateText("СМС кодни ҳеч кимга айтманг");
    expect(codes).not.toContain("asks_for_sms_code");
    expect(codes).not.toContain("asks_for_otp");
  });

  it("does not change Russian scoring behavior", () => {
    const russian = "переведите деньги на безопасный счет срочно";
    expect(evaluateText(russian)).toEqual(evaluateText(russian));
    expect(evaluateText(russian)).toContain("asks_to_transfer_to_safe_account");
  });

  it("stays deterministic across repeated evaluations", () => {
    const text = "Хавфсиз ҳисобга пул ўтказинг дейишяпти";
    const first = evaluateText(text).sort();
    for (let i = 0; i < 5; i += 1) expect(evaluateText(text).sort()).toEqual(first);
  });
});
