import type { Lang } from "@/lib/i18n";

export const INLINE_CONTEXT_MUTATION_COUNT = 24;
export const INLINE_CONTEXT_SEED_COUNT = 16;
export const INLINE_CONTEXT_LANGUAGE_COUNT = 3;
export const INLINE_CONTEXT_EXPECTED_CASE_COUNT =
  INLINE_CONTEXT_MUTATION_COUNT * INLINE_CONTEXT_SEED_COUNT * INLINE_CONTEXT_LANGUAGE_COUNT;

export type InlineContextSeedKey =
  | "code_request"
  | "sent_code"
  | "passport_request"
  | "passport_aftercare"
  | "authority_legal"
  | "earning_channel"
  | "job_offer"
  | "bank_contact"
  | "voting_link"
  | "tax_payment_link"
  | "sim_swap"
  | "family_distress"
  | "investment"
  | "unknown_specific_tail"
  | "reply_safety"
  | "next_step";

export interface InlineContextLocalizedSeed {
  core: string;
  preserve: string;
  semanticId: string;
  title: string;
  action: string;
}

interface MutationLanguageCopy {
  polite: string;
  politeTypo: string;
  generic: string;
  neutral: string;
  followup: string;
}

export interface InlineContextRobustnessCase extends InlineContextLocalizedSeed {
  id: string;
  seed: InlineContextSeedKey;
  lang: Lang;
  mutation: string;
  query: string;
}

const MUTATION_COPY: Record<Lang, MutationLanguageCopy> = {
  ru: {
    polite: "Пожалуйста, помогите: ",
    politeTypo: "Пажалуйста, подскажите: ",
    generic: "Это безопасно или меня обманывают?",
    neutral: "Я сейчас дома и никуда не спешу",
    followup: "Что мне безопасно сделать сейчас?",
  },
  uz: {
    polite: "Iltimos, yordam bering: ",
    politeTypo: "Iltmos, ayting: ",
    generic: "Bu xavfsizmi yoki meni aldashyaptimi?",
    neutral: "Men hozir uydaman va shoshmayapman",
    followup: "Hozir xavfsiz nima qilishim kerak?",
  },
  en: {
    polite: "Please help me: ",
    politeTypo: "Pleese advise me: ",
    generic: "Is this safe or are they scamming me?",
    neutral: "I am at home and I am not in a hurry",
    followup: "What is the safe thing to do now?",
  },
};

