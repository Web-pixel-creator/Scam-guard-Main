/**
 * Normalize user text for intent matching only.
 *
 * The returned value must never replace the original user text in replies,
 * persistence, audit logs, or secret handling. In particular, the conservative
 * confusable repair below is useful for classifiers but is not a canonical form
 * of the user's input.
 */

// Intent matching must not be bypassed with invisible formatting controls.
// This is deliberately broader than ordinary whitespace normalization and is
// safe here because the normalized value is never shown or persisted.
const INVISIBLE_FORMAT_RE =
  // eslint-disable-next-line no-misleading-character-class -- these combining marks and variation selectors are intentionally removed for classifier-only normalization.
  /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0100}-\u{E01EF}]/gu;
const APOSTROPHE_RE = /[‘’ʻʼ`´]/gu;
const TOKEN_RE = /[\p{L}\p{M}\p{N}_'-]+/gu;
const LATIN_RE = /\p{Script=Latin}/u;
const CYRILLIC_RE = /\p{Script=Cyrillic}/u;

const LATIN_TO_CYRILLIC: Readonly<Record<string, string>> = Object.freeze({
  A: "А",
  a: "а",
  B: "В",
  C: "С",
  c: "с",
  E: "Е",
  e: "е",
  H: "Н",
  K: "К",
  k: "к",
  M: "М",
  O: "О",
  o: "о",
  P: "Р",
  p: "р",
  T: "Т",
  X: "Х",
  x: "х",
  Y: "У",
  y: "у",
});

const CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(LATIN_TO_CYRILLIC).map(([latin, cyrillic]) => [cyrillic, latin]),
  ),
);

// Rejoin only a small allow-list of security terms when every letter was
// separated with whitespace ("п р и ш л и т е к о д"). A generic single-letter
// join would corrupt initials, names and ordinary prose, so additions here
// require a concrete detector use-case and negative tests.
const SPACED_SECURITY_TERMS = [
  "продиктуйте",
  "переведите",
  "отправьте",
  "сообщите",
  "пришлите",
  "назовите",
  "безопасный",
  "срочно",
  "счет",
  "код",
  "смс",
  "из",
  "yuboring",
  "otkazing",
  "xavfsiz",
  "hisob",
  "ayting",
  "urgent",
  "transfer",
  "account",
  "code",
  "send",
  "tell",
  "safe",
  "sms",
] as const;

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SPACED_SECURITY_TERM_PATTERNS = SPACED_SECURITY_TERMS.map(
  (term) =>
    [
      new RegExp(
        `(?<![\\p{L}\\p{N}_])${Array.from(term)
          .map(escapeRegexLiteral)
          .join("\\s+")}(?![\\p{L}\\p{N}_])`,
        "giu",
      ),
      term,
    ] as const,
);

const BOUNDED_ZERO_LEET_REPAIRS = [
  [/(?<![\p{L}\p{N}_])к0д(?![\p{L}\p{N}_])/giu, "код"],
  [/(?<![\p{L}\p{N}_])срочн0(?![\p{L}\p{N}_])/giu, "срочно"],
  [/(?<![\p{L}\p{N}_])п0р0ль(?![\p{L}\p{N}_])/giu, "пароль"],
  [/(?<![\p{L}\p{N}_])c0de(?![\p{L}\p{N}_])/giu, "code"],
  [/(?<![\p{L}\p{N}_])0tp(?![\p{L}\p{N}_])/giu, "otp"],
] as const;

function repairBoundedSecurityObfuscation(text: string): string {
  let repaired = text;
  for (const [pattern, replacement] of SPACED_SECURITY_TERM_PATTERNS) {
    repaired = repaired.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of BOUNDED_ZERO_LEET_REPAIRS) {
    repaired = repaired.replace(pattern, replacement);
  }
  return repaired;
}

function repairIsolatedConfusable(token: string): string {
  const characters = Array.from(token);
  let latinCount = 0;
  let cyrillicCount = 0;

  for (const character of characters) {
    if (LATIN_RE.test(character)) latinCount += 1;
    else if (CYRILLIC_RE.test(character)) cyrillicCount += 1;
  }

  // Repair exactly one minority-script letter only. Requiring at least two
  // dominant-script letters covers short attacks such as "кoд" while leaving
  // balanced or genuinely mixed-script words untouched.
  if (latinCount >= 2 && cyrillicCount === 1) {
    return characters.map((character) => CYRILLIC_TO_LATIN[character] ?? character).join("");
  }
  if (cyrillicCount >= 2 && latinCount === 1) {
    return characters.map((character) => LATIN_TO_CYRILLIC[character] ?? character).join("");
  }
  return token;
}

export function normalizeIntentTextForMatching(text: string): string {
  const normalized = text
    .normalize("NFKC")
    .replace(INVISIBLE_FORMAT_RE, "")
    .replace(APOSTROPHE_RE, "'")
    .replace(TOKEN_RE, repairIsolatedConfusable)
    .toLowerCase();

  return repairBoundedSecurityObfuscation(normalized).replace(/\s+/gu, " ").trim();
}
