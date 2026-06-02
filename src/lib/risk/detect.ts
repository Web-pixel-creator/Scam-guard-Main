import type { Database } from "@/integrations/supabase/types";

export type InputType = Database["public"]["Enums"]["input_type"];

const PHONE_RE = /^[+]?[\d][\d\s\-()]{6,18}\d$/;
const TG_USERNAME_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const TG_LINK_RE = /(t\.me|telegram\.me)\//i;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+\.\S+/i;
const PURE_URL_RE = /^(?:https?:\/\/|www\.)\S+$/i;
const APK_RE = /\.apk(\?|$)/i;
const PAYMENT_ACTION_RE = /\b(pay|payment|paid|fee|transfer|prepay|deposit|invoice|receipt|top.?up|click|payme|uzum|uzcard|humo|to['’]?lov|tolov|o['’]?tkaz|pul|karta|avans|bron)\b/i;
const PAYMENT_CONTEXT_RE = /\b(uzs|sum|soum|so['’]?m|som|usd|card|karta|bank|qr|merchant|order|parcel|delivery|shipping|click|payme|uzum|uzcard|humo)\b|[$₽]/i;
const PAYMENT_AMOUNT_RE = /(?:[$₽]\s?\d+|\b\d{1,3}(?:[ .]\d{3})+\b|\b\d{4,}\s?(?:uzs|sum|soum|so['’]?m|som|usd)?\b|\b\d+(?:[.,]\d{2})\s?(?:uzs|sum|soum|so['’]?m|som|usd)\b)/i;

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
    case "phone": return normalizePhone(input);
    case "telegram": return normalizeTelegram(input);
    case "url":
    case "apk": return normalizeUrl(input);
    default: return input.trim();
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
    } catch { return value; }
  }
  // text: redact phones/cards/OTP
  return redactText(value).slice(0, 240) + (value.length > 240 ? "…" : "");
}

const CARD_RE = /\b(?:\d[ -]?){13,19}\b/g;
const OTP_RE = /\b\d{4,8}\b/g;
const PHONE_INLINE_RE = /\+?\d[\d\s\-()]{7,}\d/g;

export function redactText(s: string): string {
  return s
    .replace(CARD_RE, "•••• •••• •••• ••••")
    .replace(PHONE_INLINE_RE, (m) => {
      const d = m.replace(/\D/g, "");
      if (d.length < 7) return m;
      return "+" + d.slice(0, 3) + "•••••" + d.slice(-2);
    })
    .replace(OTP_RE, "••••");
}
