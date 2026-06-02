import { describe, it, expect } from "vitest";
import {
  findVerifiedContact,
  EMERGENCY_NUMBERS,
  VERIFIED_HOTLINES,
  ALL_VERIFIED_CONTACTS,
} from "./verified-contacts";

describe("verified-contacts", () => {
  describe("data integrity", () => {
    it("all contacts have ru/uz/en org and description", () => {
      for (const c of ALL_VERIFIED_CONTACTS) {
        expect(c.org.ru).toBeTruthy();
        expect(c.org.uz).toBeTruthy();
        expect(c.org.en).toBeTruthy();
        expect(c.description.ru).toBeTruthy();
        expect(c.description.uz).toBeTruthy();
        expect(c.description.en).toBeTruthy();
      }
    });

    it("emergency numbers are short codes (3-4 digits)", () => {
      for (const c of EMERGENCY_NUMBERS) {
        const digits = c.number.replace(/\D/g, "");
        expect(digits.length).toBeLessThanOrEqual(4);
        expect(digits.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("hotlines have source URLs or references", () => {
      for (const c of VERIFIED_HOTLINES) {
        expect(c.source.length).toBeGreaterThan(0);
      }
    });
  });

  describe("findVerifiedContact", () => {
    it("finds emergency number 102 (police)", () => {
      const result = findVerifiedContact("102");
      expect(result).not.toBeNull();
      expect(result!.org.en).toBe("Police");
      expect(result!.category).toBe("emergency");
    });

    it("finds short code 1233 (Kapitalbank)", () => {
      const result = findVerifiedContact("1233");
      expect(result).not.toBeNull();
      expect(result!.org.en).toBe("Kapitalbank");
      expect(result!.category).toBe("bank");
    });

    it("finds CBU hotline with +998 prefix", () => {
      const result = findVerifiedContact("+998712000044");
      expect(result).not.toBeNull();
      expect(result!.org.en).toContain("Central Bank");
    });

    it("finds CBU hotline without + (just digits)", () => {
      const result = findVerifiedContact("998712000044");
      expect(result).not.toBeNull();
      expect(result!.org.en).toContain("Central Bank");
    });

    it("finds CBU hotline with local format (no country code)", () => {
      const result = findVerifiedContact("712000044");
      expect(result).not.toBeNull();
      expect(result!.org.en).toContain("Central Bank");
    });

    it("returns null for unknown numbers", () => {
      expect(findVerifiedContact("+998901234567")).toBeNull();
      expect(findVerifiedContact("12345")).toBeNull();
      expect(findVerifiedContact("")).toBeNull();
    });

    it("handles numbers with formatting characters", () => {
      const result = findVerifiedContact("+998 71 200-00-44");
      expect(result).not.toBeNull();
      expect(result!.org.en).toContain("Central Bank");
    });

    it("finds unified emergency number 1199", () => {
      const result = findVerifiedContact("1199");
      expect(result).not.toBeNull();
      expect(result!.category).toBe("emergency");
    });

    it("finds tourist hotline 1173", () => {
      const result = findVerifiedContact("1173");
      expect(result).not.toBeNull();
      expect(result!.org.en).toContain("Safe Tourism");
    });
  });
});
