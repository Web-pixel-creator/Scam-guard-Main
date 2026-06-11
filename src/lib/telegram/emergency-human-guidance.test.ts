import { describe, expect, it } from "vitest";
import { buildPanicScenarioText } from "@/lib/telegram/emergency";

function firstContentLine(text: string): string {
  return text.split("\n").find((line, index) => index > 0 && line.trim().length > 0) ?? "";
}

describe("panic scenario first card human guidance", () => {
  it("keeps the urgent APK action first while adding a human cue", () => {
    const text = buildPanicScenarioText(2, "ru");

    expect(firstContentLine(text)).toContain("ВКЛЮЧИТЕ АВИАРЕЖИМ");
    expect(text).toContain("Я рядом");
    expect(text).toContain("Сначала изолируем телефон");
    expect(text).toContain("SMS и уведомления");
  });

  it("keeps the urgent card action first while explaining why to block it", () => {
    const text = buildPanicScenarioText(4, "ru");

    expect(firstContentLine(text)).toContain("ЗАБЛОКИРУЙТЕ КАРТУ");
    expect(text).toContain("Сначала закрываем карту");
    expect(text).toContain("данные уже могли попасть к посторонним");
  });

  it("keeps the live-call hang-up command first and does not sound generic", () => {
    const text = buildPanicScenarioText(6, "ru");

    expect(firstContentLine(text)).toContain("ЗАВЕРШИТЕ ЗВОНОК");
    expect(text).toContain("Не доказывайте ничего по телефону");
    expect(text).toContain("настоящий банк спокойно дождётся");
  });
});