const LOCALIZED_SEEDS: Record<InlineContextSeedKey, Record<Lang, InlineContextLocalizedSeed>> = {
  code_request: {
    ru: {
      core: "Пришел SMS-код, незнакомец просит назвать его",
      preserve: "незнакомец просит назвать его",
      semanticId: "check-suspicious-code-request",
      title: "Код: никому не называйте",
      action: "SMS",
    },
    uz: {
      core: "SMS kod keldi, notanish odam uni aytishimni so'rayapti",
      preserve: "notanish odam uni aytishimni so'rayapti",
      semanticId: "check-suspicious-code-request",
      title: "Kod: hech kimga aytmang",
      action: "SMS",
    },
    en: {
      core: "An SMS code arrived and a stranger asks me to tell it",
      preserve: "a stranger asks me to tell it",
      semanticId: "check-suspicious-code-request",
      title: "Code: do not share it with anyone",
      action: "SMS",
    },
  },
  sent_code: {
    ru: {
      core: "Я уже назвал SMS-код незнакомцу",
      preserve: "уже назвал SMS-код незнакомцу",
      semanticId: "check-suspicious-sent-code",
      title: "Код уже отправлен: действуйте срочно",
      action: "Заблокируйте",
    },
    uz: {
      core: "Men SMS kodni notanish odamga aytib bo'ldim",
      preserve: "SMS kodni notanish odamga aytib bo'ldim",
      semanticId: "check-suspicious-sent-code",
      title: "Kod yuborilgan: tez harakat qiling",
      action: "bloklang",
    },
    en: {
      core: "I already told the SMS code to a stranger",
      preserve: "told the SMS code to a stranger",
      semanticId: "check-suspicious-sent-code",
      title: "Code already sent: act now",
      action: "Block",
    },
  },
  passport_request: {
    ru: {
      core: "Незнакомец просит прислать фото паспорта",
      preserve: "просит прислать фото паспорта",
      semanticId: "check-suspicious-personal-data",
      title: "Документы: не отправляйте фото",
      action: "Не отправляйте",
    },
    uz: {
      core: "Notanish odam pasport rasmini yuborishimni so'rayapti",
      preserve: "pasport rasmini yuborishimni so'rayapti",
      semanticId: "check-suspicious-personal-data",
      title: "Hujjatlar: rasm yubormang",
      action: "yubormang",
    },
    en: {
      core: "A stranger asks me to send a passport photo",
      preserve: "asks me to send a passport photo",
      semanticId: "check-suspicious-personal-data",
      title: "Documents: do not send photos",
      action: "Do not send",
    },
  },
  passport_aftercare: {
    ru: {
      core: "Я уже отправил фото паспорта незнакомцу",
      preserve: "отправил фото паспорта незнакомцу",
      semanticId: "check-unknown-personal-data-aftercare",
      title: "Паспорт уже отправлен: снизьте риск",
      action: "Сохраните переписку",
    },
    uz: {
      core: "Men pasport rasmini notanish odamga yubordim",
      preserve: "pasport rasmini notanish odamga yubordim",
      semanticId: "check-unknown-personal-data-aftercare",
      title: "Pasport yuborilgan: xavfni kamaytiring",
      action: "Yozishmani saqlang",
    },
    en: {
      core: "I already sent a passport photo to a stranger",
      preserve: "sent a passport photo to a stranger",
      semanticId: "check-unknown-personal-data-aftercare",
      title: "Passport already sent: reduce the risk",
      action: "Save the chat",
    },
  },
  authority_legal: {
    ru: {
      core: "Человек из РУВД пишет, что я подозреваемый по уголовному делу, и требует документы",
      preserve: "подозреваемый по уголовному делу",
      semanticId: "check-unknown-official-impersonation",
      title: "Госорган/инспектор: проверьте официально",
      action: "официальному номеру",
    },
    uz: {
      core: "IIB xodimi meni jinoyat ishida gumon qilib, hujjatlarni talab qilyapti",
      preserve: "jinoyat ishida gumon qilib",
      semanticId: "check-unknown-official-impersonation",
      title: "Davlat organi/inspektor: rasmiy tekshiring",
      action: "rasmiy",
    },
    en: {
      core: "A police investigator says I am a suspect in a criminal case and demands documents",
      preserve: "suspect in a criminal case",
      semanticId: "check-unknown-official-impersonation",
      title: "Government/inspector: verify officially",
      action: "official number",
    },
  },
  earning_channel: {
    ru: {
      core: "Меня приглашают в канал для заработка и обещают быстрый доход",
      preserve: "канал для заработка",
      semanticId: "check-unknown-earning-channel",
      title: "Канал заработка: осторожно",
      action: "Не платите заранее",
    },
    uz: {
      core: "Meni daromad kanaliga taklif qilib, tez foyda va'da qilishyapti",
      preserve: "daromad kanaliga taklif",
      semanticId: "check-unknown-earning-channel",
      title: "Daromad kanali: ehtiyot bo'ling",
      action: "Oldindan to'lamang",
    },
    en: {
      core: "They invite me to an earning channel and promise fast income",
      preserve: "earning channel",
      semanticId: "check-unknown-earning-channel",
      title: "Earning channel: be careful",
      action: "Do not prepay",
    },
  },
  job_offer: {
    ru: {
      core: "Предлагают работу, но просят оплатить обязательное обучение",
      preserve: "оплатить обязательное обучение",
      semanticId: "check-unknown-job-offer",
      title: "Работа: не платите взнос",
      action: "Платить за вакансию",
    },
    uz: {
      core: "Ish taklif qilishdi, lekin majburiy o'qish uchun pul so'rashyapti",
      preserve: "majburiy o'qish uchun pul",
      semanticId: "check-unknown-job-offer",
      title: "Ish: oldindan to'lov qilmang",
      action: "to'lash xavfli",
    },
    en: {
      core: "They offer me a job but ask me to pay for mandatory training",
      preserve: "pay for mandatory training",
      semanticId: "check-unknown-job-offer",
      title: "Job: do not pay a fee",
      action: "before a contract is risky",
    },
  },
  bank_contact: {
    ru: {
      core: "Как мне связаться с банком, если номер прислали в чате?",
      preserve: "связаться с банком",
      semanticId: "check-unknown-bank-contact",
      title: "Связаться с банком: только официальный номер",
      action: "Не используйте номер из чата",
    },
    uz: {
      core: "Chatda raqam yuborishdi, bank bilan qanday bog'lansam bo'ladi?",
      preserve: "bank bilan qanday bog'lansam",
      semanticId: "check-unknown-bank-contact",
      title: "Bank bilan aloqa: faqat rasmiy raqam",
      action: "foydalanmang",
    },
    en: {
      core: "How do I contact the bank if the number came from a chat?",
      preserve: "contact the bank",
      semanticId: "check-unknown-bank-contact",
      title: "Contacting the bank: official number only",
      action: "Do not use a number from a chat",
    },
  },
  voting_link: {
    ru: {
      core: "Меня просят проголосовать в канале и перейти по ссылке",
      preserve: "проголосовать в канале",
      semanticId: "check-unknown-voting-link",
      title: "Голосование/канал: сначала проверим",
      action: "Не переходите по ссылке",
    },
    uz: {
      core: "Mendan kanalda ovoz berib, havolaga o'tishni so'rashyapti",
      preserve: "kanalda ovoz berib",
      semanticId: "check-unknown-voting-link",
      title: "Ovoz berish/kanal: avval tekshiramiz",
      action: "Havolaga o'tmang",
    },
    en: {
      core: "They ask me to vote in a channel and open a link",
      preserve: "vote in a channel",
      semanticId: "check-unknown-voting-link",
      title: "Voting/channel: check it first",
      action: "Do not open the link",
    },
  },
  tax_payment_link: {
    ru: {
      core: "Меня просят оплатить налог по ссылке из чата",
      preserve: "оплатить налог по ссылке",
      semanticId: "check-unknown-tax-payment",
      title: "Налог по ссылке: не оплачивайте",
      action: "Не платите",
    },
    uz: {
      core: "Chatdagi havola orqali soliq to'lashimni so'rashyapti",
      preserve: "havola orqali soliq to'lashimni",
      semanticId: "check-unknown-tax-payment",
      title: "Havoladagi soliq: to'lamang",
      action: "to'lamang",
    },
    en: {
      core: "They ask me to pay a tax through a link from the chat",
      preserve: "pay a tax through a link",
      semanticId: "check-unknown-tax-payment",
      title: "Tax payment link: do not pay",
      action: "Do not pay",
    },
  },
  sim_swap: {
    ru: {
      core: "Оператор просит код для замены SIM-карты",
      preserve: "код для замены SIM-карты",
      semanticId: "check-suspicious-sim-swap",
      title: "SIM/оператор: осторожно",
      action: "Не называйте код",
    },
    uz: {
      core: "Operator SIM kartani almashtirish uchun kod so'rayapti",
      preserve: "SIM kartani almashtirish uchun kod",
      semanticId: "check-suspicious-sim-swap",
      title: "SIM/operator: ehtiyot bo'ling",
      action: "kod aytmang",
    },
    en: {
      core: "The mobile operator asks for a code to replace my SIM card",
      preserve: "code to replace my SIM card",
      semanticId: "check-suspicious-sim-swap",
      title: "SIM/operator: be careful",
      action: "Do not share a code",
    },
  },
  family_distress: {
    ru: {
      core: "Сын попал в аварию и просит срочно перевести деньги",
      preserve: "сын попал в аварию",
      semanticId: "check-unknown-relative-distress",
      title: "Близкий в беде: перезвоните",
      action: "Перезвоните близкому",
    },
    uz: {
      core: "O'g'lim avariyaga tushdi deb, zudlik bilan pul o'tkazishni so'rashyapti",
      preserve: "avariyaga tushdi",
      semanticId: "check-unknown-relative-distress",
      title: "Yaqin odam xavfda: qayta qo'ng'iroq qiling",
      action: "qayta qo'ng'iroq qiling",
    },
    en: {
      core: "They say my son had an accident and ask me to send money urgently",
      preserve: "my son had an accident",
      semanticId: "check-unknown-relative-distress",
      title: "Loved one in trouble: call back",
      action: "Call the saved number",
    },
  },
  investment: {
    ru: {
      core: "Предлагают вложить деньги в TON wallet с гарантированным доходом",
      preserve: "гарантированным доходом",
      semanticId: "check-suspicious-investment-offer",
      title: "Инвестиции/крипта: осторожно",
      action: "Не переводите депозит",
    },
    uz: {
      core: "TON walletga pul qo'yib, kafolatlangan daromad olishni taklif qilishyapti",
      preserve: "kafolatlangan daromad",
      semanticId: "check-suspicious-investment-offer",
      title: "Invest/kripto: ehtiyot bo'ling",
      action: "Depozit yubormang",
    },
    en: {
      core: "They offer a TON wallet investment with guaranteed income",
      preserve: "guaranteed income",
      semanticId: "check-suspicious-investment-offer",
      title: "Invest/crypto: be careful",
      action: "Do not send a deposit",
    },
  },
  unknown_specific_tail: {
    ru: {
      core: "Мне пишет незнакомец\nОн просит установить AnyDesk для проверки",
      preserve: "установить AnyDesk",
      semanticId: "check-unknown-app-request",
      title: "Приложение: не устанавливайте",
      action: "Не ставьте APK",
    },
    uz: {
      core: "Menga notanish odam yozyapti\nU tekshiruv uchun AnyDesk o'rnatishimni so'rayapti",
      preserve: "AnyDesk o'rnatishimni",
      semanticId: "check-unknown-app-request",
      title: "Ilova: o'rnatmang",
      action: "o'rnatmang",
    },
    en: {
      core: "A stranger is messaging me\nThey ask me to install AnyDesk for verification",
      preserve: "install AnyDesk",
      semanticId: "check-unknown-app-request",
      title: "App: do not install it",
      action: "Do not install APK",
    },
  },
  reply_safety: {
    ru: {
      core: "Можно ли ему ответить, не раскрывая свои данные?",
      preserve: "можно ли ему ответить",
      semanticId: "check-unknown-reply-safety",
      title: "Ответ: не раскрывайте данные",
      action: "Сюда добавляйте только текст просьбы",
    },
    uz: {
      core: "Ma'lumotlarimni bermasdan unga javob bersam bo'ladimi?",
      preserve: "unga javob bersam",
      semanticId: "check-unknown-reply-safety",
      title: "Javob: ma'lumot bermang",
      action: "faqat iltimos matnini",
    },
    en: {
      core: "Can I reply without revealing my personal data?",
      preserve: "Can I reply",
      semanticId: "check-unknown-reply-safety",
      title: "Reply: do not reveal data",
      action: "Add only the request text",
    },
  },
  next_step: {
    ru: {
      core: "Что мне делать дальше? Пока я ничего не отправлял",
      preserve: "что мне делать дальше",
      semanticId: "check-unknown-next-step",
      title: "Что делать: пока ничего не отправляйте",
      action: "Добавьте в этот запрос",
    },
    uz: {
      core: "Keyin nima qilishim kerak? Hali hech narsa yubormadim",
      preserve: "nima qilishim kerak",
      semanticId: "check-unknown-next-step",
      title: "Nima qilish kerak: hozircha hech narsa yubormang",
      action: "Shu so'rovga",
    },
    en: {
      core: "What should I do next? I have not sent anything yet",
      preserve: "What should I do next",
      semanticId: "check-unknown-next-step",
      title: "What to do: do not send anything yet",
      action: "Add the text",
    },
  },
};

