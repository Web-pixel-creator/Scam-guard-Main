import type { Lang } from "@/lib/i18n";
import {
  sanitizeSensitiveTextForSink,
  type SensitiveSecretClass,
  type SensitiveTextSanitization,
} from "@/lib/risk/sensitive-text";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

export interface SensitiveSecretGuidance {
  title: string;
  description: string;
}

const SECRET_CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = Object.freeze({
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
});
const SECRET_LATIN_TO_CYRILLIC: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SECRET_CYRILLIC_TO_LATIN).map(([cyrillic, latin]) => [latin, cyrillic]),
  ),
);

function mapSecretLabelConfusables(
  value: string,
  mapping: Readonly<Record<string, string>>,
): string {
  return Array.from(value, (character) => mapping[character] ?? character).join("");
}

/**
 * Secret labels get a stricter detection-only normalization than ordinary
 * intents. Multiple homoglyphs must not turn a pasted credential into visible
 * Inline output; the original text is still never replaced, stored or echoed.
 */
function secretDetectionCandidates(original: string): string[] {
  const normalized = normalizeIntentTextForMatching(original);
  return [
    original,
    normalized,
    mapSecretLabelConfusables(normalized, SECRET_CYRILLIC_TO_LATIN),
    mapSecretLabelConfusables(normalized, SECRET_LATIN_TO_CYRILLIC),
  ].filter((value, index, values) => values.indexOf(value) === index);
}

const FULLY_SPACED_PASSWORD_LABEL = String.raw`p[^\S\r\n]+a[^\S\r\n]+s[^\S\r\n]+s[^\S\r\n]+w[^\S\r\n]+o[^\S\r\n]+r[^\S\r\n]+d`;
const VALUE_SHAPED_PASSWORD_LABEL = String.raw`(?:password|pasword|${FULLY_SPACED_PASSWORD_LABEL}|passphrase|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini|ga|dan)?|maxfiy\s+so['’]?z|махфий\s+(?:сўз|суз))`;
const EXPLICIT_VALUE_SHAPED_PASSWORD_RE = new RegExp(
  `${VALUE_SHAPED_PASSWORD_LABEL}\\s*[:=]\\s*\\S{4,}`,
  "iu",
);
const LABELED_VALUE_SHAPED_PASSWORD_RE = new RegExp(
  `${VALUE_SHAPED_PASSWORD_LABEL}.{0,12}\\S*[\\d!@#$%^&*_.-]\\S{3,}`,
  "iu",
);
const VALUE_SHAPED_PASSWORD_LABEL_RE = new RegExp(VALUE_SHAPED_PASSWORD_LABEL, "giu");
const LABEL_FIRST_ALPHABETIC_PASSWORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])${VALUE_SHAPED_PASSWORD_LABEL}(?![\\p{L}\\p{N}_])[^\\S\\r\\n]+([\\p{L}\\p{M}][\\p{L}\\p{M}'’-]{7,159})(?![\\p{L}\\p{M}'’-])`,
  "giu",
);
const LABEL_FIRST_MULTIWORD_ALPHABETIC_PASSWORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])${VALUE_SHAPED_PASSWORD_LABEL}(?![\\p{L}\\p{N}_])[^\\S\\r\\n]+([\\p{L}\\p{M}][\\p{L}\\p{M}'’-]{1,31}(?:[^\\S\\r\\n]+[\\p{L}\\p{M}][\\p{L}\\p{M}'’-]{1,31}){2,7})(?=$|[.!?;,\\r\\n])`,
  "giu",
);
const ALPHABETIC_PASSWORD_CONTEXT_VALUE_RE = /^(?:guidance|guidelines)$/iu;
const MULTIWORD_PASSWORD_GUIDANCE_LEAD_RE =
  /^(?:must|should|needs?|requires?|requirements?|policy|guidance|guidelines|authentication|security|length|long|typo|example|documentation|должен|должна|должны|нужно|требуется|требования|политика|безопасность|длина|узун|kerak|talab|talablar|xavfsizlik|uzunligi)(?:\s|$)/iu;
