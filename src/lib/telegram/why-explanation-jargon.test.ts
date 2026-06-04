// Task 3.3 — Verify "Как я решаю?" (why_explanation) has no technical jargon.
// Checks all 3 langs (ru, uz, en) for forbidden terms.
// Requirement 2.1: avoid numeric weights, score thresholds, and technical jargon.

import { describe, it, expect } from "vitest";
import { bot_dict } from "@/lib/telegram/bot-i18n";

/**
 * Forbidden technical jargon patterns — matched as whole words (word boundaries)
 * to avoid false positives like "неизвестного" matching "вес".
 */
const FORBIDDEN_PATTERNS = [
  /\bscore\b/i,
  /\bweight\b/i,
  /\bthreshold\b/i,
  /\bhash\b/i,
  /\bmask\b/i,
  /\bвес\b/i,
  /\bпорог\b/i,
  /\bхеш\b/i,
  /\bмаск\w*/i, // маск, маска, маски etc.
  /30\+/, // literal "30+"
];

const LANGS = ["ru", "uz", "en"] as const;

describe("why_explanation — no technical jargon", () => {
  for (const lang of LANGS) {
    it(`[${lang}] should not contain forbidden technical terms`, () => {
      const text = bot_dict.why_explanation[lang];

      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(
          text,
          `Found jargon pattern ${pattern} in [${lang}] why_explanation`,
        ).not.toMatch(pattern);
      }
    });
  }
});
