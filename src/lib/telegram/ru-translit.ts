// Latin-keyboard fallback for Russian victim phrases («menya obmanuli»,
// «vzlomali telegram»). Used strictly as a SECOND classification attempt
// after the original text matched nothing, so native Uzbek Latin phrases —
// which the classifiers understand directly — are never affected: if they
// matched on the first pass, the fallback does not run; if they did not,
// their transliteration matches nothing either.

const MULTI: Array<[RegExp, string]> = [
  [/shch/g, "щ"],
  [/sch/g, "щ"],
  [/zh/g, "ж"],
  [/kh/g, "х"],
  [/ts/g, "ц"],
  [/ch/g, "ч"],
  [/sh/g, "ш"],
  [/yu/g, "ю"],
  [/ju/g, "ю"],
  [/ya/g, "я"],
  [/ja/g, "я"],
  [/yo/g, "е"], // ё is normalized to е everywhere downstream
  [/jo/g, "е"],
  [/ye/g, "е"],
];

const SINGLE: Record<string, string> = {
  a: "а",
  b: "б",
  c: "ц",
  d: "д",
  e: "е",
  f: "ф",
  g: "г",
  h: "х",
  i: "и",
  j: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  q: "к",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  v: "в",
  w: "в",
  x: "х",
  y: "ы",
  z: "з",
};

/**
 * Transliterate latin letters to Cyrillic. Returns `null` when the text has
 * no latin letters (nothing to do) — callers then skip the second pass.
 * Expects already-lowercased input (both classifiers normalize first).
 */
export function transliterateRuLatin(text: string): string | null {
  if (!/[a-z]/.test(text)) return null;
  let out = text;
  for (const [re, rep] of MULTI) out = out.replace(re, rep);
  out = out.replace(/[a-z]/g, (ch) => SINGLE[ch] ?? ch);
  return out === text ? null : out;
}
