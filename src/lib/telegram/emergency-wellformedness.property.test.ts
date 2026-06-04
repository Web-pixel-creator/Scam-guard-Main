// Feature: telegram-ux-polish, Property 4: Emergency text well-formedness
//
// Property 4 (design.md → "Emergency text well-formedness", Validates: Requirements 5.1, 5.2, 5.4, 5.5):
// For any panic scenario ID (1–10) and for any supported language (ru, uz, en),
// the output of `buildPanicScenarioText(id, lang)` SHALL:
// - not exceed 1500 characters in length,
// - begin its first content line (after the title) with an uppercase word or phrase
//   signaling the most important action,
// - contain at least one phone number or short code that exists in the VERIFIED_CONTACTS array.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildPanicScenarioText, type PanicScenarioId } from "@/lib/telegram/emergency";
import { VERIFIED_CONTACTS } from "@/lib/risk/verified-contacts";

/** Validates: Requirements 5.1, 5.2, 5.4, 5.5 */

const LANGS = ["ru", "uz", "en"] as const;
const SCENARIO_IDS: PanicScenarioId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Extract phone numbers and short codes from VERIFIED_CONTACTS for matching.
 * We collect `display` and `normalized` values for phone and short_code types.
 */
const CONTACT_VALUES: string[] = VERIFIED_CONTACTS.filter(
  (c) => c.contactType === "phone" || c.contactType === "short_code",
).flatMap((c) => [c.display, c.normalized]);

/**
 * Check if the text contains at least one verified contact phone/short code.
 */
function containsVerifiedContact(text: string): boolean {
  return CONTACT_VALUES.some((value) => text.includes(value));
}

/**
 * Get the first content line after the title.
 * The title is the first non-empty line. The first content line is the next
 * non-empty line after the title (skipping blank lines between title and content).
 */
function getFirstContentLine(text: string): string {
  const lines = text.split("\n");
  let foundTitle = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!foundTitle) {
      if (trimmed.length > 0) {
        foundTitle = true;
      }
      continue;
    }
    // After title, find first non-empty line
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

/**
 * Check if a line starts with an uppercase letter (any script: Latin, Cyrillic, etc.).
 * We strip leading emoji/symbols to find the first alphabetic character.
 */
function startsWithUppercase(line: string): boolean {
  // Strip leading non-letter characters (emoji, symbols, spaces, quotes, etc.)
  const stripped = line.replace(/^[^a-zA-Zа-яА-ЯёЁa-zA-ZA-Z\u0400-\u04FF]+/, "");
  if (stripped.length === 0) return false;
  const firstChar = stripped[0];
  return firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();
}

describe("Emergency text — Property 4: Emergency text well-formedness", () => {
  it("satisfies well-formedness constraints for all scenarios × langs (fast-check, ≥100 iterations)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SCENARIO_IDS), fc.constantFrom(...LANGS), (id, lang) => {
        const text = buildPanicScenarioText(id, lang);

        // (1) ≤1500 characters
        expect(text.length).toBeLessThanOrEqual(1500);

        // (2) First content line starts with uppercase action word
        const firstContent = getFirstContentLine(text);
        expect(
          firstContent.length,
          `Scenario ${id} (${lang}): first content line should not be empty`,
        ).toBeGreaterThan(0);
        expect(
          startsWithUppercase(firstContent),
          `Scenario ${id} (${lang}): first content line "${firstContent}" must start with an uppercase letter`,
        ).toBe(true);

        // (3) Contains at least one phone/short-code from VERIFIED_CONTACTS
        expect(
          containsVerifiedContact(text),
          `Scenario ${id} (${lang}): text must contain at least one verified contact number`,
        ).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
