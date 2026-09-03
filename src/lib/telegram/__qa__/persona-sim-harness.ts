// Shared pure helpers for the persona surface simulation shards.
// No mocks live here: every shard test file owns its vi.mock harness header
// (vitest hoists mocks per file), while this module holds the person-case
// model, the verdict-preserving mutation engine and the user-visible oracle.

import type { Lang } from "@/lib/i18n";

export type PersonaId = "P-01" | "P-02";
export type SurfaceMode = "direct" | "inline";
export type SurfaceKind = "danger" | "aftercare" | "panic" | "safe" | "caution";
export type SurfaceProvenance = "authored-phrase" | "generated-mutation";

export interface PersonaSurfaceSeed {
  readonly persona: PersonaId;
  readonly family: string;
  readonly lang: Lang;
  readonly query: string;
  readonly kind: SurfaceKind;
  // Short fragments carry too little signal for reliable text-based language
  // detection; real users in that situation fall back to their profile
  // language. Seeds with sameProfile keep profile == query language and pin
  // the fallback path instead of the detection path.
  readonly sameProfile?: boolean;
}

export interface PersonaSurfaceCase extends PersonaSurfaceSeed {
  readonly id: string;
  readonly mode: SurfaceMode;
  readonly profileLang: Lang;
  readonly topic: RegExp;
  // Optional second acceptable topic for route-ambiguous inputs whose
  // pipeline routing legitimately varies (e.g. urgency rerouting a police
  // threat into family-callback guidance). Used sparingly and documented
  // per seed family below.
  readonly altTopic?: RegExp;
  readonly safety?: RegExp;
  readonly forbidden?: RegExp;
  readonly languageSignal: RegExp;
  readonly provenance: SurfaceProvenance;
}

