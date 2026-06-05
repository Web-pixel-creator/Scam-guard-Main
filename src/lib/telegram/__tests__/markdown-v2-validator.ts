/**
 * MarkdownV2 validation helper for test suites.
 *
 * Validates that a string is valid Telegram MarkdownV2 by checking for
 * unescaped special characters outside intentional bold marker pairs (*...*).
 */

export interface MarkdownV2ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * MarkdownV2 special characters that must be escaped (per Telegram docs).
 */
const SPECIAL_CHARS = new Set([
  "_",
  "*",
  "[",
  "]",
  "(",
  ")",
  "~",
  "`",
  ">",
  "#",
  "+",
  "-",
  "=",
  "|",
  "{",
  "}",
  ".",
  "!",
]);

/**
 * Validates that a string is valid Telegram MarkdownV2.
 * Checks for unescaped special characters outside bold marker pairs.
 *
 * Rules:
 * - Content inside bold markers (*...*) is allowed (intentional formatting)
 * - Escaped characters (preceded by \) are allowed
 * - Emoji characters don't need escaping
 * - Unicode characters like • (bullet) and ┈ (thin separator) don't need escaping
 * - Newline characters (\n) are not flagged
 */
export function validateMarkdownV2(text: string): MarkdownV2ValidationResult {
  const errors: string[] = [];

  // Step 1: Strip content inside bold markers (*...*)
  // Bold markers are unescaped * that are properly paired.
  // We replace paired bold content with placeholder to avoid false positives.
  const stripped = stripBoldMarkers(text);

  // Step 2: Check remaining text for unescaped special characters
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];

    // Skip non-special characters
    if (!SPECIAL_CHARS.has(ch)) continue;

    // Skip if preceded by backslash (properly escaped)
    if (isEscaped(stripped, i)) continue;

    // Skip backslash-n (newline escape in source)
    // Note: actual newline chars (\n) are fine — they're not special chars.
    // This handles the edge case where the literal text has \\n which
    // shouldn't flag the 'n'.

    // Report unescaped special character
    const context = getContext(stripped, i);
    errors.push(`Unescaped '${ch}' at position ${i}${context ? ` (near: "${context}")` : ""}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Strips content inside properly paired bold markers (*...*).
 * Replaces *content* with whitespace placeholder of same length.
 * Only strips pairs where the * is not escaped.
 */
function stripBoldMarkers(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    // Check for unescaped * that starts a bold pair
    if (text[i] === "*" && !isEscaped(text, i)) {
      // Find the matching closing *
      const closeIdx = findClosingBold(text, i + 1);
      if (closeIdx !== -1) {
        // Replace the entire *content* with spaces (preserves positions)
        const len = closeIdx - i + 1;
        result += " ".repeat(len);
        i = closeIdx + 1;
        continue;
      }
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Finds the closing unescaped * for a bold pair.
 * Returns the index of the closing *, or -1 if not found.
 */
function findClosingBold(text: string, startIdx: number): number {
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === "*" && !isEscaped(text, i)) {
      return i;
    }
  }
  return -1;
}

/**
 * Checks if the character at position idx is escaped
 * (preceded by an odd number of backslashes).
 */
function isEscaped(text: string, idx: number): boolean {
  let backslashes = 0;
  for (let j = idx - 1; j >= 0 && text[j] === "\\"; j--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

/**
 * Gets surrounding context for error messages.
 */
function getContext(text: string, idx: number): string {
  const start = Math.max(0, idx - 5);
  const end = Math.min(text.length, idx + 6);
  return text.slice(start, end).replace(/\n/g, "\\n");
}
