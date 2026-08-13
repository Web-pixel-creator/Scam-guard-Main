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
const HORIZONTAL_SPACE = String.raw`[^\S\r\n]+`;

// Exact allow-list only. These sources recognize a label whose every ASCII
// letter is separated with horizontal whitespace, without normalizing or
// rewriting any other part of the input.
function fullySpacedAsciiLabel(value: string): string {
  return Array.from(value.replace(/\s+/gu, "")).join(HORIZONTAL_SPACE);
}

const FULLY_SPACED_PASSWORD_LABEL = fullySpacedAsciiLabel("password");
const FULLY_SPACED_RECOVERY_LABEL = fullySpacedAsciiLabel("seed phrase");
const FULLY_SPACED_PRIVATE_KEY_LABEL = fullySpacedAsciiLabel("private key");
// Accept only the Cyrillic homoglyphs that can visually replace letters in
// `password`. Matching the label in-place lets every sink preserve the exact
// source text while replacing only the adjacent secret value.
const CONFUSABLE_PASSWORD_LABEL = String.raw`[p\u0440][a\u0430][s\u0441][s\u0441]w[o\u043e]rd`;

const PASSWORD_LABEL = String.raw`(?:${CONFUSABLE_PASSWORD_LABEL}|pasword|${FULLY_SPACED_PASSWORD_LABEL}|passphrase|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini|ga|dan)?|maxfiy\s+so['’]?z|махфий\s+(?:сўз|суз))`;
const PASSWORD_LABEL_END = String.raw`(?![\p{L}\p{N}_]|[!@#$%^&*._-]+\p{N})`;
const EXPLICIT_PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})(${EXPLICIT_VALUE_SEPARATOR})([^\\r\\n.!?;]{4,240})`,
  "giu",
);
const PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})((?:\\s*[:=,;–—-]\\s*|\\s+(?:is|это|bu)\\s+|\\s+))("[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160})`,
  "giu",
);

