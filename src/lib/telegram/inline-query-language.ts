import type { Lang } from "@/lib/i18n";
import { looksLikeUzbekCyrillic } from "@/lib/risk/uz-cyrillic-translit";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

const UZ_CYRILLIC_RE = /[ўқғҳ]/iu;
const UZBEK_CYRILLIC_PHRASE_RE =
  /(?:^|\s)(?:мени|бизни|сизни|уларни)\s+(?:алдашди|алдамоқчи|алдамокчи)(?:\s|$)|(?:^|\s)(?:ёрдам|йордам)\s+бер(?:инг|инглар)?(?:\s|$)|(?:^|\s)(?:телефонимга|картамга|аккаунтимга)\s+(?:код|хабар|пул)\s+(?:келди|тушди)(?:\s|$)|^(?:энди\s+)?нима\s+қ?ил(?:ай|ишим\s+керак)[?!.\s]*$|^уларга\s+нима\s+(?:деяй|айтай|ёзай)[?!.\s]*$/iu;
const RU_CYRILLIC_RE = /[а-яё]/giu;
const LATIN_CHARACTER_RE = /\p{Script=Latin}/gu;
const LATIN_TOKEN_RE = /[a-z]+(?:'[a-z]+)*/giu;
const LANGUAGE_TOKEN_RE = /[\p{L}\p{M}\p{N}_'-]+/gu;

// Keep identifiers and secret-shaped fragments on the explicitly selected
// language. They do not contain enough natural-language context to infer one.
const URL_RE = /^(?:https?:\/\/|www\.)\S+$/iu;
const USERNAME_RE = /^@[a-z0-9_]{3,}$/iu;
const SEED_PHRASE_ONLY_RE = /^seed\s+phrase\s*:?\s+(?:[a-z]+\s+){2,}[a-z]+[.!?]?$/iu;
const SHORT_SECRET_ONLY_RE =
  /^(?:(?:sms|otp|pin)(?:[-\s]*(?:code|kod))?|cvv|password|parol)(?:\s*[:=]?\s*[a-z0-9_-]+)?[.!?]?$/iu;
const SHORT_UZBEK_QUERY_RE =
  /^(?:salom(?:\s*,?\s*bot)?|assalomu\s+alaykum|xayrli\s+(?:tong|kun|kech)|yordam|mayli|xo['’]?p|aniqmi|rostmi|tushunarli|(?:(?:katta|катта)\s+)?(?:rahmat|raxmat|рахмат|раҳмат)(?:\s+(?:(?:katta|катта)\s+)?(?:rahmat|raxmat|рахмат|раҳмат))*|(?:(?:sms|otp|pin|kod|havola|link|pul|parol)\s+)?(?:beraymi|aytaymi|yuboraymi|ochaymi|to['’]?laymi|ishonaymi|qilaymi|kiraymi)|(?:endi[-\s]*chi|nima\s+qilay|keyin\s+nima|nega\s+bunday|nima\s+uchun|ularga\s+nima\s+(?:deyay|aytay|yozay)|bank\s+nomeri\s+qane))[?!.]*$/iu;
const SHORT_ENGLISH_QUERY_RE =
  /^(?:hello(?:\s*,?\s*bot)?|help|done|thanks?|thank\s+you|hi\s+there|good\s+(?:morning|afternoon|evening)(?:\s*,?\s*bot)?|okay|really|what\s+next|(?:tell|share|send|open|pay|call|trust|verify)\s+(?:the\s+)?(?:otp|sms(?:\s+code)?|code|link|him|her|them|it))[?!.]*$/iu;
const SHORT_RUSSIAN_LATIN_QUERY_RE =
  /^(?:p[oa]chemu|chto\s+(?:mne\s+)?delat\s+dalshe|chto\s+(?:mne\s+)?im\s+(?:skazat|otvetit)|nu\s+i\s+chto\s+teper)[?!.\s]*$/iu;
const UZ_COMPLETED_ACTION_PHRASE_RE =
  /(?<![\p{L}\p{N}_'-])(?:raqamni\s+tashlab\s+yubordim|pulni\s+jo['’]?natvordim)(?![\p{L}\p{N}_'-])/iu;

// Loanwords shared by Uzbek and English (bank, SMS, code, Telegram, channel,
// etc.) are deliberately absent. Ordinary sentences still contain several
// language-specific function words or inflected words, while "SMS code" and
// bare artefacts remain genuinely ambiguous.
const UZ_SIGNALS = new Set([
  "aldov",
  "almashtirish",
  "ayting",
  "aytishdi",
  "aytmadim",
  "aytishni",
  "aytishimni",
  "akkauntim",
  "avval",
  "bajarishni",
  "bekor",
  "berib",
  "bering",
  "begona",
  "bosing",
  "bezopasniy",
  "bilan",
  "bankdan",
  "bepul",
  "boj",
  "bosim",
  "chaqiryapti",
  "chipta",
  "daromad",
  "davlat",
  "degan",
  "deganlar",
  "deb",
  "depozit",
  "ertaga",
  "ekranimni",
  "firib",
  "foyda",
  "guruhga",
  "hech",
  "havola",
  "havolaga",
  "havolasini",
  "himoyasini",
  "hisobga",
  "ish",
  "ishga",
  "ishonchli",
  "jamg'arma",
  "jarima",
  "jo'nating",
  "kafolatlangan",
  "kanalda",
  "kanalga",
  "kanaliga",
  "kartaga",
  "kartaning",
  "kerak",
  "kimga",
  "kirib",
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
  "majburladi",
  "majburiy",
  "maxsus",
  "men",
  "mendan",
  "menga",
  "meni",
  "mumkinmi",
  "ni",
  "nasiya",
  "notanish",
  "o'chirishni",
  "ochdim",
  "o'g'lim",
  "o'g'irlandi",
  "o'qish",
  "o'rnatib",
  "o'tkazma",
  "o'tkazishni",
  "o'tishni",
  "odam",
  "odamga",
  "oldindan",
  "olamiz",
  "operatsiyasini",
  "operatsiyasi",
  "orqali",
  "ovoz",
  "parolini",
  "pasport",
  "politsiyadanman",
  "posilka",
  "pul",
  "pulni",
  "qayta",
  "qaytaramiz",
  "qilish",
  "qilishdi",
  "qilishni",
  "qilishimni",
  "qilmaslikni",
  "qildimmi",
  "qiling",
  "qilib",
  "qilyapti",
  "qonuniy",
  "qizim",
  "qoldirishga",
  "qutini",
  "qo'ng'iroq",
  "qo'shilishga",
  "qo'rqitib",
  "raqam",
  "rasmiylashtirildi",
  "rasmiy",
  "rasmini",
  "ruxsatini",
  "shantaj",
  "shaxsiy",
  "shaxsni",
  "shoshirib",
  "sizga",
  "schyotga",
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
  "to'ladim",
  "to'lov",
  "to'lovi",
  "to'g'ri",
  "to'lang",
  "to'ldiring",
  "uchradi",
  "uchrashaman",
  "uchun",
  "ular",
  "va",
  "va'da",
  "viza",
  "bermoqchiman",
  "xavfsiz",
  "xaridor",
  "xizmati",
  "xizmatidan",
  "yangi",
  "yangilanishi",
  "yordam",
  "yashirishni",
  "yoniga",
  "yozib",
  "yubordim",
  "yuborib",
  "yuboring",
  "yuborishni",
  "yuborilgan",
  "yuboryapman",
  "yuklamadim",
  "yuklasam",
  "yechish",
  "aytmang",
  "balansni",
  "deyishyapti",
  "kuniga",
  "o'tkazing",
  "zudlik",
  "bormadim",
  "bermadim",
  "cashbackli",
  "ilovasida",
  "kelmadi",
  "prokuraturadanmiz",
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

// Common function words and productive inflections that occur in natural
// conversation but are absent from short artefacts such as `SMS code` or a
// bare username. Keeping these in a separate bounded lexicon makes the
// cross-profile override auditable without turning loanwords into evidence.
const UZ_CONVERSATIONAL_SIGNALS = new Set([
  "adashib",
  "akam",
  "akamga",
  "aldashmoqchi",
  "aniq",
  "baholay",
  "belgilarni",
  "bera",
  "bir",
  "bo'ladimi",
  "bo'ldi",
  "bor",
  "bu",
  "bunga",
  "buni",
  "buvim",
  "chatida",
  "dalillardan",
  "darslikda",
  "do'stimga",
  "do'stim",
  "dugonasining",
  "ekranni",
  "emasman",
  "endi",
  "faylini",
  "foydalandingiz",
  "firibgarlar",
  "firibgarlik",
  "firibgarlikka",
  "foydalanaman",
  "gapirmaydi",
  "haqiqiy",
  "havolani",
  "himoya",
  "hozir",
  "hozirgina",
  "hujjati",
  "iltimosi",
  "ishonchingiz",
  "ishonmayman",
  "javob",
  "juda",
  "kartamdan",
  "keyin",
  "kelibdi",
  "keldi",
  "kengaytmasi",
  "kimsiz",
  "komilmi",
  "ko'rib",
  "ko'rdingiz",
  "ko'rsating",
  "ko'tarsam",
  "kutmagan",
  "lekin",
  "ma'lumotni",
  "matnini",
  "menda",
  "menimcha",
  "misol",
  "modeli",
  "mos",
  "narigi",
  "natijaga",
  "natijani",
  "nega",
  "nima",
  "nimaga",
  "noma'lum",
  "nomli",
  "odamim",
  "oldim",
  "olasan",
  "olasizmi",
  "onam",
  "onamga",
  "operatorga",
  "o'rnating",
  "o'tkazib",
  "oilaviy",
  "ovozida",
  "profilini",
  "qanday",
  "qaysi",
  "qaror",
  "qarz",
  "qila",
  "qiladi",
  "qilay",
  "qilaman",
  "qildingiz",
  "qildingizmi",
  "qizimga",
  "qoldim",
  "qo'rqyapman",
  "qo'yishdan",
  "raqamini",
  "rasmni",
  "rozi",
  "ruxsatsiz",
  "shekilli",
  "sifatida",
  "siz",
  "skrinshotlarni",
  "so'rab",
  "shoshilinch",
  "shunday",
  "tahlil",
  "tanish",
  "tanishi",
  "tekshira",
  "tekshirasizmi",
  "tekshirdingizmi",
  "tekshirdingiz",
  "tekshirib",
  "tekshirishga",
  "tekshiring",
  "telefonni",
  "tomonda",
  "topganimdan",
  "to'lab",
  "tugadi",
  "tushuntiring",
  "ulgurdi",
  "ularga",
  "ularning",
  "unda",
  "usul",
  "xato",
  "xavotirdaman",
  "xayrli",
  "xotirjam",
  "xursandman",
  "yaxshi",
  "yana",
  "yechildi",
  "yig'ish",
  "yoki",
  "yubordi",
  "yuborsam",
  "yozibdi",
]);

const EN_CONVERSATIONAL_SIGNALS = new Set([
  "am",
  "are",
  "be",
  "can",
  "could",
  "did",
  "do",
  "does",
  "done",
  "explain",
  "happened",
  "help",
  "how",
  "is",
  "it",
  "just",
  "like",
  "need",
  "please",
  "result",
  "screenshot",
  "something",
  "sure",
  "use",
  "what",
  "who",
  "why",
  "words",
  "wrong",
  "you",
  "your",
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
  const hasSubstantialCyrillicOnlyToken = (text.match(LANGUAGE_TOKEN_RE) ?? []).some((token) => {
    const tokenCyrillicCount = token.match(RU_CYRILLIC_RE)?.length ?? 0;
    const tokenLatinCount = token.match(LATIN_CHARACTER_RE)?.length ?? 0;
    return tokenCyrillicCount >= 2 && tokenLatinCount === 0;
  });

  // One or several Cyrillic lookalikes inside an otherwise Latin token are not
  // evidence that the whole request is Russian. A genuinely Cyrillic token,
  // including a one-letter query, remains sufficient evidence; a Cyrillic-
  // dominant mixed sentence also remains Russian.
  return hasSubstantialCyrillicOnlyToken || cyrillicCount > latinCount;
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
  if (SHORT_RUSSIAN_LATIN_QUERY_RE.test(normalized)) return "ru";
  if (UZ_COMPLETED_ACTION_PHRASE_RE.test(normalized)) return "uz";

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
  const uzScore = scoreTokens(tokens, UZ_SIGNALS) + scoreTokens(tokens, UZ_CONVERSATIONAL_SIGNALS);
  const enScore = scoreTokens(tokens, EN_SIGNALS) + scoreTokens(tokens, EN_CONVERSATIONAL_SIGNALS);

  if (uzScore >= 2 && uzScore > enScore) return "uz";
  if (enScore >= 2 && enScore > uzScore) return "en";

  return fallback;
}

/** Backward-compatible surface name for the stateless Inline adapter. */
export function resolveInlineQueryLanguage(text: string, fallback: Lang): Lang {
  return resolveTelegramTextLanguage(text, fallback);
}
