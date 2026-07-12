import { describe, expect, it } from "vitest";
import { normalizeDomain, toDomainComparisonKey } from "../domain-normalizer";

/**
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 *
 * Unit tests for the Domain Normalizer module covering:
 * - Protocol stripping (http://, https://)
 * - www. removal
 * - Lowercasing
 * - Punycode decode fallback behavior
 * - Homoglyph replacement
 * - Path normalization
 */
describe("Domain Normalizer", () => {
  describe("protocol stripping", () => {
    it("strips http:// prefix", () => {
      const result = normalizeDomain("http://example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("strips https:// prefix", () => {
      const result = normalizeDomain("https://example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("strips HTTP:// prefix (case-insensitive)", () => {
      const result = normalizeDomain("HTTP://Example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("strips HTTPS:// prefix (case-insensitive)", () => {
      const result = normalizeDomain("HTTPS://Example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("handles input with no protocol", () => {
      const result = normalizeDomain("example.com");
      expect(result.hostname).toBe("example.com");
    });
  });

  describe("www. removal", () => {
    it("strips www. prefix", () => {
      const result = normalizeDomain("www.example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("strips www. prefix after protocol", () => {
      const result = normalizeDomain("https://www.example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("strips WWW. prefix (case-insensitive)", () => {
      const result = normalizeDomain("https://WWW.Example.com");
      expect(result.hostname).toBe("example.com");
    });

    it("does not strip www from middle of domain", () => {
      const result = normalizeDomain("subdomain.www.example.com");
      expect(result.hostname).toBe("subdomain.www.example.com");
    });
  });

  describe("lowercasing", () => {
    it("converts uppercase hostname to lowercase", () => {
      const result = normalizeDomain("KAPITALBANK.UZ");
      expect(result.hostname).toBe("kapitalbank.uz");
    });

    it("converts mixed case hostname to lowercase", () => {
      const result = normalizeDomain("KapitalBank-Support.Lovable.App");
      expect(result.hostname).toBe("kapitalbank-support.lovable.app");
    });

    it("converts uppercase path to lowercase", () => {
      const result = normalizeDomain("example.com/LOGIN/Verify");
      expect(result.path).toBe("/login/verify");
    });
  });

  describe("punycode decode fallback behavior", () => {
    it("decodes valid punycode label and produces an ASCII comparison key", () => {
      // Decode first, then apply visual-confusable mapping and bounded Cyrillic transliteration.
      const result = normalizeDomain("xn--e1afmapc.xn--p1ai");
      expect(result.hostname).toBe("pimmpe.pf");
    });

    it("falls back to raw ASCII on invalid punycode", () => {
      const result = normalizeDomain("xn--invalid!!!.example.com");
      expect(result.hostname).toBe("xn--invalid!!!.example.com");
    });

    it("leaves non-punycode labels unchanged", () => {
      const result = normalizeDomain("kapitalbank.uz");
      expect(result.hostname).toBe("kapitalbank.uz");
    });
  });

  describe("homoglyph replacement", () => {
    it("replaces Cyrillic а (U+0430) with Latin a", () => {
      // "к\u0430пит\u0430лбанк" → after homoglyphs and other Cyrillic chars
      const result = normalizeDomain("k\u0430pitalbank.com");
      expect(result.hostname).toBe("kapitalbank.com");
    });

    it("replaces Cyrillic е (U+0435) with Latin e", () => {
      const result = normalizeDomain("b\u0435eline.com");
      expect(result.hostname).toBe("beeline.com");
    });

    it("replaces Cyrillic о (U+043E) with Latin o", () => {
      const result = normalizeDomain("hum\u043E.com");
      expect(result.hostname).toBe("humo.com");
    });

    it("replaces Cyrillic р (U+0440) with Latin p", () => {
      const result = normalizeDomain("\u0440ayme.com");
      expect(result.hostname).toBe("payme.com");
    });

    it("replaces Cyrillic с (U+0441) with Latin c", () => {
      const result = normalizeDomain("u\u0441ell.com");
      expect(result.hostname).toBe("ucell.com");
    });

    it("replaces digit 0 with letter o", () => {
      const result = normalizeDomain("hum0.com");
      expect(result.hostname).toBe("humo.com");
    });

    it("replaces digit 1 with letter l", () => {
      const result = normalizeDomain("uce1l.com");
      expect(result.hostname).toBe("ucell.com");
    });

    it("applies multiple homoglyph replacements in one domain", () => {
      // Cyrillic а (U+0430) + digit 0: "kаpitа0bank.com"
      // а→a, а→a, 0→o → "kapitaobank.com"
      const result = normalizeDomain("k\u0430pit\u04300bank.com");
      expect(result.hostname).toBe("kapitaobank.com");
    });
  });

  describe("path normalization", () => {
    it("separates path from hostname", () => {
      const result = normalizeDomain("example.com/login/verify");
      expect(result.hostname).toBe("example.com");
      expect(result.path).toBe("/login/verify");
    });

    it("returns empty path when no path present", () => {
      const result = normalizeDomain("example.com");
      expect(result.path).toBe("");
    });

    it("lowercases path", () => {
      const result = normalizeDomain("example.com/Security/OTP");
      expect(result.path).toBe("/security/otp");
    });

    it("applies homoglyph normalization to path", () => {
      const result = normalizeDomain("example.com/k\u0430pitalbank");
      expect(result.path).toBe("/kapitalbank");
    });

    it("handles full URL with protocol, www, and path", () => {
      const result = normalizeDomain("https://www.Example.COM/Login/Verify");
      expect(result.hostname).toBe("example.com");
      expect(result.path).toBe("/login/verify");
    });
  });

  describe("whitespace handling", () => {
    it("trims leading and trailing whitespace", () => {
      const result = normalizeDomain("  https://example.com  ");
      expect(result.hostname).toBe("example.com");
    });
  });

  describe("security canonicalization", () => {
    it("removes one terminal DNS root dot before official-domain comparison", () => {
      expect(normalizeDomain("https://kapitalbank.uz./login")).toEqual({
        hostname: "kapitalbank.uz",
        hostnameIdentity: "kapitalbank.uz",
        path: "/login",
      });
    });

    it("keeps DNS identity distinct from the lossy similarity skeleton", () => {
      const officialCollision = normalizeDomain("https://kapita1bank.uz/login");
      const newsCollision = normalizeDomain("https://sp0t.uz/kapitalbank");

      expect(officialCollision.hostname).toBe("kapitalbank.uz");
      expect(officialCollision.hostnameIdentity).toBe("kapita1bank.uz");
      expect(newsCollision.hostname).toBe("spot.uz");
      expect(newsCollision.hostnameIdentity).toBe("sp0t.uz");
    });

    it("gives the same comparison key to decoded IDN and registered Cyrillic alias", () => {
      const normalized = normalizeDomain("https://капиталбанк.com/login");
      const label = normalized.hostname.split(".")[0];

      expect(toDomainComparisonKey(label)).toBe(toDomainComparisonKey("капиталбанк"));
    });
  });
});
