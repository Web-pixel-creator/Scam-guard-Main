// Unit tests for key brand impersonation detection scenarios (Requirement 11)
import { describe, it, expect } from "vitest";
import { normalizeDomain } from "../domain-normalizer";
import { matchBrandInUrl, matchBrandInText } from "../brand-matcher";
import { BRAND_REGISTRY } from "../brand-registry";

const CYRILLIC_ALIAS_CASES = BRAND_REGISTRY.flatMap((brand) =>
  brand.aliases
    .filter((alias) => /[^\p{ASCII}]/u.test(alias))
    .map((alias) => [brand.id, alias] as const),
);

const IDN_ALIAS_CASES = CYRILLIC_ALIAS_CASES.filter(([, alias]) => /^[\p{L}\p{N}-]+$/u.test(alias));

const OFFICIAL_DOMAIN_CASES = BRAND_REGISTRY.flatMap((brand) =>
  brand.officialDomains.map((domain) => [brand.id, domain] as const),
);

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

    it("detects a protected Cyrillic IDN through a shared comparison skeleton", () => {
      const raw = "https://капиталбанк.com/login";
      const result = matchBrandInUrl(normalizeDomain(raw), raw);

      expect(result.detected).toBe(true);
      expect(result.evidence[0]).toMatchObject({
        brandId: "kapitalbank",
        matchedIn: "hostname",
      });
    });

    it.each([
      "https://kапиталбанк.com/login",
      "https://аноrбанк.com/login",
      "https://kaрitalbank.com/login",
    ])("detects hybrid-script protected-brand IDN %s", (raw) => {
      const browserHost = new URL(raw).hostname;
      expect(matchBrandInUrl(normalizeDomain(browserHost), browserHost).detected).toBe(true);
    });

    it("treats the DNS-absolute form of an official domain as official", () => {
      const raw = "https://kapitalbank.uz./login";
      expect(matchBrandInUrl(normalizeDomain(raw), raw).detected).toBe(false);
    });

    it.each(IDN_ALIAS_CASES)(
      "matches registered IDN alias %s/%s after browser Punycode",
      (id, alias) => {
        const raw = `https://${alias}.example/login`;
        const browserHost = new URL(raw).hostname;
        const result = matchBrandInUrl(normalizeDomain(browserHost), browserHost);

        expect(result.evidence.some((item) => item.brandId === id)).toBe(true);
      },
    );

    it.each(OFFICIAL_DOMAIN_CASES)(
      "keeps DNS-absolute official domain %s/%s trusted",
      (_id, domain) => {
        const raw = `https://${domain}./login`;
        expect(matchBrandInUrl(normalizeDomain(raw), raw).detected).toBe(false);
      },
    );
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

  it("detects a registered Cyrillic alias beside a high-risk OTP request", () => {
    const result = matchBrandInText("анорбанк: enter your OTP code", [], ["asks_for_otp"]);

    expect(result.detected).toBe(true);
    expect(result.evidence[0]).toMatchObject({ brandId: "anorbank", matchedIn: "text" });
  });

  it.each(CYRILLIC_ALIAS_CASES)("matches registered Cyrillic text alias %s/%s", (id, alias) => {
    const result = matchBrandInText(`${alias}: enter your OTP code`, [], ["asks_for_otp"]);
    expect(result.evidence.some((item) => item.brandId === id)).toBe(true);
  });

  it("does not match a Cyrillic alias embedded inside a longer Unicode token", () => {
    expect(
      matchBrandInText("преанорбанкпост: enter your OTP code", [], ["asks_for_otp"]).detected,
    ).toBe(false);
  });
});
