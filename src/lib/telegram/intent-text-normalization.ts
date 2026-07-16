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
  return text
    .normalize("NFKC")
    .replace(INVISIBLE_FORMAT_RE, "")
    .replace(APOSTROPHE_RE, "'")
    .replace(TOKEN_RE, repairIsolatedConfusable)
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}
