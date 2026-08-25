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

export interface SensitiveSecretFollowUpContext {
  /** Bounded enum-only secret categories; never the secret value or source text. */
  classes: readonly SensitiveSecretClass[];
  /** Language resolved from the original message, not the Telegram profile. */
  lang: Lang;
  at: string;
}

export type SensitiveSecretFollowUpAction = "why" | "next_steps";

export interface SensitiveSecretFollowUp {
  action: SensitiveSecretFollowUpAction;
  context: SensitiveSecretFollowUpContext;
}

export const SENSITIVE_SECRET_FOLLOW_UP_CONTEXT_WINDOW_MS = 20 * 60 * 1_000;

const SENSITIVE_SECRET_CLASSES = new Set<SensitiveSecretClass>([
  "password",
  "code",
  "recovery_phrase",
  "private_key",
  "access_token",
]);
const SENSITIVE_SECRET_CONTEXT_LANGS = new Set<Lang>(["ru", "uz", "en"]);
const SENSITIVE_SECRET_WHY_FOLLOW_UP_RE =
  /^(?:(?:почему|пачему)(?:\s+(?:(?:это|так)\s+(?:опасно|рискованно)(?:\s+и\s+что\s+(?:мне\s+)?делать\s+дальше)?|им\s+нельзя\s+доверять))?|nega(?:\s+(?:(?:bu\s+)?(?:xavfli|xatarli)(?:\s+va\s+(?:keyin\s+)?nima\s+qilay)?|ularga\s+ishonmasligim\s+kerak))?|nima\s+uchun|why(?:\s+(?:(?:is\s+(?:this|that|it)\s+(?:dangerous|risky))(?:\s+and\s+what\s+should\s+i\s+do\s+next)?|should\s+i\s+not\s+trust\s+them))?)[?!.,\s]*$/iu;
