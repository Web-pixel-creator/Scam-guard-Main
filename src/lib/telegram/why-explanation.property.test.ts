// Feature: telegram-ux-polish, Property 1: Why_Explanation well-formedness
//
// Property 1 (design.md → "Why_Explanation well-formedness", Validates: Requirements 2.1, 2.2, 2.3, 2.4):
// For any supported language (ru, uz, en), the `why_explanation` text in `bot_dict` SHALL:
// - contain no more than 800 characters,
// - contain no numeric weight/threshold patterns (digits + "≥", "=", "score", "вес", "порог", "hash", "mask", "30+"),
// - have at most 5 numbered list items,
// - end with a privacy note containing the 🔒 emoji.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { bot_dict } from "@/lib/telegram/bot-i18n";

/** Validates: Requirements 2.1, 2.2, 2.3, 2.4 */

const LANGS = ["ru", "uz", "en"] as const;

/**
 * Patterns that indicate internal scoring/technical jargon that must NOT appear
 * in the user-facing why_explanation text.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\d+\s*[≥=]/,         // digits followed by ≥ or = (threshold patterns like "50≥", "30=")
  /[≥=]\s*\d+/,         // ≥ or = followed by digits (e.g., "≥ 50", "= 20")
  /\bscore\b/i,         // "score" in any case
  /\bвес\b/i,           // Russian "вес" (weight)
  /\bпорог\b/i,         // Russian "порог" (threshold)
  /\bhash\b/i,          // "hash"
  /\bmask\b/i,          // "mask"
  /\b30\+/,             // "30+" pattern (referring to "30+ rules")
  /\bхеш\b/i,          // Russian "хеш" (hash)
  /\bмаск\b/i,         // Russian "маск" (mask)
  /\bweight\b/i,        // "weight"
  /\bthreshold\b/i,     // "threshold"
];

/**
 * Counts numbered list items in the text. Matches patterns like:
 * "1️⃣", "2️⃣", ... or "1.", "2.", etc.
 */
function countNumberedItems(text: string): number {
  // Match keycap digit emoji sequences (1️⃣ through 9️⃣)
  const keycapMatches = text.match(/[\d]\uFE0F\u20E3/g);
  if (keycapMatches && keycapMatches.length > 0) {
    return keycapMatches.length;
  }
  // Fallback: match "N." or "N)" at line start
  const numberedLines = text.match(/^\d+[.)]/gm);
  return numberedLines?.length ?? 0;
}

describe("Why_Explanation — Property 1: Why_Explanation well-formedness", () => {
  it("satisfies well-formedness constraints for all langs (fast-check, ≥100 iterations)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...LANGS),
        (lang) => {
          const text = bot_dict.why_explanation[lang];

          // (1) ≤800 characters
          expect(text.length).toBeLessThanOrEqual(800);

          // (2) No weight/threshold/technical jargon patterns
          for (const pattern of FORBIDDEN_PATTERNS) {
            expect(
              pattern.test(text),
              `Forbidden pattern ${pattern} found in "${lang}" why_explanation`,
            ).toBe(false);
          }

          // (3) ≤5 numbered items
          const itemCount = countNumberedItems(text);
          expect(itemCount).toBeLessThanOrEqual(5);

          // (4) Ends with 🔒 privacy note
          const trimmed = text.trimEnd();
          expect(
            trimmed.includes("🔒"),
            `"${lang}" why_explanation must contain 🔒 privacy note`,
          ).toBe(true);
          // The 🔒 should be in the last portion of the text (final paragraph)
          const lastParagraph = trimmed.split("\n\n").pop() ?? "";
          expect(
            lastParagraph.includes("🔒"),
            `"${lang}" why_explanation must end with a paragraph containing 🔒`,
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
