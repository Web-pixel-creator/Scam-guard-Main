// Domain Normalizer — Preprocesses domains before brand matching
//
// Pipeline: strip protocol → strip www → lowercase → decode punycode → apply homoglyphs
// On punycode decode failure, falls back to raw ASCII representation.

/**
 * Result of domain normalization: a fully normalized hostname and path.
 */
export interface NormalizedDomain {
  /** Lossy visual/transliteration skeleton used only to add suspicious evidence. */
  hostname: string;
  /** Canonical DNS identity used for official/news allowlist decisions. */
  hostnameIdentity: string;
  /** Path component (lowercase, homoglyphs applied) */
  path: string;
}

/**
 * Homoglyph map: visually similar characters that attackers substitute to
 * bypass brand detection. Maps confusable chars → their Latin equivalents.
 */
const HOMOGLYPH_MAP: ReadonlyMap<string, string> = new Map([
  // Cyrillic → Latin
  ["\u0430", "a"], // Cyrillic а → Latin a
  ["\u0435", "e"], // Cyrillic е → Latin e
  ["\u043E", "o"], // Cyrillic о → Latin o
  ["\u0440", "p"], // Cyrillic р → Latin p
  ["\u0441", "c"], // Cyrillic с → Latin c
  // Digit → Letter
  ["0", "o"], // zero → o
  ["1", "l"], // one → l
]);

