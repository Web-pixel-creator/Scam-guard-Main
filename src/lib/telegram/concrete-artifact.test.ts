import { describe, expect, it } from "vitest";
import { hasConcreteArtifact } from "@/lib/telegram/concrete-artifact";

describe("hasConcreteArtifact", () => {
  it.each([
    "https://example.com/login",
    "www.example.com",
    "example.com",
    "paypa1.uz",
    "пример.рф",
    "xn--e1afmkfd.xn--p1ai",
    "1.2.3.4",
    "t.me/example",
    "tg://resolve?domain=example",
    "@example_user",
    "+998 90 123 45 67",
    "номер 1340",
    "123456",
    "SMS-код 123456",
    "8600 1234 1234 1234",
    "повестка.pdf.apk",
  ])("detects a concrete checkable value in '%s'", (value) => {
    expect(hasConcreteArtifact(value)).toBe(true);
  });

  it.each([
    "Почему нельзя отправлять код?",
    "Можно ли сообщать номер карты?",
    "Почему ссылка может быть опасной?",
    "ты точно в этом уверен?",
    "я могу связаться с близким?",
    "invoice.pdf",
    "фото document.jpg",
    "встреча 2026-07-11",
  ])("does not mistake meta wording or an ordinary filename for an artifact in '%s'", (value) => {
    expect(hasConcreteArtifact(value)).toBe(false);
  });

  it("detects a bare domain inside a follow-up sentence", () => {
    expect(hasConcreteArtifact("Почему paypa1.uz подозрительный?")).toBe(true);
  });

  it("detects an actual short value but not a meta-question about codes", () => {
    expect(hasConcreteArtifact("123456")).toBe(true);
    expect(hasConcreteArtifact("Почему нельзя отправлять код?")).toBe(false);
  });
});
