export type SensitiveSecretClass = "password" | "code" | "recovery_phrase" | "private_key";

export interface SensitiveTextSanitization {
  value: string;
  redacted: boolean;
  classes: readonly SensitiveSecretClass[];
}

const HIDDEN_VALUE = "••••";
const WORD_START = String.raw`(?<![\p{L}\p{N}_])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_])`;
const EXPLICIT_VALUE_SEPARATOR = String.raw`(?:\s*[:=]\s*|\s+(?:is|это|bu)\s+)`;
const VALUE_SEPARATOR = String.raw`(?:\s*[:=]\s*|\s+(?:is|это|bu)\s+|\s+)`;

const PASSWORD_LABEL = String.raw`(?:password|passphrase|парол(?:ь|я|ем|ю)?|parol|maxfiy\s+so['’]?z)`;
const EXPLICIT_PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${WORD_END})(${EXPLICIT_VALUE_SEPARATOR})([^\\r\\n.!?;]{4,240})`,
  "giu",
);
const PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${WORD_END})(${VALUE_SEPARATOR})("[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160})`,
  "giu",
);

const CODE_LABEL = String.raw`(?:otp(?:\s+code)?|sms[\s-]*(?:code|kod|код)|смс[\s-]*код|код(?:\s+(?:подтверждения|из\s+смс))?|verification[\s-]+code|confirmation[\s-]+code|tasdiq(?:lash)?[\s-]+kod(?:i)?|bir[\s-]+martalik[\s-]+kod|pin|пин|cvv|cvc)`;
const CODE_RE = new RegExp(
  `(${WORD_START}${CODE_LABEL}${WORD_END})(${VALUE_SEPARATOR})(\\d(?:[\\d\\s\\u00a0\\u2000-\\u200a\\u202f.\\-–—]{0,38}\\d)?)`,
  "giu",
);

const RECOVERY_LABEL = String.raw`(?:seed[\s-]*(?:phrase|fraza(?:si)?)|recovery[\s-]+phrase|mnemonic(?:[\s-]+phrase)?|сид[\s-]*фраз(?:а|ы|у|е|ой)?|мнемоническ(?:ая|ую|ой)\s+фраз(?:а|у|ы|е|ой)|tiklash\s+(?:iborasi|so['’]?zlari))`;
const RECOVERY_RE = new RegExp(
  `(${WORD_START}${RECOVERY_LABEL}${WORD_END})(${VALUE_SEPARATOR})([^\\r\\n]{1,400})`,
  "giu",
);

const PRIVATE_KEY_LABEL = String.raw`(?:private[\s-]+key|приватн(?:ый|ого|ому|ым)\s+ключ|maxfiy\s+kalit)`;
const PRIVATE_KEY_RE = new RegExp(
  `(${WORD_START}${PRIVATE_KEY_LABEL}${WORD_END})(${VALUE_SEPARATOR})([A-Za-z0-9+/_=-]{16,240})`,
  "giu",
);
const PEM_PRIVATE_KEY_RE =
  /-----BEGIN ((?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?PRIVATE KEY)-----[\s\S]{1,16384}?-----END \1-----/giu;

const PASSWORD_CONTEXT_WORDS = new Set([
  "change",
  "changed",
  "authentication",
  "failed",
  "field",
  "length",
  "manager",
  "must",
  "policy",
  "protection",
  "requirements",
  "required",
  "\u043d\u0435\u043e\u0431\u0445\u043e\u0434\u0438\u043c\u043e",
  "\u043d\u0443\u0436\u043d\u043e",
  "\u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f",
  "\u0434\u043e\u043b\u0436\u0435\u043d",
  "\u0434\u043e\u043b\u0436\u043d\u0430",
  "\u0434\u043e\u043b\u0436\u043d\u044b",
  "reset",
  "security",
  "sharing",
  "should",
  "support",
  "менеджер",
  "политика",
  "сброс",
  "сменить",
  "безопасность",
  "himoya",
  "o'zgartirish",
  "xavfsizlik",
]);

function unquote(value: string): string {
  return value
    .replace(/^["'`]|["'`]$/gu, "")
    .replace(/[.,!?;:]+$/gu, "")
    .trim();
}

function isLikelyPasswordValue(value: string, separator: string): boolean {
  const candidate = unquote(value);
  if (candidate.length < 4 || candidate === HIDDEN_VALUE) return false;
  // Preserve the established phone masker when a report quotes a phone after
  // a password label; redactText applies that type-specific control next.
  if (/^\+[\d\s()-]{6,}\d$/u.test(candidate)) return false;
  if (/[:=]/u.test(separator) || /\b(?:is|это|bu)\b/iu.test(separator)) return true;
  if (/[\p{N}\p{P}\p{S}]/u.test(candidate)) return true;
  return candidate.length >= 8 && !PASSWORD_CONTEXT_WORDS.has(candidate.toLowerCase());
}

function startsWithPhoneShapedValue(value: string): boolean {
  return /^\+[\d\s()-]{6,}\d(?=$|\s)/u.test(value.trim());
}

function codeDigitBounds(label: string): { min: number; max: number } {
  return /(?:cvv|cvc)/iu.test(label) ? { min: 3, max: 4 } : { min: 4, max: 8 };
}

function recoverySegmentEnd(value: string): number {
  const punctuation = value.search(/[.!?;]/u);
  return punctuation === -1 ? value.length : punctuation;
}

export function sanitizeSensitiveTextForSink(input: string): SensitiveTextSanitization {
  const classes = new Set<SensitiveSecretClass>();

  let value = input.replace(PEM_PRIVATE_KEY_RE, () => {
    classes.add("private_key");
    return HIDDEN_VALUE;
  });

  value = value.replace(
    RECOVERY_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      const segmentEnd = recoverySegmentEnd(candidate);
      const segment = candidate.slice(0, segmentEnd);
      const words = segment.match(/[\p{L}\p{M}][\p{L}\p{M}'’-]{1,31}/gu) ?? [];
      if (words.length < 12) return match;
      classes.add("recovery_phrase");
      return `${label}${separator}${HIDDEN_VALUE}${candidate.slice(segmentEnd)}`;
    },
  );

  value = value.replace(PRIVATE_KEY_RE, (_match: string, label: string, separator: string) => {
    classes.add("private_key");
    return `${label}${separator}${HIDDEN_VALUE}`;
  });

  value = value.replace(
    EXPLICIT_PASSWORD_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      if (candidate.trim() === HIDDEN_VALUE || startsWithPhoneShapedValue(candidate)) return match;
      classes.add("password");
      return `${label}${separator}${HIDDEN_VALUE}`;
    },
  );

  value = value.replace(
    PASSWORD_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      if (!isLikelyPasswordValue(candidate, separator)) return match;
      classes.add("password");
      return `${label}${separator}${HIDDEN_VALUE}`;
    },
  );

  value = value.replace(
    CODE_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      const digits = candidate.replace(/\D/gu, "");
      const { min, max } = codeDigitBounds(label);
      if (digits.length < min || digits.length > max) return match;
      classes.add("code");
      return `${label}${separator}${HIDDEN_VALUE}`;
    },
  );

  return { value, redacted: classes.size > 0, classes: [...classes] };
}

export function redactSensitiveSecrets(input: string): string {
  return sanitizeSensitiveTextForSink(input).value;
}