const CYRILLIC_TRANSLITERATION_MAP: ReadonlyMap<string, string> = new Map([
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "g"],
  ["ғ", "g"],
  ["д", "d"],
  ["е", "e"],
  ["ё", "e"],
  ["ж", "zh"],
  ["з", "z"],
  ["и", "i"],
  ["і", "i"],
  ["ї", "i"],
  ["й", "y"],
  ["ј", "j"],
  ["к", "k"],
  ["қ", "q"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["ў", "o"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["ѕ", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ф", "f"],
  ["х", "x"],
  ["ҳ", "h"],
  ["ц", "c"],
  ["ч", "ch"],
  ["ш", "sh"],
  ["щ", "shch"],
  ["ъ", ""],
  ["ы", "y"],
  ["ь", ""],
  ["э", "e"],
  ["ю", "yu"],
  ["я", "ya"],
  ["ӏ", "l"],
]);

/**
 * Apply homoglyph normalization: replace known confusable characters
 * with their canonical Latin equivalents.
 */
function applyHomoglyphs(input: string): string {
  let result = "";
  for (const char of input) {
    result += HOMOGLYPH_MAP.get(char) ?? char;
  }
  return result;
}

function transliterateCyrillic(input: string): string {
  let result = "";
  for (const char of input) {
    result += CYRILLIC_TRANSLITERATION_MAP.get(char) ?? char;
  }
  return result;
}

/**
 * Canonical comparison key shared by checked labels and registry aliases.
 * Applying the same transform to both sides avoids hybrid-script mismatches
 * after IDNA decoding without pretending that the key is a display value.
 */
export function toDomainComparisonKey(input: string): string {
  return transliterateCyrillic(applyHomoglyphs(input.normalize("NFKC").toLowerCase()));
}

/** Visual-confusable and ordinary transliteration alternatives for aliases. */
export function toDomainComparisonKeys(input: string): ReadonlySet<string> {
  const normalized = input.normalize("NFKC").toLowerCase();
  return new Set([
    transliterateCyrillic(applyHomoglyphs(normalized)),
    transliterateCyrillic(normalized),
  ]);
}

/**
 * Canonical DNS identity key. Unlike the similarity skeleton, this must not
 * collapse distinct labels such as `1`/`l` or `0`/`o`.
 */
export function toDnsIdentityKey(input: string): string {
  const normalized = input.trim().normalize("NFC").toLowerCase();
  if (!normalized) return "";

  try {
    return new URL(`http://${normalized}`).hostname.toLowerCase().replace(/\.$/u, "");
  } catch {
    // Invalid hostnames remain distinct raw identities and cannot become
    // trusted merely because a lossy similarity transform accepts them.
    return normalized.replace(/\.$/u, "");
  }
}

/**
 * Decode a single punycode-encoded label (e.g., "xn--..." segment).
 * Falls back to the raw ASCII label on any decode failure.
 */
function decodePunycodeLabel(label: string): string {
  if (!label.startsWith("xn--")) {
    return label;
  }
  try {
    return punycodeDecode(label.slice(4));
  } catch {
    // Fallback to raw ASCII on invalid punycode
    return label;
  }
}

/**
 * Minimal punycode decoder for IDNA labels.
 * Implements RFC 3492 bootstring decoding.
 * Falls back to raw input on any failure.
 */
function punycodeDecode(encoded: string): string {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;

  const output: number[] = [];
  let i = 0;
  let n = initialN;
  let bias = initialBias;

  // Find the last delimiter (basic code points are before it)
  const lastDelim = encoded.lastIndexOf("-");
  const basicLength = lastDelim >= 0 ? lastDelim : 0;

  for (let j = 0; j < basicLength; j++) {
    const cp = encoded.charCodeAt(j);
    if (cp >= 128) throw new Error("Invalid basic code point");
    output.push(cp);
  }

  let index = lastDelim >= 0 ? lastDelim + 1 : 0;

  while (index < encoded.length) {
    const oldi = i;
    let w = 1;
    let k = base;

    while (true) {
      if (index >= encoded.length) throw new Error("Invalid input");
      const code = encoded.charCodeAt(index++);
      let digit: number;

      if (code >= 0x61 && code <= 0x7a) {
        digit = code - 0x61; // a-z → 0-25
      } else if (code >= 0x41 && code <= 0x5a) {
        digit = code - 0x41; // A-Z → 0-25
      } else if (code >= 0x30 && code <= 0x39) {
        digit = code - 0x30 + 26; // 0-9 → 26-35
      } else {
        throw new Error("Invalid digit");
      }

      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

      if (digit < t) break;
      w *= base - t;
      k += base;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    n += Math.floor(i / out);
    i %= out;

    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

/** Bias adaptation function per RFC 3492 */
function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;

  let d = firstTime ? Math.floor(delta / damp) : Math.floor(delta / 2);
  d += Math.floor(d / numPoints);

  let k = 0;
  while (d > ((base - tMin) * tMax) / 2) {
    d = Math.floor(d / (base - tMin));
    k += base;
  }
  return k + Math.floor(((base - tMin + 1) * d) / (d + skew));
}

/**
 * Decode all punycode-encoded labels in a hostname.
 * Each dot-separated label starting with "xn--" is decoded individually.
 * On failure for any label, that label remains in raw ASCII form.
 */
function decodePunycodeHostname(hostname: string): string {
  return hostname
    .split(".")
    .map((label) => decodePunycodeLabel(label))
    .join(".");
}

/**
 * Normalize a raw URL string for brand matching.
 *
 * Steps:
 * 1. Strip protocol scheme (http://, https://)
 * 2. Strip `www.` prefix
 * 3. Lowercase all characters
 * 4. Decode Punycode/IDNA segments to Unicode (fallback to raw ASCII on failure)
 * 5. Apply homoglyph normalization
 */
export function normalizeDomain(rawUrl: string): NormalizedDomain {
  let url = rawUrl.trim();

  // 1. Strip protocol scheme
  url = url.replace(/^https?:\/\//i, "");

  // 2. Separate hostname and path
  const slashIndex = url.indexOf("/");
  let hostname: string;
  let path: string;

  if (slashIndex === -1) {
    hostname = url;
    path = "";
  } else {
    hostname = url.slice(0, slashIndex);
    path = url.slice(slashIndex);
  }

  // 3. Strip www. prefix from hostname
  hostname = hostname.replace(/^www\./i, "");

  // 4. Preserve a lossless DNS identity before building a visual skeleton.
  hostname = hostname.normalize("NFC").toLowerCase();
  path = path.normalize("NFKC").toLowerCase();

  const hostnameIdentity = toDnsIdentityKey(hostname);

  // 5. Decode canonical A-labels for the visual/transliteration skeleton.
  hostname = decodePunycodeHostname(hostnameIdentity);

  // 6. Apply homoglyph normalization
  hostname = toDomainComparisonKey(hostname);
  path = toDomainComparisonKey(path);

  return { hostname, hostnameIdentity, path };
}
