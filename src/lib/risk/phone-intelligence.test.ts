import { describe, expect, it } from "vitest";

import { normalizePhone } from "./detect";
import { buildPhoneIntelligencePassport } from "./phone-intelligence";
import { findVerifiedContact } from "./verified-contacts";

describe("phone intelligence passport", () => {
  it("classifies an Uzbek mobile prefix without inferring an owner", () => {
    const passport = buildPhoneIntelligencePassport("+998 90 123 45 67", "+998901234567", null);

    expect(passport.kind).toBe("uz_mobile");
    expect(passport.isUzbekistan).toBe(true);
    expect(passport.country?.iso).toBe("UZ");
    expect(passport.uzPrefix).toBe("90");
    expect(passport.uzOperator?.ru).toContain("Beeline");
    expect(passport.officialDirectoryStatus).toBe("not_found");
  });

  it("detects foreign country codes for callback guidance", () => {
    const passport = buildPhoneIntelligencePassport("+49 30 123456", "+49 30 123456", null);

    expect(passport.kind).toBe("international");
    expect(passport.isUzbekistan).toBe(false);
    expect(passport.country?.iso).toBe("DE");
    expect(passport.country?.name.ru).toBe("Германия");
    expect(passport.uzOperator).toBeNull();
  });

  it("does not infer a country or international kind from incomplete unprefixed digits", () => {
    const raw = "12345678";
    const passport = buildPhoneIntelligencePassport(raw, normalizePhone(raw), null);

    expect(passport).toMatchObject({
      normalized: "12345678",
      kind: "unknown",
      isValidFormat: false,
      isUzbekistan: false,
      country: null,
      uzPrefix: null,
      uzOperator: null,
    });
  });

  it.each(["+12345678", "0012345678"])(
    "does not call an incomplete US/Canada number valid: %s",
    (raw) => {
      const passport = buildPhoneIntelligencePassport(
        raw,
        raw.startsWith("00") ? "+12345678" : raw,
        null,
      );
      expect(passport.country?.iso).toBe("US_CA");
      expect(passport.isValidFormat).toBe(false);
    },
  );

  it("keeps a full US/Canada number valid", () => {
    const raw = "+12025550123";
    const passport = buildPhoneIntelligencePassport(raw, raw, null);
    expect(passport.country?.iso).toBe("US_CA");
    expect(passport.isValidFormat).toBe(true);
  });

  it("preserves a full international number written with the 00 dialing prefix", () => {
    const raw = "0049 30 123456";
    const normalized = normalizePhone(raw);
    const passport = buildPhoneIntelligencePassport(raw, normalized, null);

    expect(normalized).toBe("+4930123456");
    expect(passport).toMatchObject({
      normalized: "+4930123456",
      kind: "international",
      isValidFormat: true,
      isUzbekistan: false,
    });
    expect(passport.country?.iso).toBe("DE");
  });

  it("preserves a nine-digit Uzbek local number", () => {
    const raw = "90 123 45 67";
    const normalized = normalizePhone(raw);
    const passport = buildPhoneIntelligencePassport(raw, normalized, null);

    expect(normalized).toBe("+998901234567");
    expect(passport).toMatchObject({
      kind: "uz_mobile",
      isValidFormat: true,
      isUzbekistan: true,
      uzPrefix: "90",
    });
    expect(passport.country?.iso).toBe("UZ");
  });

  it("marks verified short codes as matched official directory contacts", () => {
    const passport = buildPhoneIntelligencePassport("1340", "1340", {
      normalized: "1340",
      display: "1340",
      contactType: "short_code",
      org: { ru: "Капиталбанк", uz: "Kapitalbank", en: "Kapitalbank" },
      orgType: "bank",
      description: { ru: "Колл-центр", uz: "Call markaz", en: "Call center" },
      source: "official",
      verificationLevel: "high",
      usageContext: "support_line",
      verifiedAt: "2026-06-01",
    });

    expect(passport.kind).toBe("short_code");
    expect(passport.officialDirectoryStatus).toBe("matched");
    expect(passport.country?.iso).toBe("UZ");
    expect(passport.officialLookalike).toBeNull();
  });

  it("does not mark exact verified contacts as lookalikes", () => {
    const contact = findVerifiedContact("1340");
    const passport = buildPhoneIntelligencePassport("1340", "1340", contact);

    expect(passport.officialDirectoryStatus).toBe("matched");
    expect(passport.officialLookalike).toBeNull();
  });

  it("detects short-code near misses without claiming the number is fraudulent", () => {
    const passport = buildPhoneIntelligencePassport("1258", "1258", null);

    expect(passport.kind).toBe("short_code");
    expect(passport.officialDirectoryStatus).toBe("not_found");
    expect(passport.officialLookalike).toMatchObject({
      display: "1257",
      reason: "short_code_near_miss",
      confidence: "medium",
    });
    expect(passport.officialLookalike?.org.ru).toContain("UZCARD");
  });

  it("detects full-number near misses against verified full contacts", () => {
    const passport = buildPhoneIntelligencePassport("+998 71 203-00-24", "+998712030024", null);

    expect(passport.officialLookalike).toMatchObject({
      display: "+998 71 203-00-23",
      reason: "full_number_near_miss",
      confidence: "medium",
    });
    expect(passport.officialLookalike?.org.ru).toContain("UZCERT");
  });

  it("detects low-confidence full-number suffix resemblance to official short codes", () => {
    const passport = buildPhoneIntelligencePassport("+998 90 123-13-40", "+998901231340", null);

    expect(passport.officialLookalike).toMatchObject({
      display: "1340",
      reason: "short_code_suffix",
      confidence: "low",
    });
    expect(passport.officialLookalike?.org.ru).toContain("Капиталбанк");
  });

  it("does not label regular Uzbek mobile numbers as official lookalikes", () => {
    const passport = buildPhoneIntelligencePassport("+998 90 123 45 67", "+998901234567", null);

    expect(passport.officialDirectoryStatus).toBe("not_found");
    expect(passport.officialLookalike).toBeNull();
  });
});
