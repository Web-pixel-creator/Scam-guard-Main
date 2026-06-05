// AI Explanation Truncator for Result Message UX v2.
//
// Pure function that enforces mobile-friendly length limits on AI-generated
// explanation text. Preserves sentence boundaries when possible, appends "…"
// when content is trimmed.
//
// Contract: design.md → "Components and Interfaces → 2. AI Explanation Truncator"

/** Configuration for truncation limits. */
export interface TruncateOptions {
  maxLines: number; // default 5
  maxChars: number; // default 280
}

const DEFAULT_OPTIONS: TruncateOptions = {
  maxLines: 5,
  maxChars: 280,
};

const ELLIPSIS = "…";

/**
 * Truncate an AI explanation to fit mobile readability constraints.
 *
 * Priority:
 * 1. Line limit (≤ maxLines) — hard
 * 2. Character limit (≤ maxChars) — hard
 * 3. Sentence boundary preservation — best effort
 * 4. "…" appended whenever any content was removed
 */
export function truncateExplanation(text: string, options?: Partial<TruncateOptions>): string {
  if (text === "") return "";

  const { maxLines, maxChars } = { ...DEFAULT_OPTIONS, ...options };

  const lines = text.split("\n");

  // Fast path: text already fits within both limits
  if (lines.length <= maxLines && text.length <= maxChars) {
    return text;
  }

  // Take at most maxLines lines
  const candidateLines = lines.slice(0, maxLines);
  const result = candidateLines.join("\n");

  // If joining the allowed lines is already within char limit, just append ellipsis
  if (result.length <= maxChars - ELLIPSIS.length) {
    return result.trimEnd() + ELLIPSIS;
  }

  // Need to cut within char budget (reserve 1 char for "…")
  const budget = maxChars - ELLIPSIS.length;
  const raw = result.slice(0, budget);

  // Try to find a sentence boundary within the sliced text.
  // We look for the last occurrence of sentence-ending punctuation followed by a space.
  const sentenceBoundary = findLastSentenceBoundary(raw);

  if (sentenceBoundary > 0) {
    return raw.slice(0, sentenceBoundary).trimEnd() + ELLIPSIS;
  }

  // No sentence boundary — cut at last space
  const lastSpace = raw.lastIndexOf(" ");
  if (lastSpace > 0) {
    return raw.slice(0, lastSpace).trimEnd() + ELLIPSIS;
  }

  // No space at all — hard cut
  return raw.trimEnd() + ELLIPSIS;
}

/**
 * Find the last sentence boundary position in `text`.
 * A sentence boundary is defined as one of: `. `, `! `, `? `, `。`
 * Returns the index right after the punctuation (i.e., the cut point),
 * or -1 if no boundary found.
 */
function findLastSentenceBoundary(text: string): number {
  let lastPos = -1;

  // Patterns: ". ", "! ", "? " — return position after the punctuation char
  for (let i = text.length - 1; i >= 1; i--) {
    if (text[i] === " ") {
      const prev = text[i - 1];
      if (prev === "." || prev === "!" || prev === "?") {
        lastPos = i; // cut right before the space after punctuation
        break;
      }
    }
  }

  // Also check for 。 (Japanese/Chinese period) — it doesn't need a trailing space
  const jpPeriod = text.lastIndexOf("。");
  if (jpPeriod >= 0) {
    const jpPos = jpPeriod + 1; // cut after the 。
    if (jpPos > lastPos) {
      lastPos = jpPos;
    }
  }

  return lastPos;
}
