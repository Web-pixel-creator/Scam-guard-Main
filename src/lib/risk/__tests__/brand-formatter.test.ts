// Unit tests for Brand Formatter — validates trilingual explanation output
import { describe, it, expect } from "vitest";
import {
  formatBrandImpersonationExplanation,
  formatBrandImpersonationExplanations,
} from "../brand-formatter";
import type { BrandEvidence } from "../brand-matcher";

/**
 * Helper: build a minimal BrandEvidence object for testing.
 */
function makeEvidence(overrides: Partial<BrandEvidence> = {}): BrandEvidence {
  return {
    brandId: "kapitalbank",
    brandName: "Kapitalbank",
    matchedAlias: "kapitalbank",
    matchedIn: "hostname",
    checkedDomain: "kapitalbank-support.lovable.app",
    officialDomains: ["kapitalbank.uz"],
    confidence: "high",
    ...overrides,
  };
}

describe("formatBrandImpersonationExplanation", () => {
  describe("Russian template (Req 5.2)", () => {
    it("matches expected RU format with brand name and official domain", () => {
      const evidence = makeEvidence();
      const result = formatBrandImpersonationExplanation(evidence, "ru");

      expect(result).toBe(
        "Похоже на имитацию Капиталбанк. Ссылка использует название бренда, но домен не совпадает с официальным. Официальный сайт: kapitalbank.uz"
      );
    });
  });

  describe("Uzbek template (Req 5.3)", () => {
    it("matches expected UZ format with brand name and official domain", () => {
      const evidence = makeEvidence();
      const result = formatBrandImpersonationExplanation(evidence, "uz");

      expect(result).toBe(
        "Kapitalbank ga o'xshash taqlid aniqlandi. Havola brend nomini ishlatadi, lekin domen rasmiy domenga mos kelmaydi. Rasmiy sayt: kapitalbank.uz"
      );
    });
  });

  describe("English template (Req 5.4)", () => {
    it("matches expected EN format with brand name and official domain", () => {
      const evidence = makeEvidence();
      const result = formatBrandImpersonationExplanation(evidence, "en");

      expect(result).toBe(
        "Possible Kapitalbank impersonation detected. The link uses the brand name, but the domain does not match the official one. Official site: kapitalbank.uz"
      );
    });
  });

  describe("Verified callback number inclusion (Req 7.3)", () => {
    it("appends callback number in RU format when provided", () => {
      const evidence = makeEvidence();
      const result = formatBrandImpersonationExplanation(evidence, "ru", "+998712345678");

      expect(result).toContain("Номер для проверки: +998712345678");
      // Should be on a new line after the main explanation
      expect(result).toBe(
        "Похоже на имитацию Капиталбанк. Ссылка использует название бренда, но домен не совпадает с официальным. Официальный сайт: kapitalbank.uz\nНомер для проверки: +998712345678"
      );
    });

    it("does not include callback number line when not provided", () => {
      const evidence = makeEvidence();
      const result = formatBrandImpersonationExplanation(evidence, "ru");

      expect(result).not.toContain("Номер для проверки:");
    });
  });
});

describe("formatBrandImpersonationExplanations", () => {
  describe("Multiple brand explanations (Req 5.5)", () => {
    it("returns N explanations for N evidence items", () => {
      const evidenceList: BrandEvidence[] = [
        makeEvidence({ brandId: "kapitalbank", brandName: "Kapitalbank" }),
        makeEvidence({
          brandId: "payme",
          brandName: "Payme",
          matchedAlias: "payme",
          officialDomains: ["payme.uz"],
          checkedDomain: "payme-verify.evil.com",
        }),
        makeEvidence({
          brandId: "uzcard",
          brandName: "UZCARD",
          matchedAlias: "uzcard",
          officialDomains: ["uzcard.uz"],
          checkedDomain: "uzcard-login.fake.com",
        }),
      ];

      const results = formatBrandImpersonationExplanations(evidenceList, "en");

      expect(results).toHaveLength(3);
      expect(results[0]).toContain("Kapitalbank");
      expect(results[1]).toContain("Payme");
      expect(results[2]).toContain("UZCARD");
    });

    it("returns single explanation for single evidence item", () => {
      const evidenceList: BrandEvidence[] = [makeEvidence()];
      const results = formatBrandImpersonationExplanations(evidenceList, "ru");

      expect(results).toHaveLength(1);
      expect(results[0]).toContain("Капиталбанк");
    });

    it("returns empty array for empty evidence list", () => {
      const results = formatBrandImpersonationExplanations([], "en");
      expect(results).toHaveLength(0);
    });

    it("passes callback number to all explanations", () => {
      const evidenceList: BrandEvidence[] = [
        makeEvidence({ brandId: "kapitalbank" }),
        makeEvidence({
          brandId: "beeline-uz",
          brandName: "Beeline Uzbekistan",
          matchedAlias: "beeline",
          officialDomains: ["beeline.uz"],
          checkedDomain: "beeline-promo.fake.com",
        }),
      ];

      const results = formatBrandImpersonationExplanations(evidenceList, "ru", "+998901234567");

      expect(results).toHaveLength(2);
      expect(results[0]).toContain("Номер для проверки: +998901234567");
      expect(results[1]).toContain("Номер для проверки: +998901234567");
    });
  });
});
