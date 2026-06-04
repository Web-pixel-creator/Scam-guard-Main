// Unit tests for key brand impersonation detection scenarios (Requirement 11)
import { describe, it, expect } from "vitest";
import { normalizeDomain } from "../domain-normalizer";
import { matchBrandInUrl, matchBrandInText } from "../brand-matcher";

describe("Brand Matcher — Key Detection Scenarios (Requirement 11)", () => {
  describe("URL detection", () => {
    it("R11.1: kapitalbank-support.lovable.app → detects Kapitalbank impersonation", () => {
      const normalized = normalizeDomain("kapitalbank-support.lovable.app");
      const result = matchBrandInUrl(normalized, "kapitalbank-support.lovable.app");
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("kapitalbank");
      expect(result.evidence[0].matchedIn).toBe("hostname");
    });

    it("R11.2: kapitalbank.uz → no detection (official domain)", () => {
      const normalized = normalizeDomain("kapitalbank.uz");
      const result = matchBrandInUrl(normalized, "kapitalbank.uz");
      expect(result.detected).toBe(false);
    });

    it("R11.3: help.kapitalbank.uz → no detection (official subdomain)", () => {
      const normalized = normalizeDomain("help.kapitalbank.uz");
      const result = matchBrandInUrl(normalized, "help.kapitalbank.uz");
      expect(result.detected).toBe(false);
    });

    it("R11.4: kapitalbank.uz.evil.com → detects impersonation (official domain as substring)", () => {
      const normalized = normalizeDomain("kapitalbank.uz.evil.com");
      const result = matchBrandInUrl(normalized, "kapitalbank.uz.evil.com");
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("kapitalbank");
      expect(result.evidence[0].matchedIn).toBe("hostname");
    });

    it("R11.8: payme-verify.pages.dev → detects Payme impersonation", () => {
      const normalized = normalizeDomain("payme-verify.pages.dev");
      const result = matchBrandInUrl(normalized, "payme-verify.pages.dev");
      expect(result.detected).toBe(true);
      expect(result.evidence[0].brandId).toBe("payme");
      expect(result.evidence[0].matchedIn).toBe("hostname");
    });
  });

  describe("Text detection — false positive suppression", () => {
    it('R11.5: Text "Kapitalbank" without URL → no detection', () => {
      const result = matchBrandInText("Kapitalbank announced new quarterly results", [], []);
      expect(result.detected).toBe(false);
    });

    it('R11.6: Text "click here" → no Click brand match', () => {
      const result = matchBrandInText("click here to continue", [], []);
      expect(result.detected).toBe(false);
    });

    it('R11.7: Text "pay me later" → no Payme brand match', () => {
      const result = matchBrandInText("pay me later", [], []);
      expect(result.detected).toBe(false);
    });
  });
});
