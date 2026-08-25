export type SensitiveSecretClass =
  | "password"
  | "code"
  | "recovery_phrase"
  | "private_key"
  | "access_token";

export interface SensitiveTextSanitization {
  value: string;
  redacted: boolean;
  classes: readonly SensitiveSecretClass[];
}

const HIDDEN_VALUE = "••••";
const WORD_START = String.raw`(?<![\p{L}\p{N}_])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_])`;
// People often paste a credential after one visual delimiter instead of a
// colon: `password🟠secret`, `SMS kodi 👉 123456`, or `OTP → 123456`.
// Keep this deliberately bounded to one pictograph/arrow. A broad `\p{S}+`
// separator would turn ordinary prose and emoji-heavy advice into secrets.
const VISUAL_VALUE_SEPARATOR = String.raw`(?:[→➜➤➡➔⇢⇒]|\p{Extended_Pictographic}(?:\uFE0E|\uFE0F|\p{Emoji_Modifier})?)`;
const EXPLICIT_VALUE_SEPARATOR = String.raw`(?:\s*[:=]\s*|\s*${VISUAL_VALUE_SEPARATOR}\s*|\s+(?:is|это|bu)\s+)`;
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

const PASSWORD_LABEL = String.raw`(?:${CONFUSABLE_PASSWORD_LABEL}|pasword|${FULLY_SPACED_PASSWORD_LABEL}|passphrase|парол(?:ь|я|ем|ю|им|ингиз|ини|ни|га|дан)?|parol(?:i|im|ingiz|ni|ini|ga|dan)?|maxfiy\s+so['’]?z|махфий\s+(?:сўз|суз))`;
const PASSWORD_LABEL_END = String.raw`(?![\p{L}\p{N}_]|[!@#$%^&*._-]+\p{N})`;
const EXPLICIT_PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})(${EXPLICIT_VALUE_SEPARATOR})([^\\r\\n.!?;]{4,240})`,
  "giu",
);
const PASSWORD_RE = new RegExp(
  `(${WORD_START}${PASSWORD_LABEL}${PASSWORD_LABEL_END})((?:\\s*[:=,;–—-]\\s*|\\s+(?:is|это|bu)\\s+|\\s+))("[^"\\r\\n]{4,160}"|'[^'\\r\\n]{4,160}'|\\S{4,160})`,
  "giu",
);

const CODE_LABEL = String.raw`(?:otp(?:\s+code)?|sms[\s-]*(?:code|kod|код)|смс[\s-]*код|код(?:им|ингиз|ини|ни|и)?(?:\s+(?:подтверждения|из\s+смс))?|kod(?:im|ingiz|ini|ni|i)?|(?:verification|verificaton)[\s-]+code|confirmation[\s-]+code|tasdiq(?:lash)?[\s-]+kod(?:i)?|bir[\s-]+martalik[\s-]+kod|pin|пин|cvv|cvc)`;
const CODE_ADJACENCY_SEPARATOR = String.raw`(?:\s+(?:is|это|bu)\s+|[\s,;:=#№/–—()\[\]-]+|\s*${VISUAL_VALUE_SEPARATOR}\s*)`;
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

