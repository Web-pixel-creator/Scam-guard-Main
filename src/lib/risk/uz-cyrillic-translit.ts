/**
 * Uzbek Cyrillic → Uzbek Latin transliteration for classifier matching only.
 *
 * Many elderly users in Uzbekistan type Uzbek in Cyrillic script
 * («Хавфсиз ҳисобга пул ўтказинг»), while the deterministic rules in
 * `rules.ts` carry their Uzbek patterns in Latin script (`xavfsiz hisob`,
 * `pul o'tkaz`, `karta raqam`). This module produces a Latin-script matching
 * variant so those existing patterns apply to Cyrillic-script Uzbek input.
 *
 * The returned variant is classifier input only: it must never replace the
 * user's original text in replies, persistence, redaction or audit logs.
 */

/** Letters that exist in Uzbek Cyrillic but not in Russian. */
const UZ_SPECIFIC_LETTER_RE = /[ўқғҳ]/iu;

/**
 * Uzbek verb/particle morphology that survives in Cyrillic script even when a
 * sentence happens to avoid ў/қ/ғ/ҳ («СМС кодни айтинг деб ёзишяпти»). Word
 * boundaries keep Russian words such as «дебет» from matching.
 */
const UZ_CYRILLIC_MORPHOLOGY_RE =
  /(?:япти|дейиш|моқда|тугма|кодни(?![\p{L}])|(?<![\p{L}])деб(?![\p{L}])|(?<![\p{L}])ишонч(?![\p{L}]))/iu;

const CYRILLIC_RE = /[Ѐ-ӿ]/u;

/** True when Cyrillic text carries an Uzbek-language signal worth a variant pass. */
export function looksLikeUzbekCyrillic(text: string): boolean {
  if (!CYRILLIC_RE.test(text)) return false;
  return UZ_SPECIFIC_LETTER_RE.test(text) || UZ_CYRILLIC_MORPHOLOGY_RE.test(text);
}

// 1995 Uzbek Latin orthography, ASCII apostrophe variant (o', g') — the same
// spelling family the rule patterns use via the ['’] character class.
const UZ_CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = Object.freeze({
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "'",
  ь: "",
  ы: "i",
  э: "e",
  ю: "yu",
  я: "ya",
  ў: "o'",
  қ: "q",
  ғ: "g'",
  ҳ: "h",
});

/**
 * Transliterate every Cyrillic letter to lowercase Uzbek Latin; all other
 * characters (digits, punctuation, Latin, emoji) pass through unchanged.
 * Output casing is irrelevant because every consuming pattern is /i.
 */
export function transliterateUzCyrillicToLatin(text: string): string {
  let out = "";
  for (const character of text) {
    const lower = character.toLowerCase();
    const mapped = UZ_CYRILLIC_TO_LATIN[lower];
    out += mapped !== undefined ? mapped : character;
  }
  return out;
}

/**
 * Latin matching variant for likely Uzbek Cyrillic input, or null when the
 * text carries no Uzbek signal (pure Russian/Latin input stays single-pass).
 */
export function uzbekLatinMatchingVariant(text: string): string | null {
  if (!looksLikeUzbekCyrillic(text)) return null;
  const variant = transliterateUzCyrillicToLatin(text);
  return variant === text ? null : variant;
}
