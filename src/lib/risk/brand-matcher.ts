// Brand Matcher — Core detection logic for brand impersonation in URLs and text
//
// Evaluates URLs and text against the Brand Registry to detect impersonation attempts.
// Returns structured BrandEvidence objects for downstream consumers.

import { BRAND_REGISTRY, NEWS_DOMAIN_WHITELIST, type BrandEntry } from "./brand-registry";
import { normalizeDomain, type NormalizedDomain } from "./domain-normalizer";
import type { ReasonCode } from "./rules";

/**
 * Structured evidence of a brand impersonation detection.
 */
export interface BrandEvidence {
  /** Unique brand identifier (e.g., "kapitalbank") */
  brandId: string;
  /** Canonical display name */
  brandName: string;
  /** The specific alias string that matched */
  matchedAlias: string;
  /** Where the brand was detected */
  matchedIn: "hostname" | "path" | "text";
  /** The domain that was checked */
  checkedDomain: string;
  /** Official domains for the impersonated brand */
  officialDomains: string[];
  /** Detection confidence level */
  confidence: "medium" | "high";
}

/**
 * Result of brand matching — may contain zero or more evidence items.
 */
export interface BrandMatchResult {
  detected: boolean;
  evidence: BrandEvidence[];
}

/**
 * Check if a hostname is an official domain or subdomain of a brand.
 *
 * Official means:
 * - Exact match with an official domain, OR
 * - Ends with "." + official domain (is a subdomain)
 *
 * A hostname that CONTAINS the official domain as substring but does NOT
 * end with it (e.g., kapitalbank.uz.evil.com) is NOT official.
 */
