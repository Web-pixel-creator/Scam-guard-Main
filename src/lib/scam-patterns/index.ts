// Scam Patterns Library — public API.
//
// Reusable structured data about known scam schemes in Uzbekistan.
// Used by: /scams page, Telegram "Почему?", admin reason timeline,
// future Scam DNA Graph and self-evolution agent.

export type { ScamPattern, ScamSeverity } from "./types";
export { SCAM_PATTERNS } from "./patterns";

import type { ReasonCode } from "@/lib/risk/rules";
import { SCAM_PATTERNS } from "./patterns";
import type { ScamPattern } from "./types";

const WEAK_CONTEXT_CODES = new Set<ReasonCode>([
  "unknown_sender",
  "new_telegram_account",
  "valid_uz_phone",
  "non_uz_phone",
  "hosted_app_platform",
]);

/** Find patterns that match a set of reason codes. */
export function findMatchingPatterns(codes: ReasonCode[]): ScamPattern[] {
  if (codes.length === 0) return [];
  const codeSet = new Set(codes);

  return SCAM_PATTERNS.filter((p) => {
    const strongCodes = p.reasonCodes.filter((rc) => !WEAK_CONTEXT_CODES.has(rc));

    if (strongCodes.length > 0) {
      return strongCodes.some((rc) => codeSet.has(rc));
    }

    return p.reasonCodes.some((rc) => codeSet.has(rc));
  });
}

/** Get a single pattern by ID. */
export function getPatternById(id: string): ScamPattern | undefined {
  return SCAM_PATTERNS.find((p) => p.id === id);
}

/** Total count of known patterns. */
export const PATTERN_COUNT = SCAM_PATTERNS.length;