const MUTATIONS: ReadonlyArray<{
  id: string;
  build: (seed: InlineContextLocalizedSeed, copy: MutationLanguageCopy) => string;
}> = [
  { id: "raw", build: ({ core }) => core },
  { id: "polite-space", build: ({ core }, copy) => `${copy.polite}${core}` },
  { id: "polite-newline", build: ({ core }, copy) => `${copy.polite.trim()}\n${core}` },
  { id: "generic-before", build: ({ core }, copy) => `${copy.generic}\n${core}` },
  { id: "generic-after", build: ({ core }, copy) => `${core}\n${copy.generic}` },
  { id: "neutral-before-comma", build: ({ core }, copy) => `${copy.neutral}, ${core}` },
  { id: "neutral-before-newline", build: ({ core }, copy) => `${copy.neutral}\n${core}` },
  { id: "neutral-after", build: ({ core }, copy) => `${core}\n${copy.neutral}` },
  { id: "crlf", build: ({ core }, copy) => `${copy.generic}\r\n${core}` },
  { id: "blank-line", build: ({ core }, copy) => `${copy.generic}\n\n${core}` },
  { id: "tab", build: ({ core }, copy) => `${copy.generic}\t${core}` },
  { id: "semicolon", build: ({ core }, copy) => `${copy.neutral}; ${core}` },
  { id: "em-dash", build: ({ core }, copy) => `${copy.neutral} — ${core}` },
  { id: "parentheses", build: ({ core }) => `(${core})` },
  { id: "quotes", build: ({ core }) => `“${core}”` },
  { id: "punctuation", build: ({ core }) => `... ${core}?!` },
  { id: "uppercase", build: ({ core }) => core.toLocaleUpperCase() },
  { id: "lowercase", build: ({ core }) => core.toLocaleLowerCase() },
  { id: "padded", build: ({ core }) => `   ${core}   ` },
  { id: "double-space", build: ({ core }) => core.replace(/\s/u, "   ") },
  { id: "polite-typo", build: ({ core }, copy) => `${copy.politeTypo}${core}` },
  {
    id: "generic-before-after",
    build: ({ core }, copy) => `${copy.generic}\n${core}\n${copy.followup}`,
  },
  {
    id: "neutral-generic-danger",
    build: ({ core }, copy) => `${copy.neutral}. ${copy.generic}\n${core}`,
  },
  {
    id: "full-dialogue",
    build: ({ core }, copy) => `${copy.polite.trim()}\n${copy.neutral}\n${core}\n${copy.followup}`,
  },
] as const;