// Unlabelled values are intentionally much narrower than labelled secrets.
// A 64-hex digest is indistinguishable from a raw private key, and a normal
// twelve-word sentence can look like a mnemonic. Sink redaction deliberately
// prefers hiding an occasional digest over exposing a key. Bare mnemonics stay
// bounded to canonical word counts and a phrase-like shape.
const STANDALONE_HEX_PRIVATE_KEY_RE = /^(\s*)((?:0x)?[0-9a-f]{64})(\s*)$/iu;
const EMBEDDED_HEX_PRIVATE_KEY_RE = /(?<![\p{L}\p{N}_])(?:0x)?[0-9a-f]{64}(?![\p{L}\p{N}_])/giu;
const STANDALONE_THREE_DIGIT_CODE_RE = /^(\s*)(\d{3})([?!.,;:\s]*)$/u;
const STANDALONE_RECOVERY_PHRASE_RE = /^(\s*)([a-z]+(?:[^\S\r\n]+[a-z]+){11,23})(\s*)$/iu;
const HIGH_CONFIDENCE_BIP39_WORDS = new Set([
  "abandon",
  "ability",
  "able",
  "about",
  "above",
  "absent",
  "absorb",
  "abstract",
  "absurd",
  "abuse",
  "access",
  "accident",
  "account",
  "accuse",
  "achieve",
  "acid",
  "acoustic",
  "acquire",
  "across",
  "act",
  "action",
  "actor",
  "actress",
  "actual",
  "apple",
  "bicycle",
  "book",
  "candle",
  "cloud",
  "dragon",
  "eagle",
  "forest",
  "garden",
  "gold",
  "harbor",
  "island",
  "jungle",
  "kitten",
  "lamp",
  "lemon",
  "mint",
  "moon",
  "ocean",
  "river",
  "stone",
  "train",
]);

// Access credentials use only high-confidence shapes. Generic long words,
// phone numbers and normal URLs must remain visible; an explicit label,
// Authorization header or provider-issued prefix is required.
const ACCESS_TOKEN_VALUE = String.raw`[A-Za-z0-9][A-Za-z0-9._~+/=-]{11,2047}`;
const ACCESS_TOKEN_LABEL = String.raw`(?:api[\s_-]*(?:key|token)|access[\s_-]*token|bot[\s_-]*token)`;
const LABELED_ACCESS_TOKEN_RE = new RegExp(
  `(${WORD_START}${ACCESS_TOKEN_LABEL}${WORD_END})(\\s*[:=]\\s*|\\s+)(${ACCESS_TOKEN_VALUE})`,
  "giu",
);
const AUTHORIZATION_BEARER_RE = new RegExp(
  `(${WORD_START}authorization${WORD_END}\\s*:\\s*bearer\\s+)(${ACCESS_TOKEN_VALUE})`,
  "giu",
);
const BARE_BEARER_RE = new RegExp(
  `(${WORD_START}bearer${WORD_END}(?:${EXPLICIT_VALUE_SEPARATOR}|\\s+))(${ACCESS_TOKEN_VALUE})`,
  "giu",
);
const GENERIC_LABELED_TOKEN_RE = new RegExp(
  `(${WORD_START}token${WORD_END})(\\s*[:=]\\s*)(${ACCESS_TOKEN_VALUE})`,
  "giu",
);
const TELEGRAM_BOT_TOKEN_RE =
  /(?<![\p{L}\p{N}_:+-])\d{6,12}:AA[A-Za-z0-9_-]{28,62}(?![\p{L}\p{N}_-])/gu;
const HIGH_CONFIDENCE_ACCESS_TOKEN_RE =
  /(?<![\p{L}\p{N}_-])(?:eyJ[A-Za-z0-9_-]{5,512}\.[A-Za-z0-9_-]{8,2048}\.[A-Za-z0-9_-]{8,1024}|AIza[A-Za-z0-9_-]{35}|(?:AKIA|ASIA)[A-Z0-9]{16}|sk-(?:proj-)?[A-Za-z0-9_-]{16,240}|github_pat_[A-Za-z0-9_]{20,240}|gh[pousr]_[A-Za-z0-9]{20,240}|glpat-[A-Za-z0-9_-]{20,240}|xox[baprs]-[A-Za-z0-9-]{16,240}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,240})(?![\p{L}\p{N}_-])/gu;

