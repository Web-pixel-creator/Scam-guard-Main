// Verified official contacts for Uzbekistan.
//
// When a user checks a number/link that matches an entry here, the risk engine
// can indicate "this is a known official contact" and lower the risk assessment
// instead of flagging it as suspicious. This reduces false positives for
// legitimate bank/government/operator hotlines.
//
// Sources: cbu.uz (Central Bank hotline), gov.uz (emergency numbers),
// gov.uk/foreign-travel-advice/uzbekistan (tourist hotline), publicly known
// bank call-center codes. All data is public and non-sensitive.
//
// Maintenance: add new entries as organizations are confirmed. Each entry
// must have a source comment. Do NOT add unverified numbers.

export interface VerifiedContact {
  /** Normalized phone number (E.164-like, digits only after +998) or short code */
  number: string;
  /** Organization name (for display) */
  org: { ru: string; uz: string; en: string };
  /** Category */
  category: "bank" | "government" | "operator" | "emergency";
  /** Brief description */
  description: { ru: string; uz: string; en: string };
  /** Source URL or reference */
  source: string;
}

/**
 * Emergency numbers (short codes, no +998 prefix).
 * These are universally known and free to call.
 */
export const EMERGENCY_NUMBERS: readonly VerifiedContact[] = [
  {
    number: "101",
    org: { ru: "Пожарная служба", uz: "Yong'in xizmati", en: "Fire Department" },
    category: "emergency",
    description: {
      ru: "Экстренный вызов пожарной охраны",
      uz: "Yong'in xizmati chaqiruvi",
      en: "Fire emergency hotline",
    },
    source: "Standard Uzbekistan emergency numbers",
  },
  {
    number: "102",
    org: { ru: "Полиция", uz: "Politsiya", en: "Police" },
    category: "emergency",
    description: {
      ru: "Полиция — сообщить о преступлении или мошенничестве",
      uz: "Politsiya — jinoyat yoki firibgarlik haqida xabar berish",
      en: "Police — report a crime or fraud",
    },
    source: "Standard Uzbekistan emergency numbers",
  },
  {
    number: "103",
    org: { ru: "Скорая помощь", uz: "Tez yordam", en: "Ambulance" },
    category: "emergency",
    description: {
      ru: "Скорая медицинская помощь",
      uz: "Tez tibbiy yordam",
      en: "Emergency medical services",
    },
    source: "Standard Uzbekistan emergency numbers",
  },
  {
    number: "1199",
    org: {
      ru: "Единый номер экстренных служб",
      uz: "Yagona favqulodda xizmatlar raqami",
      en: "Unified Emergency Number",
    },
    category: "emergency",
    description: {
      ru: "Единый номер для всех экстренных служб",
      uz: "Barcha favqulodda xizmatlar uchun yagona raqam",
      en: "Single number for all emergency services",
    },
    source: "Standard Uzbekistan emergency numbers",
  },
  {
    number: "1173",
    org: {
      ru: "Безопасный туризм (колл-центр)",
      uz: "Xavfsiz turizm (qo'ng'iroq markazi)",
      en: "Safe Tourism Call Centre",
    },
    category: "government",
    description: {
      ru: "24/7 помощь туристам — русский, узбекский, английский",
      uz: "24/7 sayyohlarga yordam — rus, o'zbek, ingliz tillarida",
      en: "24/7 tourist assistance — Uzbek, Russian, English",
    },
    source: "https://www.gov.uk/foreign-travel-advice/uzbekistan/getting-help",
  },
];

/**
 * Verified bank and government hotlines (with +998 prefix where applicable).
 * Numbers are stored in normalized form for matching.
 */
export const VERIFIED_HOTLINES: readonly VerifiedContact[] = [
  // Central Bank of Uzbekistan
  {
    number: "+998712000044",
    org: {
      ru: "Центральный банк Республики Узбекистан",
      uz: "O'zbekiston Respublikasi Markaziy banki",
      en: "Central Bank of the Republic of Uzbekistan",
    },
    category: "bank",
    description: {
      ru: "Горячая линия ЦБ — вопросы по вкладам и банковскому мошенничеству",
      uz: "MB ishonch telefoni — omonatlar va bank firibgarligi bo'yicha",
      en: "CBU hotline — deposits and banking fraud inquiries",
    },
    source: "https://cbu.uz/en/contacts/helpline/",
  },
  // Central Bank toll-free
  {
    number: "08002000044",
    org: {
      ru: "Центральный банк (бесплатный)",
      uz: "Markaziy bank (bepul)",
      en: "Central Bank (toll-free)",
    },
    category: "bank",
    description: {
      ru: "Бесплатная линия ЦБ с стационарных телефонов",
      uz: "Statsionar telefonlardan bepul MB liniyasi",
      en: "CBU toll-free line from landlines",
    },
    source: "https://cbu.uz/en/contacts/helpline/",
  },
  // Kapitalbank call-center
  {
    number: "1233",
    org: { ru: "Капиталбанк", uz: "Kapitalbank", en: "Kapitalbank" },
    category: "bank",
    description: {
      ru: "Колл-центр Капиталбанка — блокировка карт, мошенничество",
      uz: "Kapitalbank qo'ng'iroq markazi — kartani bloklash, firibgarlik",
      en: "Kapitalbank call center — card blocking, fraud",
    },
    source: "https://kapital24.uz/en/guide/bank-cards/ (hotline mentioned in CBU helpline page)",
  },
];

/**
 * All verified contacts combined for lookup.
 */
export const ALL_VERIFIED_CONTACTS: readonly VerifiedContact[] = [
  ...EMERGENCY_NUMBERS,
  ...VERIFIED_HOTLINES,
];

/**
 * Check if a normalized phone number (digits only, with or without +998 prefix)
 * matches a verified contact. Returns the contact if found, null otherwise.
 *
 * Matching logic:
 * - Short codes (3-4 digits): exact match
 * - Full numbers: strip +998 prefix and compare, or compare as-is
 */
export function findVerifiedContact(normalizedNumber: string): VerifiedContact | null {
  const digits = normalizedNumber.replace(/\D/g, "");

  for (const contact of ALL_VERIFIED_CONTACTS) {
    const contactDigits = contact.number.replace(/\D/g, "");

    // Exact match
    if (digits === contactDigits) return contact;

    // Match with/without country code
    if (digits.startsWith("998") && digits.slice(3) === contactDigits) return contact;
    if (contactDigits.startsWith("998") && contactDigits.slice(3) === digits) return contact;
  }

  return null;
}