const CODE_LABEL = String.raw`(?:otp(?:\s+code)?|sms[\s-]*(?:code|kod|код)|смс[\s-]*код|код(?:\s+(?:подтверждения|из\s+смс))?|(?:verification|verificaton)[\s-]+code|confirmation[\s-]+code|tasdiq(?:lash)?[\s-]+kod(?:i)?|bir[\s-]+martalik[\s-]+kod|pin|пин|cvv|cvc)`;
const CODE_ADJACENCY_SEPARATOR = String.raw`(?:\s+(?:is|это|bu)\s+|[\s,;:=#№/–—()\[\]-]+)`;
const CODE_RE = new RegExp(
  `(${WORD_START}${CODE_LABEL}${WORD_END})(${CODE_ADJACENCY_SEPARATOR})(\\d(?:[\\d\\s\\u00a0\\u2000-\\u200a\\u202f.\\-–—]{0,38}\\d)?)`,
  "giu",
);
const FORMATTED_ALPHANUMERIC_CODE_VALUE = String.raw`(?=[A-Za-z0-9._ -]{4,32}${WORD_END})(?=[A-Za-z0-9._ -]*[A-Za-z])(?=[A-Za-z0-9._ -]*\d)[A-Za-z0-9]+(?:[._ -][A-Za-z0-9]+){0,5}`;
const ALPHANUMERIC_CODE_RE = new RegExp(
  `(${WORD_START}${CODE_LABEL}${WORD_END})(${CODE_ADJACENCY_SEPARATOR})(${FORMATTED_ALPHANUMERIC_CODE_VALUE})`,
  "giu",
);
const CODE_ACTION = String.raw`(?:enter|type|send|share|tell|dictate|kiriting|ayting|yuboring|jo['’]?nating|введ(?:и|ите)|назов(?:и|ите)|сообщ(?:и|ите)|отправ(?:ь|ьте)|продиктуй(?:те)?)`;
const ACTION_SEPARATED_CODE_RE = new RegExp(
  `(${WORD_START}(?:${CODE_LABEL}|kod(?:ni|ini))${WORD_END})([^\\r\\n\\d]{0,48}${CODE_ACTION}[^\\r\\n\\d]{0,24})(\\d{4,8}${WORD_END})`,
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
const VALUE_FIRST_ALPHANUMERIC_CODE_RE = new RegExp(
  `(${WORD_START}${FORMATTED_ALPHANUMERIC_CODE_VALUE})(${CODE_ADJACENCY_SEPARATOR})(?:(?:the|этот|бу)[^\\S\\r\\n]+)?(${CODE_LABEL}${WORD_END})`,
  "giu",
);
const VALUE_FIRST_PASSWORD_RE = new RegExp(
  `(${WORD_START}(?:"[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160}))(${CODE_ADJACENCY_SEPARATOR})(${PASSWORD_LABEL}${PASSWORD_LABEL_END})`,
  "giu",
);
const VALUE_FIRST_MULTIWORD_PASSWORD_RE = new RegExp(
  `(${WORD_START}[\\p{L}]{2,32}(?:[^\\S\\r\\n]+[\\p{L}]{2,32}){2,7})([^\\S\\r\\n]*(?:[–—-]|(?:is|это|bu)[^\\S\\r\\n]+(?:the[^\\S\\r\\n]+)?))[^\\S\\r\\n]*((?:password|passphrase)${PASSWORD_LABEL_END})`,
  "giu",
);

const RECOVERY_LABEL = String.raw`(?:seed[\s-]*(?:phrase|phase|pharse|prhase|phrse|phras|fraza(?:si)?)|${FULLY_SPACED_RECOVERY_LABEL}|recovery[\s-]+(?:phrase|phase|pharse)|mnemonic(?:[\s-]+(?:phrase|phase))?|сид[\s-]*фраз(?:а|ы|у|е|ой)?|мнемоническ(?:ая|ую|ой)\s+фраз(?:а|у|ы|е|ой)|tiklash\s+(?:iborasi|so['’]?zlari)|тиклаш\s+(?:ибораси|сўзлари|сузлари))`;
const RECOVERY_RE = new RegExp(
  `(${WORD_START}${RECOVERY_LABEL}${WORD_END})(${VALUE_SEPARATOR})([^\\r\\n]{1,400})`,
  "giu",
);
const RECOVERY_WORD = String.raw`[\p{L}\p{M}][\p{L}\p{M}'’-]{1,31}`;
const MULTILINE_RECOVERY_LABEL_RE = new RegExp(
  `${WORD_START}${RECOVERY_LABEL}${WORD_END}[^\\S\\r\\n]*[:=]?[^\\S\\r\\n]*\\r?\\n`,
  "giu",
);
const RECOVERY_WORD_COUNTS = new Set([12, 15, 18, 21, 24]);
const PLAIN_RECOVERY_LINE_RE = new RegExp(`^[^\\S\\r\\n]*(${RECOVERY_WORD})[^\\S\\r\\n]*$`, "u");
const NUMBERED_RECOVERY_LINE_RE = new RegExp(
  `^[^\\S\\r\\n]*(\\d{1,2})([.)])[^\\S\\r\\n]+(${RECOVERY_WORD})[^\\S\\r\\n]*$`,
  "u",
);
const BULLETED_RECOVERY_LINE_RE = new RegExp(
  `^[^\\S\\r\\n]*([\u2022-])[^\\S\\r\\n]+(${RECOVERY_WORD})[^\\S\\r\\n]*$`,
  "u",
);

const PRIVATE_KEY_LABEL = String.raw`(?:private[\s-]+key|${FULLY_SPACED_PRIVATE_KEY_LABEL}|приватн(?:ый|ого|ому|ым)\s+ключ|maxfiy\s+kalit|махфий\s+калит)`;
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

type RecoveryLineStyle = "plain" | "numbered-dot" | "numbered-paren" | "dash" | "bullet";

interface RecoveryLine {
  contentEnd: number;
  style: RecoveryLineStyle;
  ordinal?: number;
}

function parseRecoveryLine(line: string, contentEnd: number): RecoveryLine | null {
  if (PLAIN_RECOVERY_LINE_RE.test(line)) return { contentEnd, style: "plain" };

  const numbered = line.match(NUMBERED_RECOVERY_LINE_RE);
  if (numbered) {
    return {
      contentEnd,
      style: numbered[2] === "." ? "numbered-dot" : "numbered-paren",
      ordinal: Number(numbered[1]),
    };
  }

  const bulleted = line.match(BULLETED_RECOVERY_LINE_RE);
  if (bulleted) {
    return { contentEnd, style: bulleted[1] === "-" ? "dash" : "bullet" };
  }
  return null;
}

function collectConsistentRecoveryLines(value: string, start: number): RecoveryLine[] {
  const lines: RecoveryLine[] = [];
  let cursor = start;
  let expectedStyle: RecoveryLineStyle | undefined;

  while (cursor < value.length && lines.length < 40) {
    const newline = value.indexOf("\n", cursor);
    const rawEnd = newline === -1 ? value.length : newline;
    const contentEnd = rawEnd > cursor && value[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    const parsed = parseRecoveryLine(value.slice(cursor, contentEnd), contentEnd);
    if (!parsed) break;

    expectedStyle ??= parsed.style;
    if (parsed.style !== expectedStyle) break;
    if (parsed.ordinal !== undefined && parsed.ordinal !== lines.length + 1) break;
    lines.push(parsed);

    if (newline === -1) break;
    cursor = newline + 1;
  }
  return lines;
}

function multilineRecoveryWordCount(lines: readonly RecoveryLine[]): number | null {
  if (RECOVERY_WORD_COUNTS.has(lines.length)) return lines.length;
  // With unprefixed phrases, one trailing one-word request (for example
  // "help") is syntactically indistinguishable from a recovery word. Keep the
  // bounded canonical phrase and leave exactly that one following line intact.
  if (
    lines[0]?.style === "plain" &&
    lines.length > 1 &&
    RECOVERY_WORD_COUNTS.has(lines.length - 1)
  ) {
    return lines.length - 1;
  }
  return null;
}

function redactMultilineRecoveryPhrases(input: string, classes: Set<SensitiveSecretClass>): string {
  let cursor = 0;
  let output = "";
  MULTILINE_RECOVERY_LABEL_RE.lastIndex = 0;

  for (let match = MULTILINE_RECOVERY_LABEL_RE.exec(input); match; ) {
    const blockStart = MULTILINE_RECOVERY_LABEL_RE.lastIndex;
    const lines = collectConsistentRecoveryLines(input, blockStart);
    const wordCount = multilineRecoveryWordCount(lines);
    if (wordCount === null) {
      match = MULTILINE_RECOVERY_LABEL_RE.exec(input);
      continue;
    }

    const redactEnd = lines[wordCount - 1].contentEnd;
    output += input.slice(cursor, blockStart) + HIDDEN_VALUE;
    cursor = redactEnd;
    classes.add("recovery_phrase");
    MULTILINE_RECOVERY_LABEL_RE.lastIndex = redactEnd;
    match = MULTILINE_RECOVERY_LABEL_RE.exec(input);
  }

  return cursor === 0 ? input : output + input.slice(cursor);
}

export function sanitizeSensitiveTextForSink(input: string): SensitiveTextSanitization {
  const classes = new Set<SensitiveSecretClass>();

  let value = input.replace(PEM_PRIVATE_KEY_RE, () => {
    classes.add("private_key");
    return HIDDEN_VALUE;
  });

  value = redactMultilineRecoveryPhrases(value, classes);

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
    ALPHANUMERIC_CODE_RE,
    (_match: string, label: string, separator: string) => {
      classes.add("code");
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

  // Human instructions can place an action between the label and value:
  // "kodni kiriting please: 1234". Keep the action visible for context while
  // preventing the actual code from crossing a Telegram/AI/storage sink.
  value = value.replace(
    ACTION_SEPARATED_CODE_RE,
    (_match: string, label: string, instruction: string) => {
      classes.add("code");
      return `${label}${instruction}${HIDDEN_VALUE}`;
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
    VALUE_FIRST_ALPHANUMERIC_CODE_RE,
    (_match: string, candidate: string, separator: string, label: string) => {
      classes.add("code");
      return `${HIDDEN_VALUE}${separator}${label}`;
    },
  );

  value = value.replace(
    VALUE_FIRST_MULTIWORD_PASSWORD_RE,
    (_match: string, _candidate: string, separator: string, label: string) => {
      classes.add("password");
      return `${HIDDEN_VALUE}${separator}${label}`;
    },
  );

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
