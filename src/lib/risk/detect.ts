import type { Database } from "@/integrations/supabase/types";

export type InputType = Database["public"]["Enums"]["input_type"];

const PHONE_RE = /^[+]?[\d][\d\s\-()]{6,18}\d$/;
const TG_USERNAME_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const TG_LINK_RE = /(t\.me|telegram\.me)\//i;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+\.\S+/i;
const PURE_URL_RE = /^(?:https?:\/\/|www\.)\S+$/i;
const APK_RE = /\.apk(\?|$)/i;
const PAYMENT_ACTION_RE =
  /\b(pay|payment|paid|fee|transfer|prepay|deposit|invoice|receipt|top.?up|click|payme|uzum|uzcard|humo|to['’]?lov|tolov|o['’]?tkaz|pul|karta|avans|bron)\b/i;
const PAYMENT_CONTEXT_RE =
  /\b(uzs|sum|soum|so['’]?m|som|usd|card|karta|bank|qr|merchant|order|parcel|delivery|shipping|click|payme|uzum|uzcard|humo)\b|[$₽]/i;
const PAYMENT_AMOUNT_RE =
  /(?:[$₽]\s?\d+|\b\d{1,3}(?:[ .]\d{3})+\b|\b\d{4,}\s?(?:uzs|sum|soum|so['’]?m|som|usd)?\b|\b\d+(?:[.,]\d{2})\s?(?:uzs|sum|soum|so['’]?m|som|usd)\b)/i;

export function looksLikePaymentInput(raw: string): boolean {
  const v = raw.trim();
  if (!v || PURE_URL_RE.test(v) || APK_RE.test(v) || TG_LINK_RE.test(v)) return false;
  return PAYMENT_ACTION_RE.test(v) && (PAYMENT_CONTEXT_RE.test(v) || PAYMENT_AMOUNT_RE.test(v));
}

export function detectInputType(raw: string): InputType {
  const v = raw.trim();
  if (!v) return "unknown";
  if (APK_RE.test(v)) return "apk";
  if (TG_LINK_RE.test(v)) return "telegram";
  if (looksLikePaymentInput(v)) return "payment";
  if (URL_RE.test(v)) return "url";
  // Pure phone (only digits/+/()-/space, no letters/spaces of text)
  if (PHONE_RE.test(v.replace(/\s/g, "")) && !/[a-zа-я]/i.test(v)) return "phone";
  // Telegram username (short)
  if (TG_USERNAME_RE.test(v) && v.length < 40 && !v.includes(" ")) return "telegram";
  return "text";
}

/** Normalize Uzbekistan phone numbers to +998XXXXXXXXX where possible. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("998")) return "+" + d;
  if (d.length === 9) return "+998" + d;
  if (d.length === 12 && d.startsWith("998")) return "+" + d;
  return raw.trim();
}

export function normalizeTelegram(raw: string): string {
  const m = raw.match(/(?:t\.me\/|telegram\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{3,31})/);
  if (m) return "@" + m[1];
  if (raw.startsWith("@")) return raw;
  return "@" + raw.replace(/^@?/, "").trim();
}

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.startsWith("http") ? raw : "https://" + raw);
    return u.origin + u.pathname;
  } catch {
    return raw.trim();
  }
}

export function normalize(input: string, type: InputType): string {
  switch (type) {
    case "phone":
      return normalizePhone(input);
    case "telegram":
      return normalizeTelegram(input);
    case "url":
    case "apk":
      return normalizeUrl(input);
    default:
      return input.trim();
  }
}

/** Mask sensitive parts for display. */
export function maskForDisplay(value: string, type: InputType): string {
  if (type === "phone") {
    const d = value.replace(/\D/g, "");
    if (d.length >= 7) return "+" + d.slice(0, 3) + " " + d.slice(3, 5) + " ••• " + d.slice(-2);
    return value;
  }
  if (type === "telegram") {
    const n = value.replace(/^@/, "");
    if (n.length <= 4) return "@" + n[0] + "••";
    return "@" + n.slice(0, 2) + "•••" + n.slice(-2);
  }
  if (type === "url" || type === "apk") {
    try {
      const u = new URL(value.startsWith("http") ? value : "https://" + value);
      return u.hostname + (u.pathname.length > 1 ? "/…" : "");
    } catch {
      return value;
    }
  }
  // text: redact phones/cards/OTP
  return redactText(value).slice(0, 240) + (value.length > 240 ? "…" : "");
}

const CARD_DIGIT_RE = /\b(?:\d[ -]?){13,19}\b/g;
const OTP_RE = /\b\d{4,8}\b/g;
const PHONE_INLINE_RE = /\+?\d[\d\s\-()]{7,}\d/g;

export function redactText(s: string): string {
  type Replacement = { start: number; end: number; replacement: string };
  const replacements: Replacement[] = [];

  // Step 1: Collect phone matches first (highest priority — never double-matched)
  // A match is treated as a phone only if it contains formatting chars (+, spaces, dashes, parens)
  // OR has fewer than 13 pure digits. Pure 13-19 digit runs are left for card detection.
  PHONE_INLINE_RE.lastIndex = 0;
  let phoneMatch: RegExpExecArray | null;
  while ((phoneMatch = PHONE_INLINE_RE.exec(s)) !== null) {
    const raw = phoneMatch[0];
    const d = raw.replace(/\D/g, "");
    if (d.length < 7) continue;

    // If pure digits are 13-19 and there are NO formatting chars, skip — let card logic handle it
    const hasFormatting = /[+\s\-()]/.test(raw);
    if (!hasFormatting && d.length >= 13 && d.length <= 19) continue;

    replacements.push({
      start: phoneMatch.index,
      end: phoneMatch.index + raw.length,
      replacement: "+" + d.slice(0, 3) + "•••••" + d.slice(-2),
    });
  }

  // Step 2: Collect context-aware card matches (skip regions already claimed by phones)
  CARD_DIGIT_RE.lastIndex = 0;
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = CARD_DIGIT_RE.exec(s)) !== null) {
    const start = cardMatch.index;
    const end = start + cardMatch[0].length;

    // Skip if this region overlaps with a phone match
    const overlapsPhone = replacements.some(
      (r) => start < r.end && end > r.start,
    );
    if (overlapsPhone) continue;

    const digits = cardMatch[0].replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) continue;

    if (shouldRedactAsCard(digits, s, start, end)) {
      replacements.push({
        start,
        end,
        replacement: "•••• •••• •••• ••••",
      });
    }
  }

  // Apply all replacements from end to start (preserves earlier offsets)
  replacements.sort((a, b) => b.start - a.start);
  let result = s;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }

  // Step 3: Redact OTP patterns last (on already-processed text)
  result = result.replace(OTP_RE, "••••");

  return result;
}

