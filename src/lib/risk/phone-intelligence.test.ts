import { describe, expect, it } from "vitest";

import { buildPhoneIntelligencePassport } from "./phone-intelligence";

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
  });
});
