// Brand Formatter — Produces trilingual user-facing explanations for brand impersonation detections
//
// Given a BrandEvidence object (or array), renders a human-readable explanation
// naming the impersonated brand and its official domain in the user's language.

import type { BrandEvidence } from "./brand-matcher";
import { BRAND_REGISTRY, type BrandEntry } from "./brand-registry";
import type { Lang } from "../i18n";

/**
 * Templates for the brand impersonation explanation in each supported language.
 */
const TEMPLATES: Record<Lang, (brandName: string, officialDomain: string) => string> = {
  ru: (brandName, officialDomain) =>
    `Похоже на имитацию ${brandName}. Ссылка использует название бренда, но домен не совпадает с официальным. Официальный сайт: ${officialDomain}`,
  uz: (brandName, officialDomain) =>
    `${brandName} ga o'xshash taqlid aniqlandi. Havola brend nomini ishlatadi, lekin domen rasmiy domenga mos kelmaydi. Rasmiy sayt: ${officialDomain}`,
  en: (brandName, officialDomain) =>
    `Possible ${brandName} impersonation detected. The link uses the brand name, but the domain does not match the official one. Official site: ${officialDomain}`,
};

/**
 * Templates for appending a verified callback number.
 */
const CALLBACK_TEMPLATES: Record<Lang, (number: string) => string> = {
  ru: (number) => `Номер для проверки: ${number}`,
  uz: (number) => `Tekshirish uchun raqam: ${number}`,
  en: (number) => `Verification number: ${number}`,
};

/**
 * Look up the BrandEntry from the registry by brandId.
 * Falls back to null if not found (should not happen with valid evidence).
 */
function findBrandById(brandId: string): BrandEntry | null {
  return BRAND_REGISTRY.find((b) => b.id === brandId) ?? null;
}

/**
 * Get the localized display name for a brand.
 * Falls back to the English name from evidence if the brand is not found in the registry.
 */
function getLocalizedBrandName(evidence: BrandEvidence, lang: Lang): string {
  const brand = findBrandById(evidence.brandId);
  if (brand) {
    return brand.name[lang];
  }
  // Fallback: use the brandName from evidence (English canonical)
  return evidence.brandName;
}

/**
 * Format a single brand impersonation explanation for the given evidence and language.
 *
 * @param evidence - Structured evidence from the Brand Matcher
 * @param lang - User's selected language (ru, uz, en)
 * @param verifiedCallbackNumber - Optional verified phone number for the brand
 * @returns A formatted explanation string in the user's language
 */
export function formatBrandImpersonationExplanation(
  evidence: BrandEvidence,
  lang: Lang,
  verifiedCallbackNumber?: string,
): string {
  const brandName = getLocalizedBrandName(evidence, lang);
  const officialDomain = evidence.officialDomains[0] ?? "";

  let explanation = TEMPLATES[lang](brandName, officialDomain);

  if (verifiedCallbackNumber) {
    explanation += "\n" + CALLBACK_TEMPLATES[lang](verifiedCallbackNumber);
  }

  return explanation;
}

/**
 * Format explanations for multiple brand evidence items.
 * Produces one explanation string per detected brand.
 *
 * @param evidenceList - Array of BrandEvidence objects from detection
 * @param lang - User's selected language
 * @param verifiedCallbackNumber - Optional verified phone number (applied to all)
 * @returns Array of formatted explanation strings, one per brand
 */
export function formatBrandImpersonationExplanations(
  evidenceList: BrandEvidence[],
  lang: Lang,
  verifiedCallbackNumber?: string,
): string[] {
  return evidenceList.map((evidence) =>
    formatBrandImpersonationExplanation(evidence, lang, verifiedCallbackNumber),
  );
}
