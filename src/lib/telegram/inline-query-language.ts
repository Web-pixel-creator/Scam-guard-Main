import type { Lang } from "@/lib/i18n";
import { looksLikeUzbekCyrillic } from "@/lib/risk/uz-cyrillic-translit";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

const UZ_CYRILLIC_RE = /[ўқғҳ]/iu;
const UZBEK_CYRILLIC_PHRASE_RE =
  /(?:^|\s)(?:мени|бизни|сизни|уларни)\s+(?:алдашди|алдамоқчи|алдамокчи)(?:\s|$)|(?:^|\s)(?:ёрдам|йордам)\s+бер(?:инг|инглар)?(?:\s|$)/iu;
const RU_CYRILLIC_RE = /[а-яё]/giu;
const LATIN_CHARACTER_RE = /\p{Script=Latin}/gu;
const LATIN_TOKEN_RE = /[a-z]+(?:'[a-z]+)*/giu;

// Keep identifiers and secret-shaped fragments on the explicitly selected
// language. They do not contain enough natural-language context to infer one.
const URL_RE = /^(?:https?:\/\/|www\.)\S+$/iu;
const USERNAME_RE = /^@[a-z0-9_]{3,}$/iu;
const SEED_PHRASE_ONLY_RE = /^seed\s+phrase\s*:?\s+(?:[a-z]+\s+){2,}[a-z]+[.!?]?$/iu;
const SHORT_SECRET_ONLY_RE =
  /^(?:(?:sms|otp|pin)(?:[-\s]*(?:code|kod))?|cvv|password|parol)(?:\s*[:=]?\s*[a-z0-9_-]+)?[.!?]?$/iu;
const SHORT_UZBEK_QUERY_RE =
  /^(?:(?:rahmat|raxmat|рахмат|раҳмат)|(?:(?:sms|otp|pin|kod|havola|link|pul|parol)\s+)?(?:beraymi|aytaymi|yuboraymi|ochaymi|to['’]?laymi|ishonaymi|qilaymi|kiraymi))[?!.]*$/iu;
const SHORT_ENGLISH_QUERY_RE =
  /^(?:tell|share|send|open|pay|call|trust|verify)\s+(?:the\s+)?(?:otp|sms(?:\s+code)?|code|link|him|her|them|it)[?!.]*$/iu;

// Loanwords shared by Uzbek and English (bank, SMS, code, Telegram, channel,
// etc.) are deliberately absent. Ordinary sentences still contain several
// language-specific function words or inflected words, while "SMS code" and
// bare artefacts remain genuinely ambiguous.
const UZ_SIGNALS = new Set([
  "aldov",
  "almashtirish",
  "ayting",
  "aytishni",
  "aytishimni",
  "bajarishni",
  "bekor",
  "berib",
  "bering",
  "bilan",
  "boj",
  "bosim",
  "chaqiryapti",
  "chipta",
  "daromad",
  "davlat",
  "degan",
  "depozit",
  "ekranimni",
  "firib",
  "foyda",
  "guruhga",
  "havola",
  "havolaga",
  "havolasini",
  "himoyasini",
  "hisobga",
  "ish",
  "ishonchli",
  "jamg'arma",
  "jo'nating",
  "kafolatlangan",
  "kanalda",
  "kanalga",
  "kanaliga",
  "kartaga",
  "kartaning",
  "kerak",
  "kirish",
  "kiriting",
  "kiritishni",
  "kodini",
  "kodni",
  "komissiya",
  "ko'rsatishni",
  "ko'rsatmalarini",
  "kreditni",
  "kuryer",
  "ma'lumotlarini",
  "majburlashyapti",
  "majburiy",
  "men",
  "mendan",
  "menga",
  "meni",
  "mumkinmi",
  "ni",
  "notanish",
  "o'chirishni",
  "o'g'lim",
  "o'qish",
  "o'rnatib",
  "o'tkazma",
  "o'tkazishni",
  "o'tishni",
  "odam",
  "odamga",
  "oldindan",
  "operatsiyasini",
  "orqali",
  "ovoz",
  "parolini",
  "pasport",
  "politsiyadanman",
  "posilka",
  "pul",
  "pulni",
  "qayta",
  "qilish",
  "qilishni",
  "qilishimni",
  "qilmaslikni",
  "qiling",
  "qilib",
  "qilyapti",
  "qo'ng'iroq",
  "qo'shilishga",
  "qo'rqitib",
  "raqam",
  "rasmini",
  "shantaj",
  "shaxsiy",
  "shaxsni",
  "shoshirib",
  "shubhali",
  "skanerlashni",
  "soliq",
  "so'radi",
  "so'raldi",
  "so'rashyapti",
  "so'rayapti",
  "soxta",
  "suratlarim",
  "taklif",
  "talab",
  "tanishim",
  "tasdiqlash",
  "tasdiqlashni",
  "tez",
  "to'lashga",
  "to'lashni",
  "to'lov",
  "uchradi",
  "uchun",
  "ular",
  "va",
  "va'da",
  "viza",
  "xavfsiz",
  "xaridor",
  "xizmati",
  "xizmatidan",
  "yangi",
  "yangilanishi",
  "yordam",
  "yozib",
  "yubordim",
  "yuborib",
  "yuboring",
  "yuborishni",
  "yuborilgan",
  "yuboryapman",
  "zudlik",
]);

const EN_SIGNALS = new Set([
  "a",
  "again",
  "already",
  "an",
  "and",
  "ask",
  "asked",
  "asks",
  "blackmail",
  "but",
  "buyer",
  "call",
  "caller",
  "callers",
  "calling",
  "cancel",
  "card",
  "careful",
  "charity",
  "claiming",
  "click",
  "commission",
  "confirmation",
  "contact",
  "courier",
  "customs",
  "demand",
  "demands",
  "deposit",
  "details",
  "disable",
  "employee",
  "enter",
  "earning",
  "fake",
  "fee",
  "follow",
  "for",
  "force",
  "forwarded",
  "from",
  "guaranteed",
  "government",
  "i",
  "in",
  "install",
  "instructions",
  "into",
  "invite",
  "invites",
  "join",
  "link",
  "loan",
  "mandatory",
  "me",
  "message",
  "messages",
  "money",
  "must",
  "my",
  "new",
  "not",
  "number",
  "of",
  "offer",
  "offers",
  "official",
  "on",
  "open",
  "parcel",
  "passport",
  "pay",
  "payment",
  "personal",
  "photo",
  "photos",
  "police",
  "pressures",
  "profit",
  "promise",
  "promises",
  "protection",
  "replace",
  "safe",
  "says",
  "scan",
  "scam",
  "screen",
  "send",
  "sent",
  "services",
  "share",
  "should",
  "sign",
  "son",
  "stranger",
  "support",
  "suspicious",
  "tax",
  "tell",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "threatens",
  "through",
  "ticket",
  "to",
  "training",
  "transaction",
  "transfer",
  "trust",
  "unknown",
  "urgent",
  "using",
  "verify",
  "visa",
  "vote",
  "with",
]);

function isArtifactOnly(text: string): boolean {
  const parts = text.split(/\s+/u).filter(Boolean);
  return parts.length > 0 && parts.every((part) => URL_RE.test(part) || USERNAME_RE.test(part));
}

function scoreTokens(tokens: readonly string[], signals: ReadonlySet<string>): number {
  return tokens.reduce((score, token) => score + Number(signals.has(token)), 0);
}

function hasPredominantlyRussianCyrillic(text: string): boolean {
  const cyrillicCount = text.match(RU_CYRILLIC_RE)?.length ?? 0;
  if (cyrillicCount === 0) return false;
  const latinCount = text.match(LATIN_CHARACTER_RE)?.length ?? 0;

  // A single Cyrillic lookalike in an otherwise Latin sentence is an evasion
  // attempt, not evidence that the whole request is Russian. A one-letter
  // genuinely Cyrillic query still resolves to Russian because latinCount=0.
  return cyrillicCount >= 2 || cyrillicCount > latinCount;
}

/**
 * Resolve the language of a natural-language Inline query.
 *
 * Telegram's saved session language remains the fallback for bare numbers,
 * URLs, usernames, secret-shaped input and genuinely ambiguous short text.
 * Content overrides it only when the query contains multiple strong language
 * signals, which prevents a single loanword such as "bank" or "SMS" from
 * unexpectedly switching the answer language.
 */
export function resolveTelegramTextLanguage(text: string, fallback: Lang): Lang {
  const normalized = normalizeIntentTextForMatching(text);
  if (!normalized) return fallback;

  if (SHORT_UZBEK_QUERY_RE.test(normalized)) return "uz";
  if (SHORT_ENGLISH_QUERY_RE.test(normalized)) return "en";

  if (
    isArtifactOnly(normalized) ||
    SEED_PHRASE_ONLY_RE.test(normalized) ||
    SHORT_SECRET_ONLY_RE.test(normalized)
  ) {
    return fallback;
  }

  if (
    UZ_CYRILLIC_RE.test(normalized) ||
    UZBEK_CYRILLIC_PHRASE_RE.test(normalized) ||
    looksLikeUzbekCyrillic(normalized)
  ) {
    return "uz";
  }

  const hasRussianCyrillic = hasPredominantlyRussianCyrillic(normalized);
  if (hasRussianCyrillic) return "ru";

  const tokens = normalized.match(LATIN_TOKEN_RE) ?? [];
  const uzScore = scoreTokens(tokens, UZ_SIGNALS);
  const enScore = scoreTokens(tokens, EN_SIGNALS);

  if (uzScore >= 2 && uzScore > enScore) return "uz";
  if (enScore >= 2 && enScore > uzScore) return "en";

  return fallback;
}

/** Backward-compatible surface name for the stateless Inline adapter. */
export function resolveInlineQueryLanguage(text: string, fallback: Lang): Lang {
  return resolveTelegramTextLanguage(text, fallback);
}
