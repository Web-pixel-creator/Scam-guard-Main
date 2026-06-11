import type { Lang } from "@/lib/i18n";
import type { VerifiedContact } from "./verified-contacts";

export type PhoneNumberKind =
  | "short_code"
  | "uz_mobile"
  | "uz_landline"
  | "international"
  | "unknown";
export type OfficialDirectoryStatus = "matched" | "not_found" | "not_applicable";

export interface PhoneCountryInfo {
  iso: string;
  callingCode: string;
  name: Record<Lang, string>;
}

export interface PhoneIntelligencePassport {
  digits: string;
  normalized: string;
  kind: PhoneNumberKind;
  isValidFormat: boolean;
  isUzbekistan: boolean;
  country: PhoneCountryInfo | null;
  uzPrefix: string | null;
  uzOperator: Record<Lang, string> | null;
  officialDirectoryStatus: OfficialDirectoryStatus;
}

const COUNTRY_CODES: readonly PhoneCountryInfo[] = [
  {
    iso: "UZ",
    callingCode: "998",
    name: { ru: "Узбекистан", uz: "O'zbekiston", en: "Uzbekistan" },
  },
  {
    iso: "KG",
    callingCode: "996",
    name: { ru: "Кыргызстан", uz: "Qirg'iziston", en: "Kyrgyzstan" },
  },
  {
    iso: "KZ_RU",
    callingCode: "7",
    name: { ru: "Россия/Казахстан", uz: "Rossiya/Qozog'iston", en: "Russia/Kazakhstan" },
  },
  {
    iso: "TJ",
    callingCode: "992",
    name: { ru: "Таджикистан", uz: "Tojikiston", en: "Tajikistan" },
  },
  {
    iso: "TM",
    callingCode: "993",
    name: { ru: "Туркменистан", uz: "Turkmaniston", en: "Turkmenistan" },
  },
  {
    iso: "AZ",
    callingCode: "994",
    name: { ru: "Азербайджан", uz: "Ozarbayjon", en: "Azerbaijan" },
  },
  { iso: "GE", callingCode: "995", name: { ru: "Грузия", uz: "Gruziya", en: "Georgia" } },
  {
    iso: "US_CA",
    callingCode: "1",
    name: { ru: "США/Канада", uz: "AQSH/Kanada", en: "US/Canada" },
  },
  { iso: "DE", callingCode: "49", name: { ru: "Германия", uz: "Germaniya", en: "Germany" } },
  {
    iso: "GB",
    callingCode: "44",
    name: { ru: "Великобритания", uz: "Buyuk Britaniya", en: "United Kingdom" },
  },
  { iso: "TR", callingCode: "90", name: { ru: "Турция", uz: "Turkiya", en: "Turkey" } },
  { iso: "AE", callingCode: "971", name: { ru: "ОАЭ", uz: "BAA", en: "UAE" } },
  { iso: "CN", callingCode: "86", name: { ru: "Китай", uz: "Xitoy", en: "China" } },
  {
    iso: "KR",
    callingCode: "82",
    name: { ru: "Южная Корея", uz: "Janubiy Koreya", en: "South Korea" },
  },
  { iso: "IN", callingCode: "91", name: { ru: "Индия", uz: "Hindiston", en: "India" } },
  { iso: "UA", callingCode: "380", name: { ru: "Украина", uz: "Ukraina", en: "Ukraine" } },
  { iso: "BY", callingCode: "375", name: { ru: "Беларусь", uz: "Belarus", en: "Belarus" } },
  { iso: "PL", callingCode: "48", name: { ru: "Польша", uz: "Polsha", en: "Poland" } },
  { iso: "FR", callingCode: "33", name: { ru: "Франция", uz: "Fransiya", en: "France" } },
  { iso: "IT", callingCode: "39", name: { ru: "Италия", uz: "Italiya", en: "Italy" } },
  { iso: "ES", callingCode: "34", name: { ru: "Испания", uz: "Ispaniya", en: "Spain" } },
  {
    iso: "NL",
    callingCode: "31",
    name: { ru: "Нидерланды", uz: "Niderlandiya", en: "Netherlands" },
  },
  { iso: "SE", callingCode: "46", name: { ru: "Швеция", uz: "Shvetsiya", en: "Sweden" } },
  {
    iso: "CH",
    callingCode: "41",
    name: { ru: "Швейцария", uz: "Shveytsariya", en: "Switzerland" },
  },
].sort((a, b) => b.callingCode.length - a.callingCode.length);

