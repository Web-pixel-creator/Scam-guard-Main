// Property-based test for context-word gated card redaction.
//
// Task 5.4 — "Write property test for context-word gated card redaction"
// Property 2 from design.md "Correctness Properties":
//   For any string containing a sequence of 13–19 digits that does NOT pass the
//   Luhn-16 check, redaction occurs iff at least one context word from
//   CARD_CONTEXT_WORDS appears within 120 characters of the digit sequence.
//
// Feature: telegram-ux-polish, Property 2: Context-word gated card redaction
// **Validates: Requirements 3.1, 3.2, 3.3, 5.6**

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CARD_CONTEXT_WORDS,
  luhnCheck,
  shouldRedactAsCard,
} from "../detect";

/**
 * Generates a random digit sequence of length 13–19 that does NOT pass the
 * Luhn check when its length is 16. This avoids triggering the unconditional
 * Luhn-16 redaction path so we test context-word gating only.
 */
const nonLuhn16DigitSequence: fc.Arbitrary<string> = fc
  .integer({ min: 13, max: 19 })
  .chain((len) =>
    fc
      .array(fc.integer({ min: 0, max: 9 }), { minLength: len, maxLength: len })
      .map((digits) => digits.join(""))
      .filter((seq) => {
        // If length is 16, ensure it does NOT pass Luhn
        if (seq.length === 16) return !luhnCheck(seq);
        return true;
      }),
  );

/**
 * Generates filler text of a specified length using safe characters that won't
 * accidentally contain any CARD_CONTEXT_WORDS.
 * Uses only the character 'x' repeated — guaranteed not to match any context word.
 */
function safeFiller(len: number): string {
  return "x".repeat(len);
}

/**
 * Arbitrary for safe filler of variable length (no context words possible).
 */
const safeFillerArb = (minLen: number, maxLen: number): fc.Arbitrary<string> =>
  fc.integer({ min: minLen, max: maxLen }).map((len) => safeFiller(len));

/**
 * Picks a random context word from CARD_CONTEXT_WORDS.
 */
const contextWordArb: fc.Arbitrary<string> = fc.constantFrom(...CARD_CONTEXT_WORDS);

/**
 * The longest context word length — used to ensure the entire context word
 * fits within the 120-char detection window.
 */
const MAX_CONTEXT_WORD_LEN = Math.max(...CARD_CONTEXT_WORDS.map((w) => w.length));

describe("Feature: telegram-ux-polish, Property 2: Context-word gated card redaction", () => {
  // Sub-property A: Context word WITHIN 120 chars → redaction occurs
  // The filler between the digit sequence and the context word must be short
  // enough that the ENTIRE context word fits within the 120-char window.
  it("redacts when a context word appears within 120 chars of the digit sequence", () => {
    fc.assert(
      fc.property(
        nonLuhn16DigitSequence,
        contextWordArb,
        // Filler distance: ensure filler + word length ≤ 119 (word fully in window)
        fc.integer({ min: 0, max: 120 - MAX_CONTEXT_WORD_LEN - 1 }),
        // Whether context word goes before or after the digit sequence
        fc.boolean(),
        (digits, contextWord, fillerLen, wordBefore) => {
          const filler = safeFiller(fillerLen);

          let surroundingText: string;
          let matchStart: number;
          let matchEnd: number;

          if (wordBefore) {
            // [padding][contextWord][filler][digits][padding]
            const prefix = safeFiller(10);
            surroundingText = prefix + contextWord + filler + digits + safeFiller(10);
            matchStart = prefix.length + contextWord.length + filler.length;
            matchEnd = matchStart + digits.length;
          } else {
            // [padding][digits][filler][contextWord][padding]
            const prefix = safeFiller(10);
            surroundingText = prefix + digits + filler + contextWord + safeFiller(10);
            matchStart = prefix.length;
            matchEnd = matchStart + digits.length;
          }

          const result = shouldRedactAsCard(digits, surroundingText, matchStart, matchEnd);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Sub-property B: No context word anywhere in the text → no redaction
  it("does NOT redact when no context word is present in the surrounding text", () => {
    fc.assert(
      fc.property(
        nonLuhn16DigitSequence,
        safeFillerArb(50, 200),
        safeFillerArb(50, 200),
        (digits, paddingBefore, paddingAfter) => {
          const surroundingText = paddingBefore + digits + paddingAfter;
          const matchStart = paddingBefore.length;
          const matchEnd = matchStart + digits.length;

          const result = shouldRedactAsCard(digits, surroundingText, matchStart, matchEnd);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Sub-property C: Context word placed BEYOND 120 chars → no redaction
  it("does NOT redact when context word exists but is beyond 120 chars from the digit sequence", () => {
    fc.assert(
      fc.property(
        nonLuhn16DigitSequence,
        contextWordArb,
        // Filler distance > 120 chars (context word starts past the window boundary)
        fc.integer({ min: 121, max: 250 }),
        fc.boolean(),
        (digits, contextWord, fillerLen, wordBefore) => {
          const filler = safeFiller(fillerLen);

          let surroundingText: string;
          let matchStart: number;
          let matchEnd: number;

          if (wordBefore) {
            // [contextWord][filler > 120][digits][safe padding]
            surroundingText = contextWord + filler + digits + safeFiller(10);
            matchStart = contextWord.length + filler.length;
            matchEnd = matchStart + digits.length;
          } else {
            // [safe padding][digits][filler > 120][contextWord]
            const prefix = safeFiller(10);
            surroundingText = prefix + digits + filler + contextWord;
            matchStart = prefix.length;
            matchEnd = matchStart + digits.length;
          }

          const result = shouldRedactAsCard(digits, surroundingText, matchStart, matchEnd);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
