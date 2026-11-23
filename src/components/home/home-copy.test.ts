import { describe, expect, it } from "vitest";

import { getPublicEmergencyContacts } from "@/lib/risk/public-emergency-contacts";
import { HOME_COPY } from "./home-copy";

type Shape = string | number | Shape[] | { [key: string]: Shape };

// Reduce copy to its structure: keys, array lengths and "non-empty string".
function shape(value: unknown): Shape {
  if (typeof value === "string") return value.trim().length > 0 ? "text" : "EMPTY";
  if (Array.isArray(value)) return value.map((item) => shape(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, inner]) => [name, shape(inner)]),
    );
  }
  return typeof value;
}

describe("homepage copy", () => {
  it("has an urgent card for every verified public emergency number", () => {
    for (const lang of ["ru", "uz", "en"] as const) {
      const dials = getPublicEmergencyContacts(lang).map((contact) => contact.dial);
      expect(Object.keys(HOME_COPY[lang].urgent.cards).sort()).toEqual([...dials].sort());
    }
  });

  it("has the same complete structure in every language", () => {
    const ru = shape(HOME_COPY.ru);
    expect(JSON.stringify(ru)).not.toContain("EMPTY");
    expect(shape(HOME_COPY.uz)).toEqual(ru);
    expect(shape(HOME_COPY.en)).toEqual(ru);
  });

  it("pairs every emphasis marker and keeps them out of the FAQ", () => {
    // `**phrase**` is rendered bold by the page; an odd count would leak a
    // literal "**". FAQ text feeds JSON-LD, which must equal the visible text.
    const strings = (value: unknown): string[] =>
      typeof value === "string"
        ? [value]
        : Array.isArray(value)
          ? value.flatMap(strings)
          : value && typeof value === "object"
            ? Object.values(value).flatMap(strings)
            : [];
    for (const lang of ["ru", "uz", "en"] as const) {
      for (const text of strings(HOME_COPY[lang])) {
        const parts = text.split("**");
        expect(parts.length % 2, text).toBe(1);
        for (const bold of parts.filter((_, index) => index % 2)) {
          expect(bold, text).toMatch(/^\S(?:.*\S)?$/u);
        }
      }
      expect(JSON.stringify(HOME_COPY[lang].faq)).not.toContain("**");
    }
  });

  it("asks Russian FAQ questions without gendered first-person verbs", () => {
    // Visitors of every gender read these; "отправил/перевёл/установил" alone
    // addressed only men. Polite plural forms are used instead.
    // \b is ASCII-only in JS, so Cyrillic word edges use \p{L} lookarounds.
    const firstPersonPast = /(?:^|[^\p{L}])[Яя]\s+(?:\p{L}+\s+)?\p{L}+ла?(?=[^\p{L}]|$)/u;
    const bareMasculinePast = /(?:^|[^\p{L}])(?:Перевёл|Установил|Отправил|Назвал)(?=[^\p{L}])/u;
    expect(firstPersonPast.test("Я уже отправил код из SMS — что делать?")).toBe(true);
    expect(bareMasculinePast.test("Перевёл деньги — можно вернуть?")).toBe(true);
    for (const { q } of HOME_COPY.ru.faq.items) {
      expect(q).not.toMatch(firstPersonPast);
      expect(q).not.toMatch(bareMasculinePast);
    }
  });
});
