import { describe, it, expect } from "vitest";
import {
  findVerifiedContact,
  getActiveVerifiedContacts,
  getVerifiedContactsCount,
  isVerifiedContactActive,
  TELEGRAM_CONTACT_MAX_AGE_DAYS,
  VERIFIED_CONTACTS,
  type VerifiedContact,
} from "./verified-contacts";

describe("verified-contacts seed data integrity", () => {
  it("contains at least 25 entries (target seed size)", () => {
    expect(getVerifiedContactsCount()).toBeGreaterThanOrEqual(25);
  });

  it("all entries have trilingual org and description", () => {
    for (const c of VERIFIED_CONTACTS) {
      expect(c.org.ru, `${c.normalized} org.ru`).toBeTruthy();
      expect(c.org.uz, `${c.normalized} org.uz`).toBeTruthy();
      expect(c.org.en, `${c.normalized} org.en`).toBeTruthy();
      expect(c.description.ru, `${c.normalized} desc.ru`).toBeTruthy();
      expect(c.description.uz, `${c.normalized} desc.uz`).toBeTruthy();
      expect(c.description.en, `${c.normalized} desc.en`).toBeTruthy();
    }
  });

  it("all entries have a source reference", () => {
    for (const c of VERIFIED_CONTACTS) {
      expect(c.source.length, `${c.normalized} source`).toBeGreaterThan(0);
    }
  });

  it("all entries have verificationLevel and usageContext", () => {
    for (const c of VERIFIED_CONTACTS) {
      expect(["high", "medium"]).toContain(c.verificationLevel);
      expect([
        "callback_only",
        "support_line",
        "hotline",
        "incident_report",
        "outbound_info",
      ]).toContain(c.usageContext);
    }
  });

  it("all entries have a valid verifiedAt date", () => {
    for (const c of VERIFIED_CONTACTS) {
      expect(Date.parse(c.verifiedAt)).not.toBeNaN();
    }
  });

  it("short codes are ≤5 digits", () => {
    const shortCodes = VERIFIED_CONTACTS.filter((c) => c.contactType === "short_code");
    expect(shortCodes.length).toBeGreaterThan(0);
    for (const c of shortCodes) {
      const digits = c.normalized.replace(/\D/g, "");
      expect(digits.length, `${c.normalized}`).toBeLessThanOrEqual(5);
    }
  });

  it("full phone numbers start with +998 and have 12 digits total", () => {
    const phones = VERIFIED_CONTACTS.filter((c) => c.contactType === "phone");
    expect(phones.length).toBeGreaterThan(0);
    for (const c of phones) {
      expect(c.normalized, `${c.org.en}`).toMatch(/^\+998\d{9}$/);
    }
  });

  it("no duplicate normalized values", () => {
    const seen = new Set<string>();
    for (const c of VERIFIED_CONTACTS) {
      expect(seen.has(c.normalized), `duplicate: ${c.normalized}`).toBe(false);
      seen.add(c.normalized);
    }
  });

  it("covers all required org types", () => {
    const types = new Set(VERIFIED_CONTACTS.map((c) => c.orgType));
    expect(types.has("bank")).toBe(true);
    expect(types.has("telecom")).toBe(true);
    expect(types.has("government")).toBe(true);
    expect(types.has("payment_system")).toBe(true);
    expect(types.has("cybersecurity")).toBe(true);
  });
});

describe("findVerifiedContact lookup", () => {
  it("finds emergency 102 (police)", () => {
    const r = findVerifiedContact("102");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Police");
    expect(r!.orgType).toBe("government");
  });

  it("finds short code 1340 (Kapitalbank)", () => {
    const r = findVerifiedContact("1340");
    expect(r).not.toBeNull();
    expect(r!.org.en).toBe("Kapitalbank");
    expect(r!.orgType).toBe("bank");
  });

  it("finds CBU hotline with +998 prefix", () => {
    const r = findVerifiedContact("+998712000044");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Central Bank");
  });

  it("finds CBU hotline from just local digits (712000044)", () => {
    const r = findVerifiedContact("712000044");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Central Bank");
  });

  it("finds number with formatting (spaces, dashes)", () => {
    const r = findVerifiedContact("+998 71 200-00-44");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Central Bank");
  });

  it("finds Beeline short code 0611", () => {
    const r = findVerifiedContact("0611");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Beeline");
  });

  it("finds UZCARD 1257", () => {
    const r = findVerifiedContact("1257");
    expect(r).not.toBeNull();
    expect(r!.org.en).toBe("UZCARD");
    expect(r!.orgType).toBe("payment_system");
  });

  it("finds Mobiuz 0890", () => {
    const r = findVerifiedContact("0890");
    expect(r).not.toBeNull();
    expect(r!.org.en).toBe("Mobiuz");
  });

  it("finds UZCERT phone", () => {
    const r = findVerifiedContact("+998712030023");
    expect(r).not.toBeNull();
    expect(r!.org.en).toBe("UZCERT");
    expect(r!.orgType).toBe("cybersecurity");
  });

  it("does not strip country code into official short codes", () => {
    expect(findVerifiedContact("+9981340")).toBeNull();
    expect(findVerifiedContact("+998102")).toBeNull();
    expect(findVerifiedContact("+9981257")).toBeNull();
  });

  it("finds gov.uz trust phone 1007 (Prosecutor General)", () => {
    const r = findVerifiedContact("1007");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("Prosecutor");
  });

  it("returns null for unknown numbers", () => {
    expect(findVerifiedContact("+998901234567")).toBeNull();
    expect(findVerifiedContact("9999")).toBeNull();
    expect(findVerifiedContact("")).toBeNull();
    expect(findVerifiedContact("abc")).toBeNull();
  });

  it("expires mutable Telegram handles after the freshness window", () => {
    const telegram = VERIFIED_CONTACTS.find((contact) => contact.contactType === "telegram");
    expect(telegram).toBeDefined();

    const verifiedAt = Date.parse(telegram!.verifiedAt);
    expect(isVerifiedContactActive(telegram!, verifiedAt + 29 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(
      isVerifiedContactActive(
        telegram!,
        verifiedAt + (TELEGRAM_CONTACT_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000,
      ),
    ).toBe(false);
    expect(
      getActiveVerifiedContacts(
        verifiedAt + (TELEGRAM_CONTACT_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000,
      ),
    ).not.toContain(telegram);
  });

  it("does not treat an expired Telegram handle as verified", () => {
    expect(findVerifiedContact("@naboruz")).toBeNull();
  });

  it("finds NBU 1344", () => {
    const r = findVerifiedContact("1344");
    expect(r).not.toBeNull();
    expect(r!.org.en).toContain("National Bank");
  });

  it("finds HUMO full number", () => {
    const r = findVerifiedContact("+998788888585");
    expect(r).not.toBeNull();
    expect(r!.org.en).toBe("HUMO");
    expect(r!.orgType).toBe("payment_system");
  });
});