const UZ_PREFIXES: Record<string, Record<Lang, string>> = {
  "33": {
    ru: "Humans по префиксу 33",
    uz: "33 prefiksi bo'yicha Humans",
    en: "Humans by prefix 33",
  },
  "77": {
    ru: "Uzmobile по префиксу 77",
    uz: "77 prefiksi bo'yicha Uzmobile",
    en: "Uzmobile by prefix 77",
  },
  "88": {
    ru: "Mobiuz/Humans по префиксу 88",
    uz: "88 prefiksi bo'yicha Mobiuz/Humans",
    en: "Mobiuz/Humans by prefix 88",
  },
  "90": {
    ru: "Beeline по префиксу 90",
    uz: "90 prefiksi bo'yicha Beeline",
    en: "Beeline by prefix 90",
  },
  "91": {
    ru: "Beeline по префиксу 91",
    uz: "91 prefiksi bo'yicha Beeline",
    en: "Beeline by prefix 91",
  },
  "93": { ru: "Ucell по префиксу 93", uz: "93 prefiksi bo'yicha Ucell", en: "Ucell by prefix 93" },
  "94": { ru: "Ucell по префиксу 94", uz: "94 prefiksi bo'yicha Ucell", en: "Ucell by prefix 94" },
  "95": {
    ru: "Uzmobile по префиксу 95",
    uz: "95 prefiksi bo'yicha Uzmobile",
    en: "Uzmobile by prefix 95",
  },
  "97": {
    ru: "Mobiuz по префиксу 97",
    uz: "97 prefiksi bo'yicha Mobiuz",
    en: "Mobiuz by prefix 97",
  },
  "98": {
    ru: "Perfectum по префиксу 98",
    uz: "98 prefiksi bo'yicha Perfectum",
    en: "Perfectum by prefix 98",
  },
  "99": {
    ru: "Uzmobile по префиксу 99",
    uz: "99 prefiksi bo'yicha Uzmobile",
    en: "Uzmobile by prefix 99",
  },
};

const UZ_LANDLINE_PREFIXES = new Set([
  "55",
  "61",
  "62",
  "65",
  "66",
  "67",
  "69",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "78",
  "79",
]);

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function detectCountry(digits: string): PhoneCountryInfo | null {
  return COUNTRY_CODES.find((country) => digits.startsWith(country.callingCode)) ?? null;
}

function isShortCode(
  raw: string,
  digits: string,
  verifiedContact: VerifiedContact | null,
): boolean {
  return (
    verifiedContact?.contactType === "short_code" ||
    verifiedContact?.contactType === "toll_free" ||
    (/^\d{3,5}$/.test(raw.trim()) && digits.length >= 3 && digits.length <= 5)
  );
}

export function buildPhoneIntelligencePassport(
  raw: string,
  normalized: string,
  verifiedContact: VerifiedContact | null,
): PhoneIntelligencePassport {
  const normalizedDigits = digitsOnly(normalized);
  const rawDigits = digitsOnly(raw);
  const digits = normalizedDigits || rawDigits;
  const shortCode = isShortCode(raw, digits, verifiedContact);
  const country = shortCode ? COUNTRY_CODES[0] : detectCountry(digits);
  const isUzbekistan = country?.iso === "UZ";
  const uzPrefix = isUzbekistan && digits.length >= 5 ? digits.slice(3, 5) : null;
  const uzOperator = uzPrefix ? (UZ_PREFIXES[uzPrefix] ?? null) : null;

  let kind: PhoneNumberKind = "unknown";
  if (shortCode) {
    kind = "short_code";
  } else if (isUzbekistan && uzPrefix && UZ_LANDLINE_PREFIXES.has(uzPrefix)) {
    kind = "uz_landline";
  } else if (isUzbekistan) {
    kind = "uz_mobile";
  } else if (country) {
    kind = "international";
  }

  const isValidFormat =
    shortCode ||
    (isUzbekistan
      ? digits.length === 12
      : Boolean(country) && digits.length >= 8 && digits.length <= 15);
  const officialDirectoryStatus: OfficialDirectoryStatus = verifiedContact
    ? "matched"
    : digits.length >= 3
      ? "not_found"
      : "not_applicable";

  return {
    digits,
    normalized,
    kind,
    isValidFormat,
    isUzbekistan,
    country,
    uzPrefix,
    uzOperator,
    officialDirectoryStatus,
  };
}