function isLikelyLabeledAccessToken(value: string, minimumLength = 20): boolean {
  const hasHighConfidencePrefix = HIGH_CONFIDENCE_ACCESS_TOKEN_RE.test(value);
  HIGH_CONFIDENCE_ACCESS_TOKEN_RE.lastIndex = 0;
  if (hasHighConfidencePrefix) return true;
  if (
    value.length < minimumLength ||
    /(?:placeholder|not[-_]?a[-_]?complete|documentation|your[-_]?token)/iu.test(value)
  ) {
    return false;
  }
  return /[A-Za-z]/u.test(value) && new Set(value.toLowerCase()).size >= 8;
}

function redactStandaloneHighConfidenceSecret(
  input: string,
  classes: Set<SensitiveSecretClass>,
): string {
  const recovery = input.match(STANDALONE_RECOVERY_PHRASE_RE);
  if (recovery) {
    const words = (recovery[2] ?? "").toLowerCase().split(/[^\S\r\n]+/u);
    const allKnownWords = words.every((word) => HIGH_CONFIDENCE_BIP39_WORDS.has(word));
    if (RECOVERY_WORD_COUNTS.has(words.length) && allKnownWords) {
      classes.add("recovery_phrase");
      return `${recovery[1] ?? ""}${HIDDEN_VALUE}${recovery[3] ?? ""}`;
    }
  }

  const privateKey = input.match(STANDALONE_HEX_PRIVATE_KEY_RE);
  if (privateKey) {
    classes.add("private_key");
    return `${privateKey[1] ?? ""}${HIDDEN_VALUE}${privateKey[3] ?? ""}`;
  }

  const threeDigitCode = input.match(STANDALONE_THREE_DIGIT_CODE_RE);
  if (threeDigitCode) {
    classes.add("code");
    return `${threeDigitCode[1] ?? ""}${HIDDEN_VALUE}${threeDigitCode[3] ?? ""}`;
  }

  return input;
}

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
  const leadingWord = candidate.match(/^[\p{L}\p{M}'’-]+/u)?.[0]?.toLowerCase();
  if (
    PASSWORD_CONTEXT_WORDS.has(candidate.toLowerCase()) ||
    (leadingWord !== undefined && PASSWORD_CONTEXT_WORDS.has(leadingWord))
  ) {
    return false;
  }
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

  let value = redactStandaloneHighConfidenceSecret(input, classes).replace(
    PEM_PRIVATE_KEY_RE,
    () => {
      classes.add("private_key");
      return HIDDEN_VALUE;
    },
  );

  value = value.replace(EMBEDDED_HEX_PRIVATE_KEY_RE, () => {
    classes.add("private_key");
    return HIDDEN_VALUE;
  });

  value = value.replace(AUTHORIZATION_BEARER_RE, (_match: string, label: string) => {
    classes.add("access_token");
    return `${label}${HIDDEN_VALUE}`;
  });

  value = value.replace(BARE_BEARER_RE, (match: string, label: string, candidate: string) => {
    if (!isLikelyLabeledAccessToken(candidate, 16)) return match;
    classes.add("access_token");
    return `${label}${HIDDEN_VALUE}`;
  });

  value = value.replace(
    GENERIC_LABELED_TOKEN_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      if (!isLikelyLabeledAccessToken(candidate)) return match;
      classes.add("access_token");
      return `${label}${separator}${HIDDEN_VALUE}`;
    },
  );

  value = value.replace(
    LABELED_ACCESS_TOKEN_RE,
    (match: string, label: string, separator: string, candidate: string) => {
      if (!isLikelyLabeledAccessToken(candidate)) return match;
      classes.add("access_token");
      return `${label}${separator}${HIDDEN_VALUE}`;
    },
  );

  value = value.replace(TELEGRAM_BOT_TOKEN_RE, () => {
    classes.add("access_token");
    return HIDDEN_VALUE;
  });

  value = value.replace(HIGH_CONFIDENCE_ACCESS_TOKEN_RE, () => {
    classes.add("access_token");
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
      if (!isLikelyPasswordValue(candidate, separator) || startsWithPhoneShapedValue(candidate)) {
        return match;
      }
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
