import { describe, expect, it } from "vitest";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

describe("normalizeIntentTextForMatching", () => {
  it.each([
    ["кoд", "код"],
    ["SМS", "sms"],
    ["pаssword", "password"],
    ["parоl", "parol"],
    ["перевoд", "перевод"],
  ])("repairs one isolated visual confusable in %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });

  it("normalizes compatibility characters, apostrophes, zero-width characters, and spacing", () => {
    expect(normalizeIntentTextForMatching("  ＯＴＰ\u200B  O‘RNATDIM\u2060\n  ")).toBe(
      "otp o'rnatdim",
    );
  });

  it.each([
    ["S\u2066MS-код", "sms-код"],
    ["ко\u202Eд", "код"],
    ["pass\u00ADword", "password"],
    ["OT\uFE0FP", "otp"],
  ])("removes invisible and bidi formatting controls from %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });

  it.each([
    ["AБ", "aб"],
    ["testЖЖ", "testжж"],
    ["abcЖdef", "abcжdef"],
    ["PayPalМосква", "paypalмосква"],
  ])(
    "does not rewrite balanced, non-isolated, or non-confusable mixed-script text %s",
    (input, expected) => {
      expect(normalizeIntentTextForMatching(input)).toBe(expected);
    },
  );

  it("is an intent-only derived value and does not mutate the original input", () => {
    const original = 'Password: "pаssword"';

    expect(normalizeIntentTextForMatching(original)).toBe('password: "password"');
    expect(original).toBe('Password: "pаssword"');
  });

  it.each([
    ["п р и ш л и т е к о д и з с м с", "пришлите код из смс"],
    ["s e n d s m s c o d e", "send sms code"],
    ["Пришлите к0д из смс срочн0", "пришлите код из смс срочно"],
    ["Введите п0р0ль или 0TP", "введите пароль или otp"],
  ])("repairs bounded security-term obfuscation in %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });

  it.each([
    ["А Б В Г Д", "а б в г д"],
    ["Модель XR0, квартира 10", "модель xr0, квартира 10"],
    ["Версия code0 и пароль2", "версия code0 и пароль2"],
  ])("does not rewrite unrelated initials, model names, or numbers in %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });
});
