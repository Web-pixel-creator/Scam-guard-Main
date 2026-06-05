import { describe, it, expect } from "vitest";
import { BRAND_REGISTRY, findBrandByAlias, type BrandEntry } from "@/lib/risk/brand-registry";
import { REASON_LABELS } from "@/lib/risk/rules";

describe("Brand Registry integrity", () => {
  const REQUIRED_BRAND_IDS = [
    "kapitalbank",
    "nbu",
    "ipak-yuli",
    "anorbank",
    "aloqabank",
    "uzcard",
    "humo",
    "payme",
    "click",
    "ucell",
    "beeline-uz",
    "mobiuz",
    "mvd",
    "tax-authority",
  ];

  it("contains all 14 required brands", () => {
    expect(BRAND_REGISTRY.length).toBeGreaterThanOrEqual(14);
    const ids = BRAND_REGISTRY.map((b) => b.id);
    for (const requiredId of REQUIRED_BRAND_IDS) {
      expect(ids).toContain(requiredId);
    }
  });

  it("each entry has at least one official domain", () => {
    for (const brand of BRAND_REGISTRY) {
      expect(
        brand.officialDomains.length,
        `brand "${brand.id}" should have at least one official domain`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("each entry has required fields (id, name, category, officialDomains, aliases)", () => {
    for (const brand of BRAND_REGISTRY) {
      expect(brand.id).toBeTruthy();
      expect(brand.name).toBeDefined();
      expect(brand.name.ru).toBeTruthy();
      expect(brand.name.uz).toBeTruthy();
      expect(brand.name.en).toBeTruthy();
      expect(["bank", "payment_system", "telecom", "government"]).toContain(brand.category);
      expect(Array.isArray(brand.officialDomains)).toBe(true);
      expect(Array.isArray(brand.aliases)).toBe(true);
      expect(brand.aliases.length).toBeGreaterThanOrEqual(1);
    }
  });

  describe("REASON_LABELS for brand_impersonation", () => {
    it('has Russian label: "Подражает известному бренду"', () => {
      expect(REASON_LABELS.brand_impersonation.ru).toBe("Подражает известному бренду");
    });

    it('has Uzbek label: "Taniqli brendga taqlid qilmoqda"', () => {
      expect(REASON_LABELS.brand_impersonation.uz).toBe("Taniqli brendga taqlid qilmoqda");
    });

    it('has English label: "Impersonates a known brand"', () => {
      expect(REASON_LABELS.brand_impersonation.en).toBe("Impersonates a known brand");
    });
  });

  describe("findBrandByAlias", () => {
    it("finds a brand by exact lowercase alias", () => {
      const result = findBrandByAlias("kapitalbank");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("kapitalbank");
    });

    it("is case-insensitive", () => {
      const result = findBrandByAlias("KapitalBank");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("kapitalbank");
    });

    it("finds brand by uppercase alias", () => {
      const result = findBrandByAlias("UZCARD");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("uzcard");
    });

    it("returns null for unknown alias", () => {
      const result = findBrandByAlias("nonexistent-brand");
      expect(result).toBeNull();
    });

    it("finds brand by Cyrillic alias", () => {
      const result = findBrandByAlias("капиталбанк");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("kapitalbank");
    });

    it("finds brand by typosquat variant", () => {
      const result = findBrandByAlias("kapitolbank");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("kapitalbank");
    });
  });

  describe("isGenericName", () => {
    it("Click is marked as generic", () => {
      const click = BRAND_REGISTRY.find((b) => b.id === "click");
      expect(click).toBeDefined();
      expect(click!.isGenericName).toBe(true);
    });

    it("Payme is marked as generic", () => {
      const payme = BRAND_REGISTRY.find((b) => b.id === "payme");
      expect(payme).toBeDefined();
      expect(payme!.isGenericName).toBe(true);
    });

    it("non-generic brands are not marked as generic", () => {
      const kapitalbank = BRAND_REGISTRY.find((b) => b.id === "kapitalbank");
      expect(kapitalbank).toBeDefined();
      expect(kapitalbank!.isGenericName).toBe(false);
    });
  });
});