const SENSITIVE_SECRET_NEXT_STEPS_FOLLOW_UP_RE =
  /^(?:что\s+(?:мне\s+)?(?:теперь|сейчас)\s+делать|что\s+(?:мне\s+)?делать\s+дальше|(?:а\s+)?(?:что\s+дальше|дальше\s+что)|(?:endi|keyin)\s+nima(?:\s+(?:qilishim\s+kerak|qilay))?|what\s+(?:should\s+i\s+do\s+(?:now|next)|next)|now\s+what)[?!.,\s]*$/iu;

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
const VALUE_SHAPED_PASSWORD_LABEL = String.raw`(?:password|pasword|${FULLY_SPACED_PASSWORD_LABEL}|passphrase|парол(?:ь|я|ем|ю|им|ингиз|ини|ни|га|дан)?|parol(?:i|im|ingiz|ni|ini|ga|dan)?|maxfiy\s+so['’]?z|махфий\s+(?:сўз|суз))`;
const VISUAL_SECRET_VALUE_SEPARATOR = String.raw`(?:[→➜➤➡➔⇢⇒]|\p{Extended_Pictographic}(?:\uFE0E|\uFE0F|\p{Emoji_Modifier})?)`;
const EXPLICIT_VALUE_SHAPED_PASSWORD_RE = new RegExp(
  `${VALUE_SHAPED_PASSWORD_LABEL}\\s*[:=]\\s*\\S{4,}`,
  "iu",
);
const DECORATED_VALUE_SHAPED_PASSWORD_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])${VALUE_SHAPED_PASSWORD_LABEL}(?![\\p{L}\\p{N}_])\\s*${VISUAL_SECRET_VALUE_SEPARATOR}\\s*\\S{4,160}`,
  "giu",
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
    const hasDecoratedPassword = Array.from(
      candidate.matchAll(DECORATED_VALUE_SHAPED_PASSWORD_RE),
    ).some((match) => {
      const detected = sanitizeSensitiveTextForSink(match[0]);
      return detected.redacted && detected.classes.includes("password");
    });
    return (
      EXPLICIT_VALUE_SHAPED_PASSWORD_RE.test(candidate) ||
      hasDecoratedPassword ||
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
  const hasAccessToken = classes.includes("access_token");
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

  if (hasAccessToken) {
    if (lang === "uz") {
      return {
        title: "Kirish tokeni yashirildi",
        description:
          "API, access yoki bot tokenini chatga kiritmang. Agar u haqiqiy bo'lsa va oshkor qilingan bo'lsa, xizmatning rasmiy boshqaruv panelida uni darhol bekor qiling va yangisini yarating.",
      };
    }
    if (lang === "en") {
      return {
        title: "Access token hidden",
        description:
          "Do not paste an API, access, or bot token into chat. If it was real and exposed, revoke it immediately and create a replacement in the service's official dashboard.",
      };
    }
    return {
      title: "Токен доступа скрыт",
      description:
        "Не вставляйте API-, access- или bot-токен в чат. Если токен настоящий и уже раскрыт, немедленно отзовите его и создайте новый в официальной панели сервиса.",
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

export function buildSensitiveSecretFollowUpContext(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
  now = new Date(),
): SensitiveSecretFollowUpContext {
  const boundedClasses = [...new Set(classes)].filter((value) =>
    SENSITIVE_SECRET_CLASSES.has(value),
  );
  if (boundedClasses.length === 0) {
    throw new Error("Sensitive-secret follow-up context requires a secret class");
  }
  return { classes: boundedClasses, lang, at: now.toISOString() };
}

function activeSensitiveSecretFollowUpContext(
  value: unknown,
  now: Date,
): SensitiveSecretFollowUpContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.classes) ||
    candidate.classes.length < 1 ||
    candidate.classes.length > SENSITIVE_SECRET_CLASSES.size ||
    !candidate.classes.every(
      (secretClass) =>
        typeof secretClass === "string" &&
        SENSITIVE_SECRET_CLASSES.has(secretClass as SensitiveSecretClass),
    ) ||
    typeof candidate.lang !== "string" ||
    !SENSITIVE_SECRET_CONTEXT_LANGS.has(candidate.lang as Lang) ||
    typeof candidate.at !== "string" ||
    !Number.isFinite(Date.parse(candidate.at))
  ) {
    return null;
  }
  const ageMs = now.getTime() - Date.parse(candidate.at);
  if (ageMs < 0 || ageMs > SENSITIVE_SECRET_FOLLOW_UP_CONTEXT_WINDOW_MS) return null;

  return {
    classes: [...new Set(candidate.classes as SensitiveSecretClass[])],
    lang: candidate.lang as Lang,
    at: candidate.at,
  };
}

/**
 * Attach only a narrow, artifact-free second-turn question to a recent secret
 * warning. URLs, numbers and pasted values do not match these anchored forms.
 */
export function classifySensitiveSecretFollowUp(
  text: string,
  value: unknown,
  now = new Date(),
): SensitiveSecretFollowUp | null {
  const context = activeSensitiveSecretFollowUpContext(value, now);
  if (!context) return null;
  const normalized = normalizeIntentTextForMatching(text).trim();
  const action: SensitiveSecretFollowUpAction | null = SENSITIVE_SECRET_WHY_FOLLOW_UP_RE.test(
    normalized,
  )
    ? "why"
    : SENSITIVE_SECRET_NEXT_STEPS_FOLLOW_UP_RE.test(normalized)
      ? "next_steps"
      : null;
  return action ? { action, context } : null;
}

/**
 * The accepted follow-up grammar is deliberately narrow, so its leading words
 * are stronger language evidence than a generic one-word detector. Preserve
 * the saved secret language only for a future/unknown form.
 */
export function resolveSensitiveSecretFollowUpLanguage(text: string, fallback: Lang): Lang {
  const normalized = normalizeIntentTextForMatching(text).trim();
  if (/^(?:почему|пачему|что|дальше|а\s+что)(?:\s|[?!.,]|$)/iu.test(normalized)) {
    return "ru";
  }

  if (/^(?:nega|nima\s+uchun|endi|keyin)(?:\s|[?!.,]|$)/iu.test(normalized)) return "uz";
  if (/^(?:why|what|now)(?:\s|[?!.,]|$)/iu.test(normalized)) return "en";
  return fallback;
}

/** Human follow-up copy generated only from enum classes and language. */
export function buildSensitiveSecretFollowUpText(followUp: SensitiveSecretFollowUp): string {
  const { classes, lang } = followUp.context;
  const hasRecovery = classes.includes("recovery_phrase");
  const hasPrivateKey = classes.includes("private_key");
  const hasAccessToken = classes.includes("access_token");
  const hasPassword = classes.includes("password");

  if (hasRecovery || hasPrivateKey) {
    const label = hasRecovery
      ? { ru: "Сид-фраза", uz: "Seed phrase", en: "A seed phrase" }[lang]
      : { ru: "Приватный ключ", uz: "Maxfiy kalit", en: "A private key" }[lang];
    return {
      ru: `${label} даёт полный доступ к криптокошельку. Тот, кто получит этот секрет, может вывести активы; настоящая поддержка не просит его в чате.\n\nНе сообщайте его. Если уже раскрыли, с чистого устройства создайте новый кошелёк в официальном приложении и безопасно перенесите активы.`,
      uz: `${label} kriptohamyonga to'liq kirish imkonini beradi. Uni olgan odam aktivlarni chiqarishi mumkin; haqiqiy yordam xizmati bunday sirni chatda so'ramaydi.\n\nUni yubormang. Agar oshkor qilgan bo'lsangiz, toza qurilmada rasmiy ilova orqali yangi hamyon yarating va aktivlarni xavfsiz ko'chiring.`,
      en: `${label} gives full access to a crypto wallet. Anyone who gets this secret may move the assets; legitimate support will not ask for it in chat.\n\nDo not share it. If it was exposed, use a clean device to create a new wallet in the official app and move the assets safely.`,
    }[lang];
  }

  if (hasAccessToken) {
    return {
      ru: "Токен доступа позволяет программам или боту действовать от имени вашей учётной записи. Настоящая поддержка не просит присылать его в чате.\n\nНе используйте раскрытый токен снова: отзовите его и создайте новый в официальной панели сервиса. Затем проверьте журналы и активные интеграции.",
      uz: "Kirish tokeni dastur yoki botga akkauntingiz nomidan ishlash imkonini beradi. Haqiqiy yordam xizmati uni chatda yuborishni so'ramaydi.\n\nOshkor qilingan tokenni qayta ishlatmang: uni rasmiy boshqaruv panelida bekor qiling va yangisini yarating. Keyin jurnallar va faol integratsiyalarni tekshiring.",
      en: "An access token can let software or a bot act as your account. Legitimate support will not ask you to send it in chat.\n\nDo not reuse an exposed token: revoke it and create a replacement in the service's official dashboard. Then review logs and active integrations.",
    }[lang];
  }

  if (hasPassword) {
    return {
      ru: "Пароль даёт доступ к вашей учётной записи. Настоящая поддержка не просит присылать его в чате.\n\nНе сообщайте пароль. Если уже раскрыли, смените его на официальном сайте или в приложении, завершите другие сессии и включите двухэтапную защиту.",
      uz: "Parol akkauntingizga kirish imkonini beradi. Haqiqiy yordam xizmati uni chatda yuborishni so'ramaydi.\n\nParolni aytmang. Agar oshkor qilgan bo'lsangiz, uni rasmiy sayt yoki ilovada almashtiring, boshqa sessiyalarni yoping va ikki bosqichli himoyani yoqing.",
      en: "A password gives access to your account. Legitimate support will not ask you to send it in chat.\n\nDo not share the password. If it was exposed, change it on the official site or app, revoke other sessions, and enable two-step protection.",
    }[lang];
  }

  return {
    ru: "SMS-код, OTP или PIN может подтвердить вход, смену доступа либо денежную операцию. Тот, кто получит код, может действовать от вашего имени.\n\nКод не сообщайте. Самостоятельно откройте официальное приложение и проверьте операцию; если уже раскрыли код, сразу свяжитесь с официальной поддержкой.",
    uz: "SMS-kod, OTP yoki PIN akkauntga kirish, kirishni o'zgartirish yoki pul operatsiyasini tasdiqlashi mumkin. Kodni olgan odam sizning nomingizdan harakat qilishi mumkin.\n\nKodni aytmang. Rasmiy ilovani o'zingiz ochib, operatsiyani tekshiring; kodni oshkor qilgan bo'lsangiz, darhol rasmiy yordam xizmatiga murojaat qiling.",
    en: "An SMS code, OTP, or PIN can approve a login, an access change, or a money operation. Whoever gets the code may be able to act as you.\n\nDo not share the code. Open the official app yourself and inspect the operation; if the code was exposed, contact official support immediately.",
  }[lang];
}
