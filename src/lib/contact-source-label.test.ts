import { describe, expect, it } from "vitest";
import { localizeContactSource } from "./contact-source-label";
import { VERIFIED_CONTACTS } from "./risk/verified-contacts";

// Domains and URLs may stay Latin; any other English word means a new source
// note was added without a translation.
function englishWords(text: string): string[] {
  return (
    text
      .replace(/https?:\/\/\S+/gu, "")
      .replace(/\b[\w-]+(\.[\w-]+)+(\/\S*)?/gu, "")
      .match(/\b[A-Za-z]{3,}\b/gu) ?? []
  );
}

describe("directory source labels", () => {
  it.each(["ru", "uz"] as const)("translates every source note into %s", (lang) => {
    for (const contact of VERIFIED_CONTACTS) {
      const label = localizeContactSource(contact.source, lang);
      const note = new Set(englishWords(contact.source).map((w) => w.toLowerCase()));
      const left = englishWords(label).filter((w) => note.has(w.toLowerCase()));
      expect(left, `${contact.source} -> ${label}`).toEqual([]);
      // Russian labels keep no Latin words at all besides domains and URLs.
      if (lang === "ru") expect(englishWords(label), label).toEqual([]);
    }
  });

  it("keeps domains, URLs and the English original", () => {
    expect(localizeContactSource("nbu.uz (official contacts page)", "ru")).toBe(
      "nbu.uz (официальная страница контактов)",
    );
    expect(
      localizeContactSource("Standard Uzbekistan emergency numbers; gov.uz/ru/iiv", "uz"),
    ).toBe("O‘zbekistonning standart favqulodda raqamlari; gov.uz/ru/iiv");
    expect(localizeContactSource("https://cbu.uz/en/contacts/helpline/", "ru")).toBe(
      "https://cbu.uz/en/contacts/helpline/",
    );
    expect(localizeContactSource("nbu.uz (official contacts page)", "en")).toBe(
      "nbu.uz (official contacts page)",
    );
  });
});
