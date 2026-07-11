const FILE_LIKE_EXTENSIONS = new Set([
  "apk",
  "exe",
  "pdf",
  "pptx",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "zip",
  "rar",
  "gif",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "ogg",
  "mp3",
  "mp4",
]);

const EXPLICIT_LINK_OR_TELEGRAM_RE =
  /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|tg:\/\/|@[a-zA-Z0-9_]{3,})/iu;
const DANGEROUS_FILE_RE =
  /(?:^|[^\p{L}\p{N}_-])[\p{L}\p{N}_.-]+\.(?:apk|exe|msi|scr|jar|bat|cmd)(?=$|[^\p{L}\p{N}_-])/iu;
const IPV4_RE = /(?:^|[^\d.])(?:\d{1,3}\.){3}\d{1,3}(?=$|[^\d.])/u;
const CARD_NUMBER_RE = /(?:^|\D)(?:\d[ -]?){13,19}(?=$|\D)/gu;
const PHONE_CANDIDATE_RE = /\+?\d[\d\s().-]{7,}\d/gu;
const SECRET_VALUE_RE =
  /(?:(?<![\p{L}\p{N}_])(?:otp|sms|смс|код|pin|пин|cvv|cvc|password|парол|code|kod)(?![\p{L}\p{N}_])[^\d\n]{0,24}(?<!\d)\d{3,8}(?!\d)|(?<!\d)\d{3,8}(?!\d)[^\n]{0,24}(?<![\p{L}\p{N}_])(?:otp|sms|смс|код|pin|пин|cvv|cvc|code|kod)(?![\p{L}\p{N}_]))/iu;
const SHORT_IDENTIFIER_RE =
  /(?:(?<![\p{L}\p{N}_])(?:номер|телефон|short\s+code|number|raqam)(?![\p{L}\p{N}_])[^\d\n]{0,20}(?<!\d)\d{3,8}(?!\d)|(?<!\d)\d{3,8}(?!\d)[^\n]{0,20}(?<![\p{L}\p{N}_])(?:номер|телефон|short\s+code|number|raqam)(?![\p{L}\p{N}_]))/iu;
const BARE_SHORT_VALUE_RE = /^\d{3,8}$/u;
const BARE_DOMAIN_RE =
  /(?:^|[^\p{L}\p{N}_-])((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:xn--[a-z0-9-]{2,59}|\p{L}{2,63}))(?=$|[^\p{L}\p{N}_-])/giu;

function containsCardNumber(text: string): boolean {
  CARD_NUMBER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARD_NUMBER_RE.exec(text)) !== null) {
    const digits = match[0].replace(/\D/gu, "");
    if (digits.length >= 13 && digits.length <= 19) return true;
  }
  return false;
}

function containsPhoneNumber(text: string): boolean {
  PHONE_CANDIDATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PHONE_CANDIDATE_RE.exec(text)) !== null) {
    if (match[0].replace(/\D/gu, "").length >= 9) return true;
  }
  return false;
}

function containsBareDomain(text: string): boolean {
  BARE_DOMAIN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = BARE_DOMAIN_RE.exec(text)) !== null) {
    const domain = match[1];
    const extension = domain?.split(".").at(-1)?.toLowerCase();
    if (extension && !FILE_LIKE_EXTENSIONS.has(extension)) return true;
  }
  return false;
}

/**
 * Returns true only when the message contains a concrete value that can be
 * checked independently: a link/domain, Telegram identifier, executable file,
 * phone/card number, or an actual short secret/identifier value. Mere safety
 * wording such as "why must I not send a code?" is not an artifact.
 */
export function hasConcreteArtifact(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  return (
    EXPLICIT_LINK_OR_TELEGRAM_RE.test(trimmed) ||
    DANGEROUS_FILE_RE.test(trimmed) ||
    IPV4_RE.test(trimmed) ||
    containsCardNumber(trimmed) ||
    SECRET_VALUE_RE.test(trimmed) ||
    SHORT_IDENTIFIER_RE.test(trimmed) ||
    BARE_SHORT_VALUE_RE.test(trimmed) ||
    containsPhoneNumber(trimmed) ||
    containsBareDomain(trimmed)
  );
}
