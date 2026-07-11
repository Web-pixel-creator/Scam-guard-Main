import { describe, expect, it } from "vitest";
import {
  VERIFIED_CONTACTS,
  getActiveVerifiedContacts,
  getVerifiedContactsCount,
} from "@/lib/risk/verified-contacts";
import {
  filterOfficialContacts,
  getContactAction,
  getOfficialDirectoryStats,
  isCallableContact,
  isUrlSource,
} from "./official-directory";

describe("official-directory helpers", () => {
  it("returns every verified contact without query or filter", () => {
    expect(filterOfficialContacts("", "all")).toHaveLength(getVerifiedContactsCount());
  });

  it("filters contacts by organization type", () => {
    const banks = filterOfficialContacts("", "bank");
    expect(banks.length).toBeGreaterThan(0);
    expect(banks.every((contact) => contact.orgType === "bank")).toBe(true);
  });

  it("searches across display values and organization names case-insensitively", () => {
    const byNumber = filterOfficialContacts("1340", "all");
    expect(byNumber.some((contact) => contact.org.en === "Kapitalbank")).toBe(true);

    const byName = filterOfficialContacts("kapital", "all");
    expect(byName.some((contact) => contact.display === "1340")).toBe(true);
  });

  it("builds tel actions only for callable contacts", () => {
    const callable = getActiveVerifiedContacts().find(isCallableContact);
    expect(callable).toBeDefined();
    expect(getContactAction(callable!)?.href.startsWith("tel:")).toBe(true);

    const telegram = VERIFIED_CONTACTS.find((contact) => contact.contactType === "telegram");
    expect(telegram).toBeDefined();
    expect(getContactAction(telegram!)).toBeNull();
    expect(filterOfficialContacts("naboruz", "all")).toEqual([]);
  });

  it("computes stable public directory stats", () => {
    const stats = getOfficialDirectoryStats();
    expect(stats.total).toBe(getVerifiedContactsCount());
    expect(stats.callable).toBe(
      getActiveVerifiedContacts().filter((contact) =>
        ["phone", "short_code", "toll_free"].includes(contact.contactType),
      ).length,
    );
  });

  it("recognizes only absolute http sources as source links", () => {
    expect(isUrlSource("https://cbu.uz/en/contacts/helpline/")).toBe(true);
    expect(isUrlSource("gov.uz official trust phone list")).toBe(false);
  });
});