/**
 * Context words that signal a digit sequence is likely a card number.
 * Matched case-insensitively in the surrounding text.
 */
export const CARD_CONTEXT_WORDS: string[] = [
  "карта",
  "карту",
  "банк",
  "пин",
  "cvv",
  "cvc",
  "pin",
  "karta",
  "bank",
  "card",
  "uzcard",
  "humo",
  "оплата",
  "перевод",
  "реквизиты",
  "срок действия",
];

/**
 * Determine if a 13–19 digit sequence should be treated as a card number.
 *
 * Returns true if:
 *   1. The sequence is exactly 16 digits AND passes the Luhn check → unconditional redaction.
 *   2. Otherwise, at least one context word from CARD_CONTEXT_WORDS appears within
 *      120 characters of the digit sequence (case-insensitive).
 *
 * Pure function — no side effects.
 */
export function shouldRedactAsCard(
  digitSequence: string,
  surroundingText: string,
  matchStart: number,
  matchEnd: number,
): boolean {
  // Unconditional: 16-digit Luhn-valid sequences are always treated as cards
  if (digitSequence.length === 16 && luhnCheck(digitSequence)) {
    return true;
  }

  // Context-word gating: check a 120-char window around the match
  const windowStart = Math.max(0, matchStart - 120);
  const windowEnd = Math.min(surroundingText.length, matchEnd + 120);
  const window = surroundingText.slice(windowStart, windowEnd).toLowerCase();

  return CARD_CONTEXT_WORDS.some((word) => window.includes(word.toLowerCase()));
}

/**
 * Luhn checksum validation for card number detection.
 * Takes a string of digits (no spaces/dashes) and returns true if it passes the Luhn algorithm.
 */
export function luhnCheck(digits: string): boolean {
  const len = digits.length;
  if (len === 0) return false;

  let sum = 0;
  let alternate = false;

  for (let i = len - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (isNaN(n)) return false;

    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }

    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}
