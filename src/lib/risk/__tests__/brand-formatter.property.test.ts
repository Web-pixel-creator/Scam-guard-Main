// Property-based tests for Brand Formatter.
//
// Feature: brand-impersonation-detector, Property 10: Formatter explanation contains brand name and official domain in all languages
// Feature: brand-impersonation-detector, Property 11: Multiple brand detections produce multiple explanations

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatBrandImpersonationExplanation,
  formatBrandImpersonationExplanations,
} from "../brand-formatter";
import type { BrandEvidence } from "../brand-matcher";
import { BRAND_REGISTRY } from "../brand-registry";
import type { Lang } from "../../i18n";

/**
 * Generator: picks a random brand from BRAND_REGISTRY.
 */
const arbBrandIndex = fc.integer({ min: 0, max: BRAND_REGISTRY.length - 1 });

/**
 * Generator: picks a random language.
 */
const arbLang: fc.Arbitrary<Lang> = fc.constantFrom("ru", "uz", "en");

/**
 * Generator: builds a BrandEvidence object from a random brand.
 */
const arbBrandEvidence: fc.Arbitrary<BrandEvidence> = arbBrandIndex.map((idx) => {
  const brand = BRAND_REGISTRY[idx];
  return {
    brandId: brand.id,
    brandName: brand.name.en,
    matchedAlias: brand.aliases[0],
    matchedIn: "hostname" as const,
    checkedDomain: `${brand.aliases[0]}-fake.example.com`,
    officialDomains: brand.officialDomains,
    confidence: "high" as const,
  };
});

/**
 * Generator: builds a list of 1-5 distinct BrandEvidence objects.
 * Picks a random subset of brands from the registry (no duplicates).
 */
const arbDistinctEvidenceList: fc.Arbitrary<BrandEvidence[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((count) =>
    fc
      .shuffledSubarray(
        Array.from({ length: BRAND_REGISTRY.length }, (_, i) => i),
        { minLength: count, maxLength: count },
      )
      .map((indices) =>
        indices.map((idx) => {
          const brand = BRAND_REGISTRY[idx];
          return {
            brandId: brand.id,
            brandName: brand.name.en,
            matchedAlias: brand.aliases[0],
            matchedIn: "hostname" as const,
            checkedDomain: `${brand.aliases[0]}-fake.example.com`,
            officialDomains: brand.officialDomains,
            confidence: "high" as const,
          } satisfies BrandEvidence;
        }),
      ),
  );

// Feature: brand-impersonation-detector, Property 10: Formatter explanation contains brand name and official domain in all languages
describe("Feature: brand-impersonation-detector, Property 10: Formatter explanation contains brand name and official domain in all languages", () => {
  it("formatted explanation contains the brand display name and first official domain for any brand and language", () => {
    fc.assert(
      fc.property(arbBrandIndex, arbLang, (idx, lang) => {
        const brand = BRAND_REGISTRY[idx];
        const evidence: BrandEvidence = {
          brandId: brand.id,
          brandName: brand.name.en,
          matchedAlias: brand.aliases[0],
          matchedIn: "hostname",
          checkedDomain: `${brand.aliases[0]}-fake.example.com`,
          officialDomains: brand.officialDomains,
          confidence: "high",
        };

        const result = formatBrandImpersonationExplanation(evidence, lang);

        // The formatted output must contain the brand's localized display name
        const expectedBrandName = brand.name[lang];
        expect(result).toContain(expectedBrandName);

        // The formatted output must contain at least the first official domain
        const expectedDomain = brand.officialDomains[0];
        expect(result).toContain(expectedDomain);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
});

// Feature: brand-impersonation-detector, Property 11: Multiple brand detections produce multiple explanations
describe("Feature: brand-impersonation-detector, Property 11: Multiple brand detections produce multiple explanations", () => {
  it("formatBrandImpersonationExplanations produces exactly N explanation strings for N distinct evidence objects", () => {
    fc.assert(
      fc.property(arbDistinctEvidenceList, arbLang, (evidenceList, lang) => {
        const results = formatBrandImpersonationExplanations(evidenceList, lang);

        // Result array length must equal input array length
        expect(results).toHaveLength(evidenceList.length);

        // Each result must be a non-empty string
        for (const explanation of results) {
          expect(typeof explanation).toBe("string");
          expect(explanation.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 5.5**
});
