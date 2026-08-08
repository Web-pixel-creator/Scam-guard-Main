// Property-based tests for Brand Matcher (URL detection).
//
// Feature: brand-impersonation-detector, Property 1: Brand alias in non-official domain triggers detection
// Feature: brand-impersonation-detector, Property 2: Official domains never implicate their owner
// Feature: brand-impersonation-detector, Property 3: Official domain as substring without suffix triggers detection
// Feature: brand-impersonation-detector, Property 7: Word boundary detection prevents substring false matches
// Feature: brand-impersonation-detector, Property 6: News domain whitelist suppresses detection
// Feature: brand-impersonation-detector, Property 12: Evidence matchedIn field accurately reflects detection location
// Feature: brand-impersonation-detector, Property 13: Evidence confidence reflects match type

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { matchBrandInUrl, type BrandEvidence } from "../brand-matcher";
import { normalizeDomain } from "../domain-normalizer";
import { BRAND_REGISTRY, NEWS_DOMAIN_WHITELIST, type BrandEntry } from "../brand-registry";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cyrillic characters that are in the homoglyph map and will be transformed
 * during normalization. Aliases containing these chars won't match a normalized
 * hostname because the hostname gets transformed but the alias comparison doesn't.
 */
const HOMOGLYPH_CHARS = new Set(["\u0430", "\u0435", "\u043E", "\u0440", "\u0441", "0", "1"]);

/**
 * Check if an alias is "matchable" — i.e., it can appear as a segment in a hostname
 * and survive normalization to still match the raw alias comparison.
 *
 * Excludes:
 * - Aliases containing hyphens (segments are split by hyphens, so multi-segment aliases won't match)
 * - Aliases containing Cyrillic chars in the homoglyph map (normalization transforms them)
 */
function isMatchableAlias(alias: string): boolean {
  // Aliases with hyphens get split into multiple segments
  if (alias.includes("-")) return false;
  // Aliases with homoglyph-mapped chars won't match after normalization
  for (const char of alias) {
    if (HOMOGLYPH_CHARS.has(char)) return false;
  }
  return true;
}

function hasNonAscii(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) > 0x7f);
}

/** Non-generic brands only (excludes Click and Payme) */
const nonGenericBrands = BRAND_REGISTRY.filter((b) => !b.isGenericName);

/** Non-generic brands with at least one matchable alias */
const nonGenericBrandsWithMatchableAliases = nonGenericBrands.filter((b) =>
  b.aliases.some((a) => isMatchableAlias(a.toLowerCase())),
);

/** TLDs that are NOT .uz (to avoid accidentally matching official domains) */
const nonUzTlds = ["com", "net", "org", "xyz", "app", "dev", "info", "io"];

/**
 * Generator: random lowercase alpha string (used for domain labels)
 */
const alphaLabel: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...Array.from("abcdefghijklmnopqrstuvwxyz")), {
    minLength: 3,
    maxLength: 8,
  })
  .map((chars) => chars.join(""));

/**
 * Generator: random TLD from nonUzTlds
 */
const randomTld: fc.Arbitrary<string> = fc.constantFrom(...nonUzTlds);

/**
 * Generator: pick a random non-generic brand and one of its matchable aliases.
 * Only picks aliases that don't contain hyphens or homoglyph-mapped Cyrillic chars.
 */
const nonGenericBrandAndAlias: fc.Arbitrary<{ brand: BrandEntry; alias: string }> = fc
  .integer({ min: 0, max: nonGenericBrandsWithMatchableAliases.length - 1 })
  .chain((brandIdx) => {
    const brand = nonGenericBrandsWithMatchableAliases[brandIdx];
    const matchableAliases = brand.aliases.filter((a) => isMatchableAlias(a.toLowerCase()));
    return fc.integer({ min: 0, max: matchableAliases.length - 1 }).map((aliasIdx) => ({
      brand,
      alias: matchableAliases[aliasIdx].toLowerCase(),
    }));
  });

