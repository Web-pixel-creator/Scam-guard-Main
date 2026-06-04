// Property-based test for Luhn-16 unconditional redaction.
//
// Task 5.5 — "Write property test for Luhn-16 unconditional redaction"
// Property 3 from design.md "Correctness Properties":
//   For any string containing a 16-digit sequence that passes the Luhn checksum,
//   shouldRedactAsCard SHALL return true regardless of whether any context word
//   is present in the surrounding text.
//
// Feature: telegram-ux-polish, Property 3: Luhn-16 unconditional redaction
// **Validates: Requirements 3.4, 5.6**

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { shouldRedactAsCard, luhnCheck, CARD_CONTEXT_WORDS } from "./detect";

/**
 * Compute the Luhn check digit for a 15-digit prefix, producing a valid 16-digit number.
 * The check digit d is chosen so that the full 16-digit number passes the Luhn algorithm.
 */
function computeCheckDigit(prefix15: string): string {
  let sum = 0;
  // In the full 16-digit number, the check digit is at position 15 (rightmost, index 0 from right).
  // Positions from the right: 0 (check digit, NOT doubled), 1 (doubled), 2 (not), ...
  // So for the prefix (indices 0..14 of the full number), index i in the full number
  // has offset from right = 15 - i. Odd offsets get doubled.
  for (let i = 0; i < 15; i++) {
    let n = parseInt(prefix15[i], 10);
    const offsetFromRight = 15 - i; // 1..15
    if (offsetFromRight % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

/**
 * Arbitrary that generates a valid Luhn-16 digit sequence:
 * - Generates 15 random digits (0-9)
 * - Computes the check digit to make the full 16-digit number Luhn-valid
 */
const luhn16Arb: fc.Arbitrary<string> = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 15, maxLength: 15 })
  .map((digits) => {
    const prefix = digits.join("");
    const check = computeCheckDigit(prefix);
    return prefix + check;
  });

/**
 * Generates safe filler text of a given length that is guaranteed NOT to
 * accidentally contain any CARD_CONTEXT_WORDS. Uses only the character 'x'.
 */
function safeFiller(len: number): string {
  return "x".repeat(len);
}

/**
 * Arbitrary for safe filler of variable length (no context words possible).
 */
const safeFillerArb = (minLen: number, maxLen: number): fc.Arbitrary<string> =>
  fc.integer({ min: minLen, max: maxLen }).map((len) => safeFiller(len));

describe("Feature: telegram-ux-polish, Property 3: Luhn-16 unconditional redaction", () => {
  // Property 3: shouldRedactAsCard always returns true for Luhn-valid 16-digit
  // sequences regardless of whether context words are present.
  it("unconditionally redacts Luhn-valid 16-digit sequences without any context words", () => {
    fc.assert(
      fc.property(
        luhn16Arb,
        safeFillerArb(0, 200),
        safeFillerArb(0, 200),
        (cardNumber, paddingBefore, paddingAfter) => {
          // Verify the generated number is actually Luhn-valid and 16 digits
          expect(cardNumber.length).toBe(16);
          expect(luhnCheck(cardNumber)).toBe(true);

          // Build surrounding text — guaranteed to have NO context words
          const surroundingText = paddingBefore + cardNumber + paddingAfter;
          const matchStart = paddingBefore.length;
          const matchEnd = matchStart + cardNumber.length;

          // Verify no context words are present
          const lower = surroundingText.toLowerCase();
          for (const word of CARD_CONTEXT_WORDS) {
            expect(lower).not.toContain(word.toLowerCase());
          }

          // shouldRedactAsCard must return true — unconditional for Luhn-16
          expect(
            shouldRedactAsCard(cardNumber, surroundingText, matchStart, matchEnd),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