function isOfficialDomain(hostname: string, brand: BrandEntry): boolean {
  for (const official of brand.officialDomains) {
    if (hostname === official || hostname.endsWith("." + official)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a hostname belongs to a whitelisted news domain.
 */
function isNewsDomain(hostname: string): boolean {
  for (const news of NEWS_DOMAIN_WHITELIST) {
    if (hostname === news || hostname.endsWith("." + news)) {
      return true;
    }
  }
  return false;
}

/**
 * Split a hostname into segments by "." and "-" for matching.
 */
function getHostnameSegments(hostname: string): string[] {
  return hostname.split(/[.-]/).filter((s) => s.length > 0);
}

/**
 * Split a path into segments by word boundaries: "/", "-", ".", whitespace.
 */
function getPathSegments(path: string): string[] {
  return path.split(/[/.\s-]/).filter((s) => s.length > 0);
}

function hasNonAscii(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) > 0x7f);
}

/**
 * Determine confidence level based on whether the matched alias is
 * a canonical/exact brand name or a typosquat variant.
 *
 * The first alias in a brand's alias list is treated as the canonical name.
 * Additional aliases (index > 0) that differ from the brand id are typosquat variants.
 */
function getConfidence(brand: BrandEntry, matchedAlias: string): "high" | "medium" {
  // The canonical aliases are the first entry and the brand id itself
  // Typosquat variants are aliases that are intentional misspellings
  const canonicalAliases = getCanonicalAliases(brand);
  if (canonicalAliases.has(matchedAlias.toLowerCase())) {
    return "high";
  }
  return "medium";
}

/**
 * Get the set of canonical (non-typosquat) aliases for a brand.
 * These are: the brand id, and aliases that are exact transliterations
 * (first alias is always canonical, plus any Cyrillic transliterations).
 *
 * For simplicity: the first alias and any alias that matches the brand id
 * are canonical. All others are typosquat variants.
 */
function getCanonicalAliases(brand: BrandEntry): Set<string> {
  const canonical = new Set<string>();
  // The brand id is always canonical
  canonical.add(brand.id.toLowerCase());
  // First alias is always canonical
  if (brand.aliases.length > 0) {
    canonical.add(brand.aliases[0].toLowerCase());
  }
  // Cyrillic transliterations are canonical (not typosquats)
  // Heuristic: aliases containing non-ASCII chars are transliterations
  for (const alias of brand.aliases) {
    if (hasNonAscii(alias)) {
      canonical.add(alias.toLowerCase());
    }
  }
  // Multi-word brand aliases that combine known parts are canonical
  // e.g., "ipakyulibank", "humocard", "anorbank", "aloqabank"
  for (const alias of brand.aliases) {
    // If it contains the brand id as a substring, it's a canonical variant
    if (alias.toLowerCase().includes(brand.id.replace("-", "").toLowerCase())) {
      canonical.add(alias.toLowerCase());
    }
    // If the brand id contains the alias, it's canonical
    if (brand.id.replace("-", "").toLowerCase().includes(alias.toLowerCase())) {
      canonical.add(alias.toLowerCase());
    }
  }
  return canonical;
}

/**
 * Evaluate a URL for brand impersonation.
 *
 * Logic:
 * 1. For each brand in the registry:
 *    a. Check if the hostname is an official domain → skip (legitimate)
 *    b. Check if any brand alias appears as a segment in the hostname
 *    c. Check if any brand alias appears as a segment in the path
 *    d. For generic brands: only match if alias is an exact segment
 * 2. If match found on non-official domain → build Evidence Object
 *
 * @param normalizedUrl - Pre-normalized domain (from normalizeDomain())
 * @param rawHostname - The original hostname for the checkedDomain field
 */
export function matchBrandInUrl(
  normalizedUrl: NormalizedDomain,
  rawHostname: string,
): BrandMatchResult {
  const evidence: BrandEvidence[] = [];
  const { hostname, path } = normalizedUrl;

  const hostnameSegments = getHostnameSegments(hostname);
  const pathSegments = getPathSegments(path);

  for (const brand of BRAND_REGISTRY) {
    // Skip if this is an official domain or subdomain
    if (isOfficialDomain(hostname, brand)) {
      continue;
    }

    let matched = false;
    let matchedAlias = "";
    let matchedIn: "hostname" | "path" = "hostname";

    // Check hostname segments for brand aliases
    for (const alias of brand.aliases) {
      const aliasLower = alias.toLowerCase();

      if (brand.isGenericName) {
        // Generic brands: require exact segment match in hostname
        if (hostnameSegments.some((seg) => seg === aliasLower)) {
          matched = true;
          matchedAlias = alias;
          matchedIn = "hostname";
          break;
        }
      } else {
        // Non-generic brands: check if alias appears as an exact segment
        // Word boundary detection: alias must be an exact segment (split by . and -)
        if (hostnameSegments.some((seg) => seg === aliasLower)) {
          matched = true;
          matchedAlias = alias;
          matchedIn = "hostname";
          break;
        }
      }
    }

    // If not found in hostname, check path segments
    if (!matched) {
      // News domain whitelist: suppress path-only matches on news sites
      if (isNewsDomain(hostname)) {
        continue;
      }

      for (const alias of brand.aliases) {
        const aliasLower = alias.toLowerCase();

        if (brand.isGenericName) {
          // Generic brands in path: require exact segment match
          if (pathSegments.some((seg) => seg === aliasLower)) {
            matched = true;
            matchedAlias = alias;
            matchedIn = "path";
            break;
          }
        } else {
          // Non-generic brands in path: word boundary detection
          // Alias must appear as an exact segment (split by /, -, ., whitespace)
          if (pathSegments.some((seg) => seg === aliasLower)) {
            matched = true;
            matchedAlias = alias;
            matchedIn = "path";
            break;
          }
        }
      }
    }

    if (matched) {
      evidence.push({
        brandId: brand.id,
        brandName: brand.name.en,
        matchedAlias,
        matchedIn,
        checkedDomain: rawHostname,
        officialDomains: [...brand.officialDomains],
        confidence: getConfidence(brand, matchedAlias),
      });
    }
  }

  return {
    detected: evidence.length > 0,
    evidence,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * High-risk reason codes that, when present alongside a brand mention in text,
 * indicate a suspicious/deceptive context (not mere discussion).
 */
const HIGH_RISK_CODES: readonly ReasonCode[] = [
  "asks_for_otp",
  "asks_for_card_cvv",
  "asks_for_pin",
  "asks_for_sms_code",
  "asks_to_install_apk",
];

/**
 * Keywords that indicate a payment/card/OTP/login/verify context,
 * required for generic brand names (Click, Payme) to trigger detection.
 *
 * Note: Uses two patterns because \b doesn't work with Cyrillic in JS regex.
 */
const SUSPICIOUS_KEYWORDS_LATIN_REGEX =
  /\b(payment|pay|card|karta|otp|pin|cvv|cvc|login|verify|verification|code|sms|transfer|balance)\b/i;

const SUSPICIOUS_KEYWORDS_CYRILLIC_REGEX =
  /(карт[аыуеой]|одноразов|пароль|пин|логин|войти|подтвердит|код|смс|перевод|баланс|пополн|счёт|счет|кошел[её]к)/i;

const SUSPICIOUS_KEYWORDS_UZ_REGEX =
  /(kirish|tasdiql|o[''\u2019]tkazma|balans|to[''\u2019]ld|hisob|hamyon)/i;

function hasSuspiciousKeywords(text: string): boolean {
  return (
    SUSPICIOUS_KEYWORDS_LATIN_REGEX.test(text) ||
    SUSPICIOUS_KEYWORDS_CYRILLIC_REGEX.test(text) ||
    SUSPICIOUS_KEYWORDS_UZ_REGEX.test(text)
  );
}

/**
 * Simple URL regex to extract URLs from text.
 * Matches http:// or https:// followed by non-whitespace characters.
 */
const URL_IN_TEXT_REGEX = /https?:\/\/[^\s<>"']+/gi;

/**
 * Check if a brand alias appears in text with word boundary detection.
 * Returns the matched alias or null.
 */
function findBrandMentionInText(text: string, brand: BrandEntry): string | null {
  const textLower = text.toLowerCase();

  for (const alias of brand.aliases) {
    const aliasLower = alias.toLowerCase();

    if (brand.isGenericName) {
      // For generic brands, use strict word boundary matching.
      // Must NOT match common phrases like "click here" or "pay me".
      // We require the alias to appear as an exact token with word boundaries
      // AND check for false positive patterns.
      const boundaryRegex = new RegExp(`\\b${escapeRegex(aliasLower)}\\b`, "i");
      if (boundaryRegex.test(text)) {
        // Check for false positive patterns for generic brands
        if (isGenericFalsePositive(text, aliasLower)) {
          continue;
        }
        return alias;
      }
    } else {
      // Non-generic brands: word boundary detection
      const boundaryRegex = new RegExp(`\\b${escapeRegex(aliasLower)}\\b`, "i");
      if (boundaryRegex.test(text)) {
        return alias;
      }
    }
  }

  return null;
}

/**
 * Check if a generic brand mention is a false positive (common phrase usage).
 *
 * "click here", "click this link", "click on" → false positive for Click brand
 * "pay me", "pay me later", "pay me back" → false positive for Payme brand
 */
function isGenericFalsePositive(text: string, aliasLower: string): boolean {
  const textLower = text.toLowerCase();

  if (aliasLower === "click") {
    // "click" followed by common action words = just an English word
    if (
      /\bclick\s+(here|this|that|on|the|it|below|above|now|to|for|and|a|link|button|url)/i.test(
        text,
      )
    ) {
      return true;
    }
    // "click" preceded by verbs like "please", "just", "don't"
    if (/\b(please|just|don['']?t|simply|to)\s+click\b/i.test(text)) {
      return true;
    }
    // Standalone "click" without any payment/card/otp context is a false positive
    // Only trigger if there's suspicious keyword context
    if (!hasSuspiciousKeywords(text)) {
      return true;
    }
  }

  if (aliasLower === "payme") {
    // "pay me" as two separate words = just English phrase
    if (/\bpay\s+me\b/i.test(text)) {
      return true;
    }
    // "payme" without suspicious context for a generic brand
    if (!hasSuspiciousKeywords(text)) {
      return true;
    }
  }

  // Cyrillic aliases for generic brands (клик, пэйми) — suppress without suspicious keywords
  if ((aliasLower === "клик" || aliasLower === "пэйми") && !hasSuspiciousKeywords(text)) {
    return true;
  }

  return false;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract URLs from text and check if any belong to a brand's official domains.
 * Returns true if at least one URL in the text is NOT an official domain of the brand.
 */
function hasNonOfficialUrl(urls: string[], brand: BrandEntry): boolean {
  for (const url of urls) {
    const normalized = normalizeDomain(url);
    if (!isOfficialDomain(normalized.hostname, brand)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if any of the provided reason codes are high-risk codes
 * that indicate a suspicious/deceptive context.
 */
function hasHighRiskCodes(otherReasonCodes: ReasonCode[]): boolean {
  return otherReasonCodes.some((code) => HIGH_RISK_CODES.includes(code));
}

/**
 * Evaluate text for brand impersonation.
 *
 * Logic:
 * 1. Scan text for brand name mentions (word boundary detection)
 * 2. Extract URLs from text
 * 3. For NON-generic brands: emit if brand mentioned AND:
 *    - A URL is present that doesn't belong to the brand's official domains, OR
 *    - Other high-risk reason codes are present
 * 4. For GENERIC brands: require accompanying payment/card/OTP/login/verify keywords
 *    or URL context to trigger
 * 5. If brand mentioned without URLs or risk signals → no detection
 *
 * @param text - The raw text content to analyze
 * @param urls - URLs already extracted from the text (passed by caller)
 * @param otherReasonCodes - Other reason codes already detected for this input
 */
export function matchBrandInText(
  text: string,
  urls: string[],
  otherReasonCodes: ReasonCode[],
): BrandMatchResult {
  const evidence: BrandEvidence[] = [];

  // Also extract URLs directly from the text (in case caller didn't pass all)
  const extractedUrls = text.match(URL_IN_TEXT_REGEX) ?? [];
  const allUrls = [...new Set([...urls, ...extractedUrls])];

  for (const brand of BRAND_REGISTRY) {
    // Check if brand is mentioned in text
    const matchedAlias = findBrandMentionInText(text, brand);
    if (!matchedAlias) continue;

    // Brand is mentioned — now determine if this is a suspicious context

    if (brand.isGenericName) {
      // Generic brands: need URL context or suspicious keywords
      // findBrandMentionInText already filters out false positives for generic brands
      // (it returns null if suspicious keywords are not present and it's generic)
      // So if we get here, either suspicious keywords are present OR we have URL context

      if (allUrls.length > 0 && hasNonOfficialUrl(allUrls, brand)) {
        // Generic brand + non-official URL → detect
        evidence.push({
          brandId: brand.id,
          brandName: brand.name.en,
          matchedAlias,
          matchedIn: "text",
          checkedDomain: allUrls[0],
          officialDomains: [...brand.officialDomains],
          confidence: getConfidence(brand, matchedAlias),
        });
      } else if (
        hasSuspiciousKeywords(text) &&
        (allUrls.length > 0 || hasHighRiskCodes(otherReasonCodes))
      ) {
        // Generic brand + suspicious keywords + (URL or high-risk codes) → detect
        evidence.push({
          brandId: brand.id,
          brandName: brand.name.en,
          matchedAlias,
          matchedIn: "text",
          checkedDomain: allUrls.length > 0 ? allUrls[0] : "",
          officialDomains: [...brand.officialDomains],
          confidence: getConfidence(brand, matchedAlias),
        });
      }
      // Otherwise: generic brand in normal text without URL/keywords → no detection
    } else {
      // Non-generic brands: emit if URL present (non-official) OR high-risk codes present
      if (allUrls.length > 0 && hasNonOfficialUrl(allUrls, brand)) {
        // Brand + non-official URL → detect
        evidence.push({
          brandId: brand.id,
          brandName: brand.name.en,
          matchedAlias,
          matchedIn: "text",
          checkedDomain: allUrls[0],
          officialDomains: [...brand.officialDomains],
          confidence: getConfidence(brand, matchedAlias),
        });
      } else if (hasHighRiskCodes(otherReasonCodes)) {
        // Brand + high-risk codes (asks_for_otp, etc.) → detect
        evidence.push({
          brandId: brand.id,
          brandName: brand.name.en,
          matchedAlias,
          matchedIn: "text",
          checkedDomain: "",
          officialDomains: [...brand.officialDomains],
          confidence: getConfidence(brand, matchedAlias),
        });
      }
      // Otherwise: brand in plain text without URLs or risk signals → no detection
    }
  }

  return {
    detected: evidence.length > 0,
    evidence,
  };
}