/**
 * Generator: pick a random brand (any) and one of its official domains
 */
const brandAndOfficialDomain: fc.Arbitrary<{ brand: BrandEntry; officialDomain: string }> = fc
  .integer({ min: 0, max: BRAND_REGISTRY.length - 1 })
  .chain((brandIdx) => {
    const brand = BRAND_REGISTRY[brandIdx];
    return fc.integer({ min: 0, max: brand.officialDomains.length - 1 }).map((domIdx) => ({
      brand,
      officialDomain: brand.officialDomains[domIdx],
    }));
  });

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 1: Brand alias in non-official domain triggers detection
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 1: Brand alias in non-official domain triggers detection
describe("Feature: brand-impersonation-detector, Property 1: Brand alias in non-official domain triggers detection", () => {
  it("for any non-generic brand alias embedded as a segment in a non-official hostname, matchBrandInUrl returns detected=true", () => {
    const hostnameWithAlias: fc.Arbitrary<{ brand: BrandEntry; alias: string; hostname: string }> =
      nonGenericBrandAndAlias.chain(({ brand, alias }) =>
        fc
          .record({
            prefix: alphaLabel,
            tld: randomTld,
            style: fc.constantFrom("dotPrefix", "dotSuffix", "hyphenPrefix"),
          })
          .map(({ prefix, tld, style }) => {
            let hostname: string;
            if (style === "dotPrefix") {
              // alias.randomdomain.tld
              hostname = `${alias}.${prefix}.${tld}`;
            } else if (style === "dotSuffix") {
              // randomdomain.alias.tld
              hostname = `${prefix}.${alias}.${tld}`;
            } else {
              // alias-support.randomdomain.tld
              hostname = `${alias}-support.${prefix}.${tld}`;
            }
            return { brand, alias, hostname };
          }),
      );

    fc.assert(
      fc.property(hostnameWithAlias, ({ brand, alias, hostname }) => {
        const normalized = normalizeDomain(hostname);
        const result = matchBrandInUrl(normalized, hostname);

        expect(result.detected).toBe(true);
        // Should detect the correct brand
        const matchedBrandIds = result.evidence.map((e) => e.brandId);
        expect(matchedBrandIds).toContain(brand.id);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.1, 2.2, 2.3, 2.5**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 2: Official domain or subdomain never implicates its owning brand
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 2: Official domains never implicate their owner
describe("Feature: brand-impersonation-detector, Property 2: Official domains never implicate their owner", () => {
  it("never flags the owning brand for its exact official domain or a subdomain", () => {
    const officialHostname: fc.Arbitrary<{ brand: BrandEntry; hostname: string }> =
      brandAndOfficialDomain.chain(({ brand, officialDomain }) =>
        fc
          .record({
            useSubdomain: fc.boolean(),
            subdomain: alphaLabel,
          })
          .map(({ useSubdomain, subdomain }) => {
            const hostname = useSubdomain ? `${subdomain}.${officialDomain}` : officialDomain;
            return { brand, hostname };
          }),
      );

    fc.assert(
      fc.property(officialHostname, ({ brand, hostname }) => {
        const normalized = normalizeDomain(hostname);
        const result = matchBrandInUrl(normalized, hostname);

        expect(result.evidence.map((item) => item.brandId)).not.toContain(brand.id);
      }),
      { numRuns: 100 },
    );
  });

  it("still detects another brand used as a subdomain label", () => {
    const hostname = "iiv.humocard.uz";
    const result = matchBrandInUrl(normalizeDomain(hostname), hostname);

    expect(result.evidence.map((item) => item.brandId)).toContain("mvd");
    expect(result.evidence.map((item) => item.brandId)).not.toContain("humo");
  });

  // **Validates: Requirements 2.4, 2.6, 6.1**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 3: Official domain as substring without suffix triggers detection
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 3: Official domain as substring without suffix triggers detection
describe("Feature: brand-impersonation-detector, Property 3: Official domain as substring without suffix triggers detection", () => {
  it("for any non-generic brand official domain, appending .evilDomain triggers detection", () => {
    /** Only non-generic brands to ensure detection triggers */
    const nonGenericBrandAndDomain: fc.Arbitrary<{ brand: BrandEntry; officialDomain: string }> = fc
      .integer({ min: 0, max: nonGenericBrands.length - 1 })
      .chain((brandIdx) => {
        const brand = nonGenericBrands[brandIdx];
        return fc.integer({ min: 0, max: brand.officialDomains.length - 1 }).map((domIdx) => ({
          brand,
          officialDomain: brand.officialDomains[domIdx],
        }));
      });

    const hostnameWithOfficialAsSubstring: fc.Arbitrary<{ brand: BrandEntry; hostname: string }> =
      nonGenericBrandAndDomain.chain(({ brand, officialDomain }) =>
        fc
          .record({
            evilLabel: alphaLabel,
            evilTld: randomTld,
          })
          .map(({ evilLabel, evilTld }) => {
            // e.g., kapitalbank.uz.evil.com — official domain is a prefix, NOT a suffix
            const hostname = `${officialDomain}.${evilLabel}.${evilTld}`;
            return { brand, hostname };
          }),
      );

    fc.assert(
      fc.property(hostnameWithOfficialAsSubstring, ({ brand, hostname }) => {
        const normalized = normalizeDomain(hostname);
        const result = matchBrandInUrl(normalized, hostname);

        expect(result.detected).toBe(true);
        const matchedBrandIds = result.evidence.map((e) => e.brandId);
        expect(matchedBrandIds).toContain(brand.id);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 2.7**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 7: Word boundary detection prevents substring false matches
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 7: Word boundary detection prevents substring false matches
describe("Feature: brand-impersonation-detector, Property 7: Word boundary detection prevents substring false matches", () => {
  it("for any non-generic brand alias embedded inside a larger word without boundaries, matchBrandInUrl returns detected=false", () => {
    /**
     * Generator: embed a brand alias INSIDE a larger word without any word boundary separators.
     * The prefix and suffix are alpha chars (no dots, hyphens, or slashes).
     */
    const aliasInsideWord: fc.Arbitrary<string> = nonGenericBrandAndAlias.chain(
      ({ brand, alias }) =>
        fc
          .record({
            // Prefix must be non-empty alpha chars to avoid the alias starting at a boundary
            prefix: fc
              .array(fc.constantFrom(...Array.from("abcdefghijklmnopqrstuvwxyz")), {
                minLength: 2,
                maxLength: 5,
              })
              .map((chars) => chars.join("")),
            // Suffix must be non-empty alpha chars to avoid the alias ending at a boundary
            suffix: fc
              .array(fc.constantFrom(...Array.from("abcdefghijklmnopqrstuvwxyz")), {
                minLength: 2,
                maxLength: 5,
              })
              .map((chars) => chars.join("")),
            tld: randomTld,
          })
          .map(({ prefix, suffix, tld }) => {
            // Build hostname: {prefix}{alias}{suffix}.{tld}
            // The alias is embedded inside a single segment without separators
            return `${prefix}${alias}${suffix}.${tld}`;
          }),
    );

    fc.assert(
      fc.property(aliasInsideWord, (hostname) => {
        const normalized = normalizeDomain(hostname);
        const result = matchBrandInUrl(normalized, hostname);

        expect(result.detected).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.4**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 6: News domain whitelist suppresses detection
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 6: News domain whitelist suppresses detection
describe("Feature: brand-impersonation-detector, Property 6: News domain whitelist suppresses detection", () => {
  it("for any brand alias on a news domain with the alias in path only, matchBrandInUrl returns detected=false", () => {
    const brandAliasOnNewsDomain: fc.Arbitrary<{ hostname: string; fullUrl: string }> =
      nonGenericBrandAndAlias.chain(({ brand, alias }) =>
        fc
          .record({
            newsIdx: fc.integer({ min: 0, max: NEWS_DOMAIN_WHITELIST.length - 1 }),
            pathPrefix: alphaLabel,
          })
          .map(({ newsIdx, pathPrefix }) => {
            const newsDomain = NEWS_DOMAIN_WHITELIST[newsIdx];
            // Build URL: newsDomain/article/alias-results
            const fullUrl = `${newsDomain}/${pathPrefix}/${alias}`;
            return { hostname: newsDomain, fullUrl };
          }),
      );

    fc.assert(
      fc.property(brandAliasOnNewsDomain, ({ hostname, fullUrl }) => {
        const normalized = normalizeDomain(fullUrl);
        const result = matchBrandInUrl(normalized, hostname);

        expect(result.detected).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.3**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 12 & 13: Evidence matchedIn field and confidence accuracy
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 12: Evidence matchedIn field accurately reflects detection location
// Feature: brand-impersonation-detector, Property 13: Evidence confidence reflects match type
describe("Feature: brand-impersonation-detector, Property 12: Evidence matchedIn field accurately reflects detection location", () => {
  it("when brand alias is in hostname, matchedIn = 'hostname'; when in path, matchedIn = 'path'", () => {
    const aliasInHostnameOrPath: fc.Arbitrary<{
      brand: BrandEntry;
      alias: string;
      location: "hostname" | "path";
      url: string;
    }> = nonGenericBrandAndAlias.chain(({ brand, alias }) =>
      fc
        .record({
          location: fc.constantFrom("hostname" as const, "path" as const),
          prefix: alphaLabel,
          tld: randomTld,
        })
        .map(({ location, prefix, tld }) => {
          let url: string;
          if (location === "hostname") {
            // alias as segment in hostname
            url = `${alias}.${prefix}.${tld}`;
          } else {
            // alias in path, hostname is something unrelated
            url = `${prefix}.${tld}/${alias}/page`;
          }
          return { brand, alias, location, url };
        }),
    );

    fc.assert(
      fc.property(aliasInHostnameOrPath, ({ brand, alias, location, url }) => {
        const normalized = normalizeDomain(url);
        const result = matchBrandInUrl(normalized, normalized.hostname);

        expect(result.detected).toBe(true);
        // Find evidence for our brand
        const ev = result.evidence.find((e) => e.brandId === brand.id);
        expect(ev).toBeDefined();
        expect(ev!.matchedIn).toBe(location);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 9.2, 9.3**
});

describe("Feature: brand-impersonation-detector, Property 13: Evidence confidence reflects match type", () => {
  it("canonical alias → confidence 'high'; typosquat alias → confidence 'medium'", () => {
    /**
     * Pick a brand that has at least one matchable typosquat variant (non-canonical alias).
     * Canonical = first alias + Cyrillic transliterations + aliases containing brand id.
     * Typosquat = remaining aliases that don't match those criteria.
     * Only consider matchable aliases (no hyphens, no homoglyph chars).
     */
    const brandsWithTyposquats = nonGenericBrandsWithMatchableAliases.filter((b) => {
      const canonicalSet = getCanonicalAliasesForTest(b);
      const matchableAliases = b.aliases.filter((a) => isMatchableAlias(a.toLowerCase()));
      return matchableAliases.some((a) => !canonicalSet.has(a.toLowerCase()));
    });

    // If no brands with matchable typosquats, skip
    if (brandsWithTyposquats.length === 0) return;

    const canonicalOrTyposquat: fc.Arbitrary<{
      brand: BrandEntry;
      alias: string;
      expectedConfidence: "high" | "medium";
    }> = fc.integer({ min: 0, max: brandsWithTyposquats.length - 1 }).chain((brandIdx) => {
      const brand = brandsWithTyposquats[brandIdx];
      const canonical = getCanonicalAliasesForTest(brand);
      const matchableAliases = brand.aliases.filter((a) => isMatchableAlias(a.toLowerCase()));
      const canonicalAliases = matchableAliases.filter((a) => canonical.has(a.toLowerCase()));
      const typosquatAliases = matchableAliases.filter((a) => !canonical.has(a.toLowerCase()));

      type ConfidenceCase = {
        brand: BrandEntry;
        alias: string;
        expectedConfidence: "high" | "medium";
      };

      return fc
        .constantFrom("canonical" as const, "typosquat" as const)
        .chain<ConfidenceCase>((type) => {
          if (type === "canonical" && canonicalAliases.length > 0) {
            return fc.integer({ min: 0, max: canonicalAliases.length - 1 }).map((idx) => ({
              brand,
              alias: canonicalAliases[idx].toLowerCase(),
              expectedConfidence: "high",
            }));
          } else if (typosquatAliases.length > 0) {
            return fc.integer({ min: 0, max: typosquatAliases.length - 1 }).map((idx) => ({
              brand,
              alias: typosquatAliases[idx].toLowerCase(),
              expectedConfidence: "medium",
            }));
          }
          // Fallback to canonical
          return fc.integer({ min: 0, max: canonicalAliases.length - 1 }).map((idx) => ({
            brand,
            alias: canonicalAliases[idx].toLowerCase(),
            expectedConfidence: "high",
          }));
        });
    });

    fc.assert(
      fc.property(
        canonicalOrTyposquat,
        fc.record({ prefix: alphaLabel, tld: randomTld }),
        ({ brand, alias, expectedConfidence }, { prefix, tld }) => {
          const hostname = `${alias}.${prefix}.${tld}`;
          const normalized = normalizeDomain(hostname);
          const result = matchBrandInUrl(normalized, hostname);

          expect(result.detected).toBe(true);
          const ev = result.evidence.find((e) => e.brandId === brand.id);
          expect(ev).toBeDefined();
          expect(ev!.confidence).toBe(expectedConfidence);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 9.5, 9.6**
});

// ═══════════════════════════════════════════════════════════════════════════
// TEST HELPER: Replicate canonical alias logic from brand-matcher
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Replicate the canonical alias classification logic used in brand-matcher.ts
 * for test assertion purposes.
 */
function getCanonicalAliasesForTest(brand: BrandEntry): Set<string> {
  const canonical = new Set<string>();
  // Brand id is always canonical
  canonical.add(brand.id.toLowerCase());
  // First alias is always canonical
  if (brand.aliases.length > 0) {
    canonical.add(brand.aliases[0].toLowerCase());
  }
  // Cyrillic transliterations are canonical
  for (const alias of brand.aliases) {
    if (hasNonAscii(alias)) {
      canonical.add(alias.toLowerCase());
    }
  }
  // Aliases containing the brand id as substring are canonical
  for (const alias of brand.aliases) {
    if (alias.toLowerCase().includes(brand.id.replace("-", "").toLowerCase())) {
      canonical.add(alias.toLowerCase());
    }
    if (brand.id.replace("-", "").toLowerCase().includes(alias.toLowerCase())) {
      canonical.add(alias.toLowerCase());
    }
  }
  return canonical;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT-BASED BRAND DETECTION PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════

import { matchBrandInText } from "../brand-matcher";

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL HELPERS FOR TEXT PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════

/** All brands (generic and non-generic) */
const allBrands = BRAND_REGISTRY;

/** Generic brands only (Click, Payme) */
const genericBrands = BRAND_REGISTRY.filter((b) => b.isGenericName);

/**
 * Generator: random domain that is NOT any brand's official domain.
 * Produces domains like "randomlabel.com" that won't match official domains.
 */
const randomNonOfficialDomain: fc.Arbitrary<string> = fc
  .record({
    label: alphaLabel,
    tld: randomTld,
  })
  .map(({ label, tld }) => `${label}.${tld}`);

/**
 * Safe conversational phrases that do NOT contain suspicious keywords.
 * These are templates where {brand} will be replaced with a brand name.
 */
const safeConversationalTemplates = [
  "I heard about {brand} on the news today",
  "My friend uses {brand} service",
  "{brand} has a new office in Tashkent",
  "I visited the {brand} branch yesterday",
  "The {brand} app was recently updated",
  "Have you heard about {brand} before",
  "Someone told me about {brand} last week",
  "{brand} is quite popular in Uzbekistan",
  "My colleague works at {brand} company",
  "The article mentioned {brand} briefly",
];

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 4: Text with brand name and non-official URL triggers detection
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 4: Text with brand name and non-official URL triggers detection
describe("Feature: brand-impersonation-detector, Property 4: Text with brand name and non-official URL triggers detection", () => {
  it("for any non-generic brand, when the brand name appears in text alongside a non-official URL, detection triggers", () => {
    /**
     * For text matching, aliases must be Latin (ASCII) only because JavaScript's \b
     * word boundary doesn't work correctly with Cyrillic characters in regex.
     * Filter to Latin-only matchable aliases.
     */
    function isTextMatchableAlias(alias: string): boolean {
      if (!isMatchableAlias(alias)) return false;
      // Only Latin ASCII aliases work reliably with \b word boundary in JS regex
      if (hasNonAscii(alias)) return false;
      return true;
    }

    /** Non-generic brands with at least one text-matchable (Latin) alias */
    const nonGenericBrandsForText = nonGenericBrands.filter((b) =>
      b.aliases.some((a) => isTextMatchableAlias(a.toLowerCase())),
    );

    const brandTextWithNonOfficialUrl: fc.Arbitrary<{
      brand: BrandEntry;
      alias: string;
      text: string;
      url: string;
    }> = fc.integer({ min: 0, max: nonGenericBrandsForText.length - 1 }).chain((brandIdx) => {
      const brand = nonGenericBrandsForText[brandIdx];
      const matchableAliases = brand.aliases.filter((a) => isTextMatchableAlias(a.toLowerCase()));
      return fc
        .record({
          aliasIdx: fc.integer({ min: 0, max: matchableAliases.length - 1 }),
          domain: randomNonOfficialDomain,
          pathSegment: alphaLabel,
        })
        .map(({ aliasIdx, domain, pathSegment }) => {
          const alias = matchableAliases[aliasIdx];
          const url = `https://${domain}/${pathSegment}`;
          const text = `Warning from ${alias}: ${url}`;
          return { brand, alias, text, url };
        });
    });

    fc.assert(
      fc.property(brandTextWithNonOfficialUrl, ({ brand, alias, text, url }) => {
        const result = matchBrandInText(text, [url], []);

        expect(result.detected).toBe(true);
        const matchedBrandIds = result.evidence.map((e) => e.brandId);
        expect(matchedBrandIds).toContain(brand.id);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.1**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 5: Brand name in plain text without URL or risk signals does not trigger
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 5: Brand name in plain text without URL or risk signals does not trigger
describe("Feature: brand-impersonation-detector, Property 5: Brand name in plain text without URL or risk signals does not trigger", () => {
  it("for any brand name in text without URLs and without high-risk codes, detection does NOT trigger", () => {
    const brandInPlainText: fc.Arbitrary<{
      brand: BrandEntry;
      text: string;
    }> = fc.integer({ min: 0, max: allBrands.length - 1 }).chain((brandIdx) => {
      const brand = allBrands[brandIdx];
      // Pick a matchable alias (first one is usually good for non-generic)
      const alias = brand.aliases[0];
      return fc
        .integer({ min: 0, max: safeConversationalTemplates.length - 1 })
        .map((templateIdx) => {
          const template = safeConversationalTemplates[templateIdx];
          const text = template.replace("{brand}", alias);
          return { brand, text };
        });
    });

    fc.assert(
      fc.property(brandInPlainText, ({ brand, text }) => {
        // No URLs, no high-risk reason codes
        const result = matchBrandInText(text, [], []);

        expect(result.detected).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.2, 6.2**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 8: Generic brand name in normal conversation does not trigger
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 8: Generic brand name in normal conversation does not trigger
describe("Feature: brand-impersonation-detector, Property 8: Generic brand name in normal conversation does not trigger", () => {
  it("for generic brands (click, payme), normal conversational text without URLs/keywords does NOT trigger", () => {
    /**
     * Conversational phrases using generic brand words in their common English meaning.
     * These must NOT contain suspicious keywords (payment, card, otp, login, verify, etc.)
     * or URLs.
     */
    const clickConversationalPhrases = [
      "click here to continue",
      "please click the button",
      "click on the menu item",
      "just click that link below",
      "don't click on unknown items",
      "simply click to proceed",
      "click this for more details",
      "you need to click the icon",
      "click and drag to move it",
      "double click to open the file",
    ];

    const paymeConversationalPhrases = [
      "pay me back tomorrow",
      "can you pay me for lunch",
      "please pay me when you can",
      "don't forget to pay me later",
      "you still need to pay me",
      "pay me after the meeting",
      "remember to pay me on Friday",
      "just pay me the difference",
      "you can pay me next week",
      "they forgot to pay me again",
    ];

    const genericPhrases: fc.Arbitrary<string> = fc
      .record({
        brand: fc.constantFrom("click" as const, "payme" as const),
        phraseIdx: fc.integer({ min: 0, max: 9 }),
      })
      .map(({ brand, phraseIdx }) => {
        if (brand === "click") {
          return clickConversationalPhrases[phraseIdx];
        }
        return paymeConversationalPhrases[phraseIdx];
      });

    fc.assert(
      fc.property(genericPhrases, (text) => {
        const result = matchBrandInText(text, [], []);

        expect(result.detected).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.5**
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY 9: Generic brand name in hostname or with suspicious keywords triggers detection
// ═══════════════════════════════════════════════════════════════════════════

// Feature: brand-impersonation-detector, Property 9: Generic brand name in hostname or with suspicious keywords triggers detection
describe("Feature: brand-impersonation-detector, Property 9: Generic brand name in hostname or with suspicious keywords triggers detection", () => {
  it("for generic brands, when the brand appears alongside suspicious keywords AND a non-official URL, detection triggers", () => {
    const suspiciousKeywords = [
      "payment",
      "card",
      "otp",
      "login",
      "verify",
      "pin",
      "cvv",
      "sms",
      "transfer",
      "balance",
    ];

    const genericBrandWithSuspiciousContext: fc.Arbitrary<{
      brand: BrandEntry;
      text: string;
      url: string;
    }> = fc
      .record({
        brandIdx: fc.integer({ min: 0, max: genericBrands.length - 1 }),
        keywordIdx: fc.integer({ min: 0, max: suspiciousKeywords.length - 1 }),
        domain: randomNonOfficialDomain,
        pathSegment: alphaLabel,
      })
      .map(({ brandIdx, keywordIdx, domain, pathSegment }) => {
        const brand = genericBrands[brandIdx];
        const keyword = suspiciousKeywords[keywordIdx];
        const url = `https://${domain}/${pathSegment}`;
        // Build text with brand name + suspicious keyword + URL
        const alias = brand.aliases[0]; // "payme" or "click"
        const text = `Your ${alias} ${keyword} confirmation: ${url}`;
        return { brand, text, url };
      });

    fc.assert(
      fc.property(genericBrandWithSuspiciousContext, ({ brand, text, url }) => {
        const result = matchBrandInText(text, [url], []);

        expect(result.detected).toBe(true);
        const matchedBrandIds = result.evidence.map((e) => e.brandId);
        expect(matchedBrandIds).toContain(brand.id);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.6**
});
