import type { Lang } from "./i18n";

// `VerifiedContact.source` is an English provenance note shared with checks;
// the public directory shows it in the visitor's language. Domains and URLs
// stay as they are.
const WHOLE: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "gov.uz official trust phone list": {
    ru: "gov.uz — официальный список телефонов доверия",
    uz: "gov.uz — ishonch telefonlarining rasmiy ro‘yxati",
  },
  "Standard Uzbekistan emergency numbers": {
    ru: "стандартные экстренные номера Узбекистана",
    uz: "O‘zbekistonning standart favqulodda raqamlari",
  },
};

const NOTE: Record<string, Record<Exclude<Lang, "en">, string>> = {
  "official contacts page": {
    ru: "официальная страница контактов",
    uz: "rasmiy kontaktlar sahifasi",
  },
  "official contacts": { ru: "официальные контакты", uz: "rasmiy kontaktlar" },
  "Call Center official page": {
    ru: "официальная страница колл-центра",
    uz: "aloqa markazining rasmiy sahifasi",
  },
  "contact center page": { ru: "страница контакт-центра", uz: "aloqa markazi sahifasi" },
  "linked from official website": {
    ru: "ссылка с официального сайта",
    uz: "rasmiy saytdagi havola",
  },
  "Ministry of Digital Technologies, trust phone list": {
    ru: "Министерство цифровых технологий, список телефонов доверия",
    uz: "Raqamli texnologiyalar vazirligi, ishonch telefonlari ro‘yxati",
  },
};

function localizePart(part: string, lang: Exclude<Lang, "en">): string {
  const whole = WHOLE[part];
  if (whole) return whole[lang];
  const match = /^(\S+) \((.+)\)$/u.exec(part);
  const note = match ? NOTE[match[2]] : undefined;
  return match && note ? `${match[1]} (${note[lang]})` : part;
}

export function localizeContactSource(source: string, lang: Lang): string {
  if (lang === "en") return source;
  return source
    .split("; ")
    .map((part) => localizePart(part, lang))
    .join("; ");
}
