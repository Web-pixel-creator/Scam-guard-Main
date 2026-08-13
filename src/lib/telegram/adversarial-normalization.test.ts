import { describe, expect, it } from "vitest";

import { evaluateText } from "@/lib/risk/rules";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";
import { resolveInlineQueryLanguage } from "@/lib/telegram/inline-query-language";

describe("bounded adversarial intent normalization", () => {
  it.each([
    ["ко\u200Bд из с\u2060мс", "код из смс"],
    ["ＳＥＮＤ　ＣＯＤＥ", "send code"],
    ["к 0 д / с м с", "код / смс"],
    ["s3nd c0d3", "send code"],
    ["Please send cоdе now", "please send code now"],
    ["SМS cоdе: 731904", "sms code: 731904"],
  ])("repairs the bounded danger anchor in %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });

  it.each([
    ["+998 90 123 45 67", "+998 90 123 45 67"],
    ["Model S3ND-C0D3, XR0", "model s3nd-c0d3, xr0"],
    ["Model C0DE-2024", "model c0de-2024"],
    ["Model CОDЕ-7", "model cоdе-7"],
    ["Model S M S-2024", "model s m s-2024"],
    ["Модель к о д-7", "модель к о д-7"],
    ["I asked about source cоdе review", "i asked about source cоdе review"],
    ["SMS cоdе:", "sms cоdе:"],
    ["Model SMS-CОDЕ-731904", "model sms-cоdе-731904"],
    ["ordinary s3nd notes and c0d3 draft", "ordinary s3nd notes and c0d3 draft"],
    ["codebase c0d30", "codebase c0d30"],
    ["The model is S3ND C0D3", "the model is s3nd c0d3"],
    ["Identifier S3ND C0D3", "identifier s3nd c0d3"],
    ["Reference value: S3ND C0D3", "reference value: s3nd c0d3"],
    ["The source code label is S3ND C0D3", "the source code label is s3nd c0d3"],
    ["The game title is S3ND C0D3", "the game title is s3nd c0d3"],
    ["The center cоdе label", "the center cоdе label"],
  ])("does not rewrite phone, model, or ordinary text %s", (input, expected) => {
    expect(normalizeIntentTextForMatching(input)).toBe(expected);
  });

  it.each([
    "The model is S3ND C0D3",
    "Identifier S3ND C0D3",
    "Reference value: S3ND C0D3",
    "The source code label is S3ND C0D3",
    "The game title is S3ND C0D3",
  ])("does not create an SMS-code reason for labeled text %s", (input) => {
    expect(evaluateText(input)).not.toContain("asks_for_sms_code");
  });

  it("still detects the spaced leet anchor in an explicit request", () => {
    expect(evaluateText("They ask me to S3ND C0D3")).toContain("asks_for_sms_code");
  });

  it.each([
    ["The bank called and asked me to send cоdе", "uz", "en"],
    ["The product model CОDЕ-7 is on this card", "uz", "en"],
    ["I asked about source cоdе review", "uz", "en"],
    ["Я", "en", "ru"],
    ["raqamni tashlab yubordim", "ru", "uz"],
    ["pulni jo'natvordim", "ru", "uz"],
    ["Model RAQAMNI-TASHLAB-YUBORDIM", "en", "en"],
    ["Модель PULNI-JO'NATVORDIM", "ru", "ru"],
  ] as const)("keeps language resolution stable for %s", (input, fallback, expected) => {
    expect(resolveInlineQueryLanguage(input, fallback)).toBe(expected);
  });

  it("keeps the displayed/raw value untouched", () => {
    const raw = "Send cоdе\u200B: S3ND C0D3";

    expect(normalizeIntentTextForMatching(raw)).toBe("send code: send code");
    expect(raw).toBe("Send cоdе\u200B: S3ND C0D3");
  });
});