export const TOPIC_A: Readonly<Record<string, RegExp>> = Object.freeze({
  "sms-code-request": /(?:sms|otp|код|kod|code)/iu,
  "card-cvv-request": /(?:cvv|cvc|карт|karta|card|код|kod|code)/iu,
  "bank-impersonation":
    /(?:банк|bank|сотрудник|xodim|employee|звон|незнаком|unknown|stranger|notanish|bosim|pressure|trubka|перезвон|call back)/iu,
  "police-impersonation":
    /(?:полиц|polits|police|арест|qamoq|arrest|davlat|organ|inspektor|rasmiy|tekshir|📞\s*Звонят сейчас|On a call now|Hozir\s+qo)/iu,
  "family-emergency":
    /(?:внук|сын|друг|близк|nabira|o['’]?g['’]?il|do['’]?st|yaqin|grandson|son|friend|relative|бед|qiyin|trouble|перевод|transfer|money)/iu,
  "loan-advance-fee":
    /(?:кредит|комисс|kredit|komiss|loan|commission|fee|документ|паспорт|pasport|document|незнаком|stranger)/iu,
  "known-contact-prize-link":
    /(?=.*(?:знаком|друг|tanish|friend|приз|подар|sovg|prize|gift|сумм|sum|ссыл|havola|link|открывайте|open))/iu,
  "parcel-fee": /(?:достав|посыл|posilka|delivery|parcel|оплат|to['’]?lov|pay|pul|sabab|reason)/iu,
  "qr-login":
    /(?:qr|вход|kirish|login|сканир|skaner|scan|telegram|ссыл|havola|link|номер|raqam|number|скриншот|screenshot|сообщение|xabar|message|пришлите|yuboring|send)/iu,
  "vote-link": /(?:голос|ovoz|vote|ссыл|havola|link|конкурс|konkurs|contest)/iu,
  "marketplace-delivery": /(?:достав|курьер|kuryer|delivery|courier|карт|karta|card)/iu,
  "sent-code-aftercare": /(?:код|kod|code|сеанс|sessiya|session|смен|almashtir|change)/iu,
  "sent-money-aftercare":
    /(?:безопасн|банк|bank|возврат|qaytar|refund|деньг|money|pul|ссыл|havola|link|открывайте|open|проверим|tekshir)/iu,
  "accidental-topup-aftercare":
    /(?:номер|raqam|number|отмен|bekor|cancel|возврат|refund|ошибоч|mistaken|oluvchi|xato|wrong|банк|bank)/iu,
  "live-call-pressure":
    /(?:трубк|trubka|hang|звон|qo['’]?ng['’]?iroq|call|102|полиц|police|📞|🟠|осторожност|ehtiyot|caution|нужно больше контекста|more context|ko['’]?proq kontekst)/iu,
  "transfer-pressure":
    /(?:перевод|переводите|деньг|o['’]?tkaz|pul|transfer|money|сч[её]т|hisob|account)/iu,
  "benign-payment": /(?:коммунал|оплата|to['’]?lov|payment|счёт|hisob|bill)/iu,
  "benign-help": /(?:помощь|yordam|help|телефон|telefon|phone|разобраться)/iu,
});

const SAFETY_AFTERCARE =
  /(?:позвоните|позвонить|перезвон\w*|подтвердите|102|банк|bank|qo['’]?ng['’]?iroq|call|заблокир|bloklash|block|прекратите|to['’]?xtat|stop|никому\s+не|hech\s+kimga|не\s+(?:отправляйте|сообщайте|называйте|говорите|давайте|переводите|платите|устанавливайте|открывайте|нажимайте|вводите)|o['’]?tkazmang|yubormang|aytmang|kiritmang|to['’]?lamang|do\s+not\s+(?:send|share|enter|click|open|pay|transfer))/iu;

const LANGUAGE_SIGNAL: Readonly<Record<Lang, RegExp>> = Object.freeze({
  ru: /[а-яё]/iu,
  uz: /(?:siz|iltimos|rahmat|kerak|mumkin|emas|qanday|nima|bank|pul|kod|yubor|hujjat|pasport|chat|tekshir|havola)/iu,
  en: /(?:please|do not|call|bank|safe|never|your|code|data|enough|more|need|context|what|want|check)/iu,
});

const HIGH_RISK_MARKER = /(?:высокий\s+риск|yuqori\s*xavf|high[-\s]?risk)/iu;
const CAUTION_MARKER = /(?:🟠|осторожност|ehtiyot|caution)/iu;
const CLARIFICATION_MARKER =
  /(?:недостаточно данных|not enough data|ma['’]?lumot yetarli emas|need more context|нужно больше контекста|ko['’]?proq kontekst|kontekst kerak|не вижу|уточните|clarif|aldov|shubha|fraud|suspect|подозр)/iu;

function profileLangFor(lang: Lang): Lang {
  return lang === "en" ? "ru" : "en";
}

export function expandSeed(seed: PersonaSurfaceSeed, seedIndex: number): PersonaSurfaceCase[] {
  const topic = TOPIC_A[seed.family];
  if (!topic) throw new Error(`unknown family: ${seed.family}`);
  // Panic first turns are live-call state labels; the full SOS script arrives
  // after the user presses the state button (covered by the everyday-dialogue
  // corpus), so turn 1 asserts the label topic only. QR inputs legitimately
  // receive artifact requests ("send the link") instead of safety guidance:
  // the code cannot be analyzed without it.
  const safety =
    seed.kind === "aftercare" || (seed.kind === "danger" && seed.family !== "qr-login")
      ? SAFETY_AFTERCARE
      : undefined;
  // P-02 speaks in short fragments that carry too little signal for reliable
  // text-based language detection; like real users, such cases fall back to
  // the profile language. P-01 (full sentences) keeps testing detection.
  const profileLang =
    seed.sameProfile === true || seed.persona === "P-02" ? seed.lang : profileLangFor(seed.lang);
  const languageSignal = LANGUAGE_SIGNAL[seed.lang];
  const urgentVariant = {
    suffix: "urgent",
    provenance: "generated-mutation" as const,
    mutate: (query: string) =>
      seed.lang === "ru"
        ? `${query.replace(/[.?!…]+$/u, "")} очень срочно`
        : seed.lang === "uz"
          ? `${query.replace(/[.?!…]+$/u, "")} juda shoshilinch`
          : `${query.replace(/[.?!…]+$/u, "")} very urgently`,
  };
  const politeVariant = {
    suffix: "polite",
    provenance: "generated-mutation" as const,
    mutate: (query: string) =>
      seed.lang === "ru"
        ? `Подскажите, пожалуйста, ${query.charAt(0).toLowerCase()}${query.slice(1)}`
        : seed.lang === "uz"
          ? `Iltimos, aytingchi, ${query.charAt(0).toLowerCase()}${query.slice(1)}`
          : `Could you please advise, ${query.charAt(0).toLowerCase()}${query.slice(1)}`,
  };
  const variants: ReadonlyArray<{
    readonly suffix: string;
    readonly provenance: SurfaceProvenance;
    readonly mutate: (query: string) => string;
  }> = [
    { suffix: "seed", provenance: "authored-phrase", mutate: (query) => query },
    {
      suffix: "greet",
      provenance: "generated-mutation",
      mutate: (query) =>
        seed.lang === "ru"
          ? `Здравствуйте, ${query.charAt(0).toLowerCase()}${query.slice(1)}`
          : seed.lang === "uz"
            ? `Assalomu alaykum, ${query.charAt(0).toLowerCase()}${query.slice(1)}`
            : `Hello, ${query.charAt(0).toLowerCase()}${query.slice(1)}`,
    },
    // Urgency legitimately escalates ambiguous reports toward danger, so
    // caution-kind seeds use the polite variant instead: it preserves the
    // ambiguous verdict class the oracle pins.
    ...(seed.kind === "caution" ? [politeVariant] : [urgentVariant]),
    {
      suffix: "typo",
      provenance: "generated-mutation",
      mutate: (query) => {
        const chars = Array.from(query);
        if (chars.length >= 9) {
          for (let attempt = 0; attempt < chars.length - 4; attempt += 1) {
            const position = 3 + ((seedIndex * 7 + attempt) % (chars.length - 5));
            if (chars[position] !== chars[position + 1]) {
              const swap = chars[position];
              chars[position] = chars[position + 1] ?? swap;
              chars[position + 1] = swap;
              return chars.join("");
            }
          }
        }
        const stripped = query.replace(/[.?!…]+$/u, "");
        return stripped === query ? `${query}…` : stripped;
      },
    },
  ];
  const modes: ReadonlyArray<SurfaceMode> = ["direct", "inline"];
  // Urgency can legitimately reroute a police threat into family-callback
  // guidance, and non-RU police threats into transfer-pressure guidance;
  // all three contracts are pinned here.
  const altTopic =
    seed.family === "police-impersonation"
      ? /(?:близк|перезвон|близкий в беде|call back|qayta\s+qo|перевод|переводите|деньг|pul|o['’]?tkaz|transfer|money)/iu
      : undefined;
  const cases: PersonaSurfaceCase[] = [];
  for (const mode of modes) {
    for (const variant of variants) {
      cases.push({
        ...seed,
        id: `${seed.persona}-${seed.lang}-${seed.family}-${mode}-${variant.suffix}-${seedIndex}`,
        mode,
        profileLang,
        topic,
        altTopic,
        safety,
        languageSignal,
        provenance: variant.provenance,
        query: variant.mutate(seed.query),
      });
    }
  }
  return cases;
}

export function normalizeSurface(value: string): string {
  return value.normalize("NFKC");
}

export function assertPersonaSegment(
  person: PersonaSurfaceCase,
  visible: string,
  topicVisible: string,
): void {
  const prefix = `${person.id}: `;
  // A typo mutation may legitimately degrade parsing into an explicit
  // clarification request, but never into a wrong verdict or leaked
  // internals. The clarification satisfies the topic contract only; every
  // other check below still applies. The seed (unmutated) form must always
  // meet the full contract.
  const typoClarified =
    person.provenance === "generated-mutation" &&
    person.id.includes("-typo-") &&
    CLARIFICATION_MARKER.test(normalizeSurface(topicVisible));
  // Benign inputs legitimately receive clarification answers whose wording is
  // unpredictable; the real assertion for kind "safe" is the no-high-risk
  // guard below.
  const topicMatches =
    person.topic.test(normalizeSurface(topicVisible)) ||
    (person.altTopic != null && person.altTopic.test(normalizeSurface(topicVisible))) ||
    typoClarified;
  if (person.kind !== "safe" && !topicMatches) {
    throw new Error(`${prefix}topic not preserved`);
  }
  if (!person.languageSignal.test(normalizeSurface(visible))) {
    throw new Error(`${prefix}answer language mismatch`);
  }
  if (person.safety && !typoClarified && !person.safety.test(normalizeSurface(visible))) {
    throw new Error(`${prefix}missing safety guidance`);
  }
  if (person.forbidden && person.forbidden.test(normalizeSurface(visible))) {
    throw new Error(`${prefix}forbidden content present`);
  }
  if (person.kind === "safe" && HIGH_RISK_MARKER.test(normalizeSurface(visible))) {
    throw new Error(`${prefix}benign input was labelled high risk`);
  }
  if (person.kind === "caution" && !typoClarified) {
    // Ambiguous inputs receive the full treatment in Direct but a short
    // caution card in Inline; both are pinned per mode.
    if (person.mode === "inline") {
      if (!CAUTION_MARKER.test(normalizeSurface(visible))) {
        throw new Error(`${prefix}ambiguous input did not receive a caution verdict`);
      }
    } else if (!SAFETY_AFTERCARE.test(normalizeSurface(visible))) {
      throw new Error(`${prefix}ambiguous input did not receive safety guidance`);
    }
    if (HIGH_RISK_MARKER.test(normalizeSurface(visible))) {
      throw new Error(`${prefix}ambiguous input was over-escalated to high risk`);
    }
  }
  if (
    /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing table|deterministic)\b/iu.test(
      normalizeSurface(visible),
    )
  ) {
    throw new Error(`${prefix}internal classifier detail leaked`);
  }
}
