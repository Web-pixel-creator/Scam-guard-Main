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

const PASSWORD_LABEL = String.raw`(?:password|passphrase|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini|ga|dan)?|maxfiy\s+so['’]?z)`;
const PASSWORD_LABEL_END = String.raw`(?![\p{L}\p{N}_]|[!@#$%^&*._-]+\p{N})`;
const EXPLICIT_PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})(${EXPLICIT_VALUE_SEPARATOR})([^\\r\\n.!?;]{4,240})`,
  "giu",
);
const PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})((?:\\s*[:=,;–—-]\\s*|\\s+(?:is|это|bu)\\s+|\\s+))("[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160})`,
  "giu",
);

const CODE_LABEL = String.raw`(?:otp(?:\s+code)?|sms[\s-]*(?:code|kod|код)|смс[\s-]*код|код(?:\s+(?:подтверждения|из\s+смс))?|verification[\s-]+code|confirmation[\s-]+code|tasdiq(?:lash)?[\s-]+kod(?:i)?|bir[\s-]+martalik[\s-]+kod|pin|пин|cvv|cvc)`;
const CODE_ADJACENCY_SEPARATOR = String.raw`(?:\s+(?:is|это|bu)\s+|[\s,;:=#№/–—()\[\]-]+)`;
const CODE_RE = new RegExp(
  `(${WORD_START}${CODE_LABEL}${WORD_END})(${CODE_ADJACENCY_SEPARATOR})(\\d(?:[\\d\\s\\u00a0\\u2000-\\u200a\\u202f.\\-–—]{0,38}\\d)?)`,
  "giu",
);
const VALUE_FIRST_GROUPED_CODE_RE = new RegExp(
  `(${WORD_START}\\d{1,4}(?:[\\s\\u00a0\\u2000-\\u200a\\u202f.\\-–—]+\\d{1,4}){1,7})(${CODE_ADJACENCY_SEPARATOR})(${CODE_LABEL}${WORD_END})`,
  "giu",
);
const VALUE_FIRST_COMPACT_CODE_RE = new RegExp(
  `(${WORD_START}\\d{3,8})(${CODE_ADJACENCY_SEPARATOR})(${CODE_LABEL}${WORD_END})`,
  "giu",
);
const VALUE_FIRST_PASSWORD_RE = new RegExp(
  `(${WORD_START}(?:"[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160}))(${CODE_ADJACENCY_SEPARATOR})(${PASSWORD_LABEL}${PASSWORD_LABEL_END})`,
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
  "current",
  "disclose",
  "enter",
  "failed",
  "field",
  "forward",
  "give",
  "incorrect",
  "invalid",
  "length",
  "manager",
  "must",
  "new",
  "old",
  "policy",
  "provide",
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
  "reveal",
  "security",
  "secure",
  "send",
  "share",
  "sharing",
  "show",
  "should",
  "strong",
  "support",
  "submit",
  "tell",
  "temporary",
  "valid",
  "weak",
  "upload",
  "менеджер",
  "политика",
  "сброс",
  "сменить",
  "безопасность",
  "безопасный",
  "временный",
  "надежный",
  "надёжный",
  "неверный",
  "новый",
  "старый",
  "текущий",
  "введите",
  "вводить",
  "отправить",
  "отправьте",
  "передайте",
  "поделитесь",
  "покажите",
  "прислать",
  "пришлите",
  "продиктуйте",
  "сообщите",
  "eski",
  "himoya",
  "ishonchli",
  "noto'g'ri",
  "o'zgartirish",
  "vaqtinchalik",
  "xavfsizlik",
  "yangi",
  "ayting",
  "bering",
  "kiritish",
  "kiriting",
  "kiritmang",
  "ko'rsating",
  "korsating",
  "jo'nating",
  "jo'natishni",
  "ulashing",
  "yuboring",
  "yuborishni",
  "yubormang",
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
  if (PASSWORD_CONTEXT_WORDS.has(candidate.toLowerCase())) return false;
  if (/[:=]/u.test(separator) || /\b(?:is|это|bu)\b/iu.test(separator)) return true;
  if (/[\p{N}\p{P}\p{S}]/u.test(candidate)) return true;
  return candidate.length >= 8;
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

  // Natural messages often put the value before the label. Run the grouped
  // pattern first, then the compact one: if an unrelated order number precedes
  // "614 CVV", the broad match can decline it and the compact pass still masks
  // the nearest valid code instead of leaving the CVV exposed.
  for (const pattern of [VALUE_FIRST_GROUPED_CODE_RE, VALUE_FIRST_COMPACT_CODE_RE]) {
    value = value.replace(
      pattern,
      (match: string, candidate: string, separator: string, label: string) => {
        const digits = candidate.replace(/\D/gu, "");
        const { min, max } = codeDigitBounds(label);
        if (digits.length < min || digits.length > max) return match;
        classes.add("code");
        return `${HIDDEN_VALUE}${separator}${label}`;
      },
    );
  }

  value = value.replace(
    VALUE_FIRST_PASSWORD_RE,
    (match: string, candidate: string, separator: string, label: string) => {
      if (!isLikelyPasswordValue(candidate, separator)) return match;
      classes.add("password");
      return `${HIDDEN_VALUE}${separator}${label}`;
    },
  );

  return { value, redacted: classes.size > 0, classes: [...classes] };
}

export function redactSensitiveSecrets(input: string): string {
  return sanitizeSensitiveTextForSink(input).value;
}
