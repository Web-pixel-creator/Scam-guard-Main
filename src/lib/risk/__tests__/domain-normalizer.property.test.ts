// Property-based tests for Domain Normalizer.
//
// Feature: brand-impersonation-detector, Property 14: Domain normalization produces lowercase output with no protocol or www prefix
// Feature: brand-impersonation-detector, Property 15: Homoglyph normalization maps known substitutions

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../domain-normalizer";

/**
 * Generates a random domain label (2-10 chars) using mixed-case alpha characters.
 */
const mixedCaseLabel: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")), {
    minLength: 2,
    maxLength: 10,
  })
  .map((chars) => chars.join(""));

/**
 * Generates a random path segment using mixed-case alpha chars and valid path symbols.
 */
const mixedCasePath: fc.Arbitrary<string> = fc.oneof(
  fc.constant(""),
  fc
    .array(fc.constantFrom(...Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_")), {
      minLength: 1,
      maxLength: 20,
    })
    .map((chars) => "/" + chars.join("")),
);

/**
 * Generator: random URLs with mixed case, protocols (http://, https://), and www. prefix.
 * Produces strings like "HTTPS://WWW.ExAmPle.COM/SomePath"
 */
const urlWithMixedCaseAndProtocol: fc.Arbitrary<string> = fc
  .record({
    protocol: fc.constantFrom("http://", "https://", "HTTP://", "HTTPS://", "Http://", ""),
    www: fc.constantFrom("www.", "WWW.", "Www.", ""),
    labels: fc.array(mixedCaseLabel, { minLength: 2, maxLength: 4 }),
    path: mixedCasePath,
  })
  .map(({ protocol, www, labels, path }) => `${protocol}${www}${labels.join(".")}${path}`);

/**
 * Generator: domains with Cyrillic а (U+0430), digit 0, and digit 1 substitutions.
 * Produces hostnames where Latin chars are replaced with known homoglyphs.
 */
const domainWithHomoglyphs: fc.Arbitrary<{ input: string; expectedMappings: Array<{ from: string; to: string }> }> = fc
  .record({
    // Base domain parts using only safe lowercase chars that won't be homoglyph-mapped
    prefix: fc
      .array(fc.constantFrom(...Array.from("bcdefghijkmnpqrstuvwxyz")), { minLength: 2, maxLength: 6 })
      .map((chars) => chars.join("")),
    suffix: fc
      .array(fc.constantFrom(...Array.from("bcdefghijkmnpqrstuvwxyz")), { minLength: 2, maxLength: 4 })
      .map((chars) => chars.join("")),
    // Which homoglyph substitution to inject
    substitution: fc.constantFrom(
      { char: "\u0430", latin: "a" }, // Cyrillic а → Latin a
      { char: "0", latin: "o" }, // digit 0 → o
      { char: "1", latin: "l" }, // digit 1 → l
    ),
    // Position: inject the homoglyph at the start, middle, or end of the prefix
    position: fc.constantFrom("start", "middle", "end"),
  })
  .map(({ prefix, suffix, substitution, position }) => {
    let hostname: string;
    if (position === "start") {
      hostname = `${substitution.char}${prefix}.${suffix}.uz`;
    } else if (position === "end") {
      hostname = `${prefix}${substitution.char}.${suffix}.uz`;
    } else {
      // middle
      const mid = Math.floor(prefix.length / 2);
      hostname = `${prefix.slice(0, mid)}${substitution.char}${prefix.slice(mid)}.${suffix}.uz`;
    }
    return {
      input: hostname,
      expectedMappings: [{ from: substitution.char, to: substitution.latin }],
    };
  });

// Feature: brand-impersonation-detector, Property 14: Domain normalization produces lowercase output with no protocol or www prefix
describe("Feature: brand-impersonation-detector, Property 14: Domain normalization produces lowercase output with no protocol or www prefix", () => {
  it("normalized hostname is entirely lowercase, contains no protocol scheme, and has no www. prefix", () => {
    fc.assert(
      fc.property(urlWithMixedCaseAndProtocol, (rawUrl) => {
        const result = normalizeDomain(rawUrl);

        // Hostname must be entirely lowercase
        expect(result.hostname).toBe(result.hostname.toLowerCase());

        // Hostname must not contain protocol schemes
        expect(result.hostname).not.toContain("http://");
        expect(result.hostname).not.toContain("https://");

        // Hostname must not start with www.
        expect(result.hostname.startsWith("www.")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 10.1, 10.2**
});

// Feature: brand-impersonation-detector, Property 15: Homoglyph normalization maps known substitutions
describe("Feature: brand-impersonation-detector, Property 15: Homoglyph normalization maps known substitutions", () => {
  it("normalized output contains Latin equivalents for Cyrillic а→a, 0→o, 1→l substitutions", () => {
    fc.assert(
      fc.property(domainWithHomoglyphs, ({ input, expectedMappings }) => {
        const result = normalizeDomain(input);

        // The homoglyph character should NOT be present in the normalized hostname
        for (const mapping of expectedMappings) {
          expect(result.hostname).not.toContain(mapping.from);
        }

        // The Latin equivalent should be present instead
        for (const mapping of expectedMappings) {
          expect(result.hostname).toContain(mapping.to);
        }
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 10.4**
});