const PASSWORD_SAFETY_GUIDANCE_RES = [
  /^(?:не|никогда\s+не)\s+(?:сообщайте|говорите|передавайте|отправляйте|показывайте)\s+(?:свой\s+)?парол(?:ь|я)(?:\s+(?:никому|незнакомым|посторонним)(?:\s+людям)?)?[.!?]*$/iu,
  /^(?:не|никогда\s+не)\s+(?:сообщайте|говорите|передавайте|отправляйте|показывайте)\s+(?:свой\s+)?парол(?:ь|я)\s+от\s+(?:банковского|мобильного)\s+приложения\s+(?:никому|незнакомым|посторонним)(?:\s+людям)?[.!?]*$/iu,
  /^(?:bank\s+ilovasi\s+)?parol(?:i|ni|ini)?\s+(?:(?:hech\s+kimga|notanish\s+odamlarga|begonalarga|boshqalarga)\s+)?(?:aytmang|yubormang|bermang|ulashmang)[.!?]*$/iu,
  /^(?:do\s+not|don['’]?t|never)\s+(?:tell|share|send|give|reveal)\s+(?:(?:strangers|anyone|other\s+people)\s+)?(?:your\s+)?password(?:\s+(?:to|with)\s+(?:strangers|anyone|other\s+people))?[.!?]*$/iu,
  /^(?:всплывающее\s+окно\s+)?(?:apple\s+id|сайт|приложение|форма)\s+(?:просит|запрашивает|требует)\s+парол(?:ь|я)\s+для\s+(?:проверки|подтверждения)\s+(?:аккаунта|уч[её]тной\s+записи)[.!?]*$/iu,
] as const;
const VALUE_SHAPE_MARKER_RE = /[\d!@#$%^&*_.-]/u;
const WHITESPACE_CHARACTER_RE = /\s/u;
const VALUE_FIRST_MULTIWORD_PASSWORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])[\\p{L}]{2,32}(?:[^\\S\\r\\n]+[\\p{L}]{2,32}){2,7}[^\\S\\r\\n]*(?:[–—-]|(?:is|это|bu)[^\\S\\r\\n]+(?:the[^\\S\\r\\n]+)?)[^\\S\\r\\n]*(?:password|passphrase)(?![\\p{L}\\p{N}_])`,
  "iu",
);
const NATURAL_ONE_TIME_PASSWORD_REFERENCE_RE =
  /(?:^|\s)(?:one[-\s]+time|single[-\s]+use)\s+password(?:[.!?,;:]|\s|$)/iu;
const MAX_VALUE_FIRST_PASSWORD_GAP = 12;

function previousCodePointStart(value: string, exclusiveEnd: number): number {
  const previous = exclusiveEnd - 1;
  if (previous <= 0) return previous;
  const codeUnit = value.charCodeAt(previous);
  const precedingCodeUnit = value.charCodeAt(previous - 1);
  return codeUnit >= 0xdc00 &&
    codeUnit <= 0xdfff &&
    precedingCodeUnit >= 0xd800 &&
    precedingCodeUnit <= 0xdbff
    ? previous - 1
    : previous;
}

function moveBackCodePoints(value: string, exclusiveEnd: number, count: number): number {
  let cursor = exclusiveEnd;
  for (let index = 0; index < count; index += 1) {
    cursor = previousCodePointStart(value, cursor);
    if (cursor < 0) return -1;
  }
  return cursor;
}

/**
 * Match a secret-shaped value immediately before a password label in linear
 * time. The previous regex started with an unanchored greedy `\\S*`, so a
 * marker-free input made the engine retry the whole suffix at every offset.
 *
 * For each label, the original shape is equivalent to finding a marker in the
 * same non-whitespace run of at least four code points, followed by at most
 * twelve non-line-break code points before the label. Prefix tables make each
 * bounded check constant-time without truncating input.
 */
function hasValueFirstShapedPassword(candidate: string): boolean {
  if (NATURAL_ONE_TIME_PASSWORD_REFERENCE_RE.test(candidate)) return false;

  const labelStarts = Array.from(
    candidate.matchAll(VALUE_SHAPED_PASSWORD_LABEL_RE),
    (match) => match.index,
  );
  if (labelStarts.length === 0) return false;

  const lastWhitespaceBefore = new Int32Array(candidate.length + 1);
  const lastMarkerThrough = new Int32Array(candidate.length);
  lastWhitespaceBefore.fill(-1);
  lastMarkerThrough.fill(-1);

  let lastWhitespace = -1;
  let lastMarker = -1;
  for (let index = 0; index < candidate.length; index += 1) {
    lastWhitespaceBefore[index] = lastWhitespace;
    const character = candidate[index] ?? "";
    if (WHITESPACE_CHARACTER_RE.test(character)) lastWhitespace = index;
    if (VALUE_SHAPE_MARKER_RE.test(character)) lastMarker = index;
    lastMarkerThrough[index] = lastMarker;
  }
  lastWhitespaceBefore[candidate.length] = lastWhitespace;

  for (const labelStart of labelStarts) {
    let valueEnd = labelStart;
    for (let gapLength = 0; gapLength <= MAX_VALUE_FIRST_PASSWORD_GAP; gapLength += 1) {
      if (gapLength > 0) {
        valueEnd = previousCodePointStart(candidate, valueEnd);
        if (valueEnd < 0 || /[\r\n\u2028\u2029]/u.test(candidate[valueEnd] ?? "")) break;
      }

      const valueStartBoundary = lastWhitespaceBefore[valueEnd] ?? -1;
      const runStart = valueStartBoundary + 1;
      if (moveBackCodePoints(candidate, valueEnd, 4) < runStart) continue;
      if ((lastMarkerThrough[valueEnd - 1] ?? -1) >= runStart) return true;
    }
  }

  return false;
}

function hasLabelFirstAlphabeticPassword(candidate: string): boolean {
  for (const match of candidate.matchAll(LABEL_FIRST_ALPHABETIC_PASSWORD_RE)) {
    if (ALPHABETIC_PASSWORD_CONTEXT_VALUE_RE.test(match[1] ?? "")) continue;
    // Reuse the sink sanitizer's context-word allow-list. This keeps natural
    // guidance such as "password authentication" out of the private route
    // while treating an otherwise unmarked alphabetic value as a secret.
    const detected = sanitizeSensitiveTextForSink(match[0]);
    if (detected.redacted && detected.classes.includes("password")) return true;
  }
  return false;
}

function isNaturalPasswordSafetyGuidance(candidate: string): boolean {
  const normalized = candidate.trim();
  return PASSWORD_SAFETY_GUIDANCE_RES.some((pattern) => pattern.test(normalized));
}

function hasLabelFirstMultiwordAlphabeticPassword(candidate: string): boolean {
  for (const match of candidate.matchAll(LABEL_FIRST_MULTIWORD_ALPHABETIC_PASSWORD_RE)) {
    if (MULTIWORD_PASSWORD_GUIDANCE_LEAD_RE.test(match[1] ?? "")) continue;
    return true;
  }
  return false;
}

function hasValueShapedPasswordLabel(original: string): boolean {
  const candidates = secretDetectionCandidates(original);
  // A Latin product name inside otherwise Russian/Uzbek guidance can produce
  // an additional confusable-mapped candidate. Once one exact candidate proves
  // the whole message is non-value guidance, do not reinterpret another
  // detection-only spelling of that same message as a pasted password.
  if (candidates.some(isNaturalPasswordSafetyGuidance)) return false;
  return candidates.some((candidate) => {
    return (
      EXPLICIT_VALUE_SHAPED_PASSWORD_RE.test(candidate) ||
      LABELED_VALUE_SHAPED_PASSWORD_RE.test(candidate) ||
      hasLabelFirstAlphabeticPassword(candidate) ||
      hasLabelFirstMultiwordAlphabeticPassword(candidate) ||
      VALUE_FIRST_MULTIWORD_PASSWORD_RE.test(candidate) ||
      hasValueFirstShapedPassword(candidate)
    );
  });
}

/**
 * Detect a pasted secret without letting invisible controls or one visual
 * Cyrillic/Latin confusable hide its label. The normalized copy is used only
 * for detection and a private warning; callers must retain the original input
 * for every other purpose.
 */
export function detectTelegramSensitiveSecret(original: string): SensitiveTextSanitization | null {
  const hasPasswordValue = hasValueShapedPasswordLabel(original);
  const detections = secretDetectionCandidates(original)
    .map(sanitizeSensitiveTextForSink)
    .filter((candidate) => candidate.redacted);
  if (detections.length === 0) {
    return hasPasswordValue ? { value: "••••", redacted: true, classes: ["password"] } : null;
  }
  const classes = [
    ...new Set([
      ...detections.flatMap((candidate) => candidate.classes),
      ...(hasPasswordValue ? (["password"] as const) : []),
    ]),
  ];
  const detected = detections.reduce((best, candidate) =>
    candidate.classes.length > best.classes.length ? candidate : best,
  );
  if (classes.length === 1 && classes[0] === "password" && !hasPasswordValue) {
    return null;
  }
  return { ...detected, classes };
}

/**
 * True only when the input contains a secret-shaped value, not merely a
 * natural-language reference such as "I read out the one-time password".
 * Callers may use this distinction to route proven completed incidents while
 * keeping every pasted password/code/seed/key on the private redaction path.
 */
export function hasPastedSensitiveSecretValue(original: string): boolean {
  return (
    hasValueShapedPasswordLabel(original) ||
    secretDetectionCandidates(original).some((candidate) => {
      const detected = sanitizeSensitiveTextForSink(candidate);
      return detected.redacted && detected.classes.some((value) => value !== "password");
    })
  );
}

export function buildSensitiveSecretGuidance(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
): SensitiveSecretGuidance {
  const hasRecovery = classes.includes("recovery_phrase");
  const hasPrivateKey = classes.includes("private_key");
  const hasPassword = classes.includes("password");
  const hasCode = classes.includes("code");

  if (hasRecovery || hasPrivateKey) {
    if (lang === "uz") {
      return {
        title: hasRecovery ? "Tiklash iborasi yashirildi" : "Maxfiy kalit yashirildi",
        description:
          "Uni hech kimga yubormang. Agar bu haqiqiy sir bo'lsa va oshkor qilingan bo'lsa, rasmiy ilovada yangi hamyon yarating.",
      };
    }
    if (lang === "en") {
      return {
        title: hasRecovery ? "Recovery phrase hidden" : "Private key hidden",
        description:
          "Never share it. If it was real and already exposed, create a new wallet in the official app and move the assets safely.",
      };
    }
    return {
      title: hasRecovery ? "Сид-фраза скрыта" : "Приватный ключ скрыт",
      description:
        "Никому не сообщайте этот секрет. Если он настоящий и уже раскрыт, создайте новый кошелёк в официальном приложении и безопасно перенесите активы.",
    };
  }

  if (hasPassword) {
    if (lang === "uz") {
      return {
        title: "Parol yashirildi: uni yubormang",
        description: `Haqiqiy parol${hasCode ? " yoki kod" : ""}ni chatga kiritmang. Agar yuborgan bo'lsangiz, rasmiy sayt yoki ilovada parolni almashtiring va sessiyalarni yoping.`,
      };
    }
    if (lang === "en") {
      return {
        title: "Password hidden: do not share it",
        description: `Do not paste a real password${hasCode ? " or code" : ""} into chat. If you shared it, change it in the official site or app and revoke other sessions.`,
      };
    }
    return {
      title: "Пароль скрыт: не сообщайте его",
      description: `Не вставляйте настоящий пароль${hasCode ? " или код" : ""} в чат. Если уже отправили, смените его на официальном сайте или в приложении и завершите другие сессии.`,
    };
  }

  if (hasCode) {
    if (lang === "uz") {
      return {
        title: "Kod yashirildi: hech kimga aytmang",
        description:
          "Haqiqiy SMS/OTP/PINni chatga kiritmang. Kod kelgan rasmiy ilovani o'zingiz ochib, operatsiyani tekshiring.",
      };
    }
    if (lang === "en") {
      return {
        title: "Code hidden: do not share it",
        description:
          "Do not paste a real SMS code, OTP, or PIN into chat. Open the official app yourself and inspect the operation.",
      };
    }
    return {
      title: "Код скрыт: никому не сообщайте",
      description:
        "Не вставляйте настоящий SMS-код, OTP или PIN в чат. Самостоятельно откройте официальное приложение и проверьте операцию.",
    };
  }

  throw new Error("Sensitive-secret guidance requires at least one secret class");
}