export const INLINE_CONTEXT_ROBUSTNESS_CORPUS: readonly InlineContextRobustnessCase[] = (
  Object.entries(LOCALIZED_SEEDS) as Array<
    [InlineContextSeedKey, Record<Lang, InlineContextLocalizedSeed>]
  >
).flatMap(([seed, localized]) =>
  (Object.keys(localized) as Lang[]).flatMap((lang) =>
    MUTATIONS.map(({ id: mutation, build }) => ({
      id: `${seed}-${lang}-${mutation}`,
      seed,
      lang,
      mutation,
      query: build(localized[lang], MUTATION_COPY[lang]),
      ...localized[lang],
    })),
  ),
);

export const INLINE_CONTEXT_SAFE_CONTROLS: ReadonlyArray<{
  id: string;
  lang: Lang;
  query: string;
  forbiddenSemanticIds: readonly string[];
}> = [
  {
    id: "ru-official-bank-app-passport",
    lang: "ru",
    query: "Я сам загрузил паспорт через официальное приложение банка по своей заявке",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "ru-official-government-passport",
    lang: "ru",
    query: "Я отправил скан паспорта через официальный государственный портал",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "ru-official-visa-passport",
    lang: "ru",
    query: "Я передал паспорт через официальный визовый центр по своей заявке",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "uz-official-bank-app-passport",
    lang: "uz",
    query: "Men pasportimni rasmiy bank ilovasi orqali o'z arizam uchun yukladim",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "uz-official-government-passport",
    lang: "uz",
    query: "Men pasport skanini rasmiy davlat portali orqali yubordim",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "uz-official-visa-passport",
    lang: "uz",
    query: "Men pasportimni rasmiy viza markaziga o'z arizam uchun topshirdim",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "en-official-bank-app-passport",
    lang: "en",
    query: "I uploaded my passport through my bank's official app for my application",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "en-official-government-passport",
    lang: "en",
    query: "I sent my passport scan through the official government portal",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "en-official-visa-passport",
    lang: "en",
    query: "I sent my passport through the official visa application center",
    forbiddenSemanticIds: ["check-unknown-personal-data-aftercare"],
  },
  {
    id: "ru-ruvd-location",
    lang: "ru",
    query: "Где находится районное РУВД?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
  {
    id: "ru-mvd-meaning",
    lang: "ru",
    query: "Что означает сокращение МВД?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
  {
    id: "uz-iib-location",
    lang: "uz",
    query: "IIB bo'limining manzili qayerda?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
  {
    id: "uz-iib-meaning",
    lang: "uz",
    query: "IIB qisqartmasi nimani anglatadi?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
  {
    id: "en-police-location",
    lang: "en",
    query: "Where is the nearest police department?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
  {
    id: "en-police-meaning",
    lang: "en",
    query: "What does the police department abbreviation mean?",
    forbiddenSemanticIds: ["check-unknown-official-impersonation"],
  },
] as const;

if (MUTATIONS.length !== INLINE_CONTEXT_MUTATION_COUNT) {
  throw new Error(`Inline context mutation count drifted: ${MUTATIONS.length}`);
}

if (Object.keys(LOCALIZED_SEEDS).length !== INLINE_CONTEXT_SEED_COUNT) {
  throw new Error(`Inline context seed count drifted: ${Object.keys(LOCALIZED_SEEDS).length}`);
}

if (INLINE_CONTEXT_ROBUSTNESS_CORPUS.length !== INLINE_CONTEXT_EXPECTED_CASE_COUNT) {
  throw new Error(`Inline context corpus size drifted: ${INLINE_CONTEXT_ROBUSTNESS_CORPUS.length}`);
}
