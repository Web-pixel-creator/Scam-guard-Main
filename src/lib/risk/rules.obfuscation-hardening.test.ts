import { describe, expect, it } from "vitest";

import { evaluateText } from "@/lib/risk/rules";

describe("risk rules — bounded text obfuscation hardening", () => {
  it.each([
    ["п р и ш л и т е к о д и з с м с", "asks_for_sms_code"],
    ["Пришлите к0д из смс срочн0", "asks_for_sms_code"],
    ["s e n d s m s c o d e", "asks_for_sms_code"],
  ] as const)("keeps an obfuscated secret request detectable: %s", (text, reason) => {
    expect(evaluateText(text)).toContain(reason);
  });

  it("keeps the urgency signal after a bounded zero-leet repair", () => {
    expect(evaluateText("Пришлите к0д из смс срочн0")).toContain("uses_urgency");
  });

  it.each([
    "Код из SMS никому не сообщайте.",
    "Мой код домофона 1234.",
    "Модель XR0, квартира 10.",
    "А Б В Г Д",
    "С М С",
  ])("does not invent a dangerous request from benign text: %s", (text) => {
    expect(evaluateText(text)).not.toContain("asks_for_sms_code");
  });
});
