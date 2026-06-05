// Brand Registry — Structured dictionary of protected brands for impersonation detection
//
// DESIGN: Each brand entry stores canonical names, official domains, known aliases
// (transliterations + typosquat variants), and metadata. Organization names are
// consistent with verified-contacts.ts per Requirement 7.1.

export type OrgCategory = "bank" | "payment_system" | "telecom" | "government";

export interface BrandEntry {
  /** Unique brand identifier (e.g., "kapitalbank", "payme") */
  id: string;
  /** Canonical display name in three languages */
  name: { ru: string; uz: string; en: string };
  /** Organization category */
  category: OrgCategory;
  /** Official domains (at least one required) */
  officialDomains: string[];
  /**
   * All known name variants: canonical, transliterations, common typosquats.
   * Stored lowercase for matching.
   */
  aliases: string[];
  /** Whether this brand has a generic name requiring stricter matching */
  isGenericName: boolean;
}

/**
 * The authoritative Brand Registry containing all protected brands.
 * Brands are referenced consistently with the Verified Contacts module.
 */
export const BRAND_REGISTRY: readonly BrandEntry[] = [
  // ─── Banks ──────────────────────────────────────────────────────────────
  {
    id: "kapitalbank",
    name: { ru: "Капиталбанк", uz: "Kapitalbank", en: "Kapitalbank" },
    category: "bank",
    officialDomains: ["kapitalbank.uz"],
    aliases: ["kapitalbank", "капиталбанк", "kapitolbank", "kapitalbenk", "kapitalbnk"],
    isGenericName: false,
  },
  {
    id: "nbu",
    name: {
      ru: "Национальный банк Узбекистана",
      uz: "O'zbekiston Milliy banki",
      en: "National Bank of Uzbekistan",
    },
    category: "bank",
    officialDomains: ["nbu.uz"],
    aliases: ["nbu", "milliybank", "национальныйбанк"],
    isGenericName: false,
  },
  {
    id: "ipak-yuli",
    name: { ru: "Ипак Йули Банк", uz: "Ipak Yo'li Banki", en: "Ipak Yuli Bank" },
    category: "bank",
    officialDomains: ["ipakyulibank.uz"],
    aliases: ["ipakyuli", "ipak-yuli", "ipakyulibank", "ипакйули"],
    isGenericName: false,
  },
  {
    id: "anorbank",
    name: { ru: "АНОР Банк", uz: "ANOR Bank", en: "ANOR Bank" },
    category: "bank",
    officialDomains: ["anorbank.uz"],
    aliases: ["anorbank", "anor", "анорбанк"],
    isGenericName: false,
  },
  {
    id: "aloqabank",
    name: { ru: "Алокабанк", uz: "Aloqabank", en: "Aloqabank" },
    category: "bank",
    officialDomains: ["aloqabank.uz"],
    aliases: ["aloqabank", "aloqa", "алокабанк"],
    isGenericName: false,
  },

  // ─── Payment Systems ────────────────────────────────────────────────────
  {
    id: "uzcard",
    name: { ru: "UZCARD", uz: "UZCARD", en: "UZCARD" },
    category: "payment_system",
    officialDomains: ["uzcard.uz"],
    aliases: ["uzcard", "юзкард"],
    isGenericName: false,
  },
  {
    id: "humo",
    name: { ru: "HUMO", uz: "HUMO", en: "HUMO" },
    category: "payment_system",
    officialDomains: ["humocard.uz"],
    aliases: ["humo", "humocard", "хумо"],
    isGenericName: false,
  },
  {
    id: "payme",
    name: { ru: "Payme", uz: "Payme", en: "Payme" },
    category: "payment_system",
    officialDomains: ["payme.uz"],
    aliases: ["payme", "пэйми"],
    isGenericName: true, // "pay me" is a common English phrase
  },
  {
    id: "click",
    name: { ru: "Click", uz: "Click", en: "Click" },
    category: "payment_system",
    officialDomains: ["click.uz"],
    aliases: ["click", "клик"],
    isGenericName: true, // "click" is a common English word
  },

  // ─── Telecom Operators ──────────────────────────────────────────────────
  {
    id: "ucell",
    name: { ru: "Ucell", uz: "Ucell", en: "Ucell" },
    category: "telecom",
    officialDomains: ["ucell.uz"],
    aliases: ["ucell", "юсел", "юселл"],
    isGenericName: false,
  },
  {
    id: "beeline-uz",
    name: { ru: "Beeline Uzbekistan", uz: "Beeline Uzbekistan", en: "Beeline Uzbekistan" },
    category: "telecom",
    officialDomains: ["beeline.uz"],
    aliases: ["beeline", "билайн"],
    isGenericName: false,
  },
  {
    id: "mobiuz",
    name: { ru: "Mobiuz", uz: "Mobiuz", en: "Mobiuz" },
    category: "telecom",
    officialDomains: ["mobiuz.uz"],
    aliases: ["mobiuz", "uzmobile", "мобиуз"],
    isGenericName: false,
  },

  // ─── Government Bodies ──────────────────────────────────────────────────
  {
    id: "mvd",
    name: { ru: "МВД Узбекистана", uz: "O'zbekiston IIV", en: "Ministry of Internal Affairs" },
    category: "government",
    officialDomains: ["iiv.uz"],
    aliases: ["mvd", "мвд", "iiv"],
    isGenericName: false,
  },
  {
    id: "tax-authority",
    name: { ru: "Налоговый комитет", uz: "Soliq qo'mitasi", en: "Tax Authority" },
    category: "government",
    officialDomains: ["soliq.uz"],
    aliases: ["soliq", "налоговая", "солик"],
    isGenericName: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// NEWS DOMAIN WHITELIST — known media sites where brand mentions in paths
// are legitimate editorial content, not impersonation attempts.
// ═══════════════════════════════════════════════════════════════════════════

export const NEWS_DOMAIN_WHITELIST: readonly string[] = [
  "gazeta.uz",
  "spot.uz",
  "kun.uz",
  "daryo.uz",
  "podrobno.uz",
  "kommersant.uz",
  "review.uz",
  "nuz.uz",
];

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

/** Pre-built index mapping lowercase alias → BrandEntry for O(1) lookup */
const aliasIndex: Map<string, BrandEntry> = new Map();
for (const brand of BRAND_REGISTRY) {
  for (const alias of brand.aliases) {
    aliasIndex.set(alias.toLowerCase(), brand);
  }
}

/**
 * Find a brand entry by one of its aliases (case-insensitive).
 * Returns the matching BrandEntry or null if no brand matches.
 */
export function findBrandByAlias(alias: string): BrandEntry | null {
  return aliasIndex.get(alias.toLowerCase()) ?? null;
}
