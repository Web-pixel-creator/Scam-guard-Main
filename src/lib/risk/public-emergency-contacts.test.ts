import { describe, expect, it } from "vitest";
import type { Lang } from "@/lib/i18n";
import { getPublicEmergencyContacts } from "@/lib/risk/public-emergency-contacts";
import { findVerifiedContact } from "@/lib/risk/verified-contacts";

const LANGS: readonly Lang[] = ["ru", "uz", "en"];

describe("public emergency contacts", () => {
  it.each(LANGS)("uses the same verified contact set for %s", (lang) => {
    const contacts = getPublicEmergencyContacts(lang);

    expect(contacts.map((contact) => contact.dial)).toEqual(["102", "+998712000044", "1257"]);
    expect(contacts.every((contact) => contact.number && contact.title && contact.note)).toBe(true);
  });

  it("does not expose the unverified 1252 or mislabel Safe Tourism 1173 as UZCARD", () => {
    const contacts = getPublicEmergencyContacts("ru");
    const publicNumbers = new Set(contacts.map((contact) => contact.dial));

    expect(publicNumbers.has("1252")).toBe(false);
    expect(publicNumbers.has("1173")).toBe(false);
    expect(findVerifiedContact("1173")?.org.en).toBe("Safe Tourism Call Centre");
    expect(findVerifiedContact("1257")?.org.en).toBe("UZCARD");
  });

  it("keeps every public contact backed by a high-confidence directory entry", () => {
    for (const contact of getPublicEmergencyContacts("en")) {
      const verified = findVerifiedContact(contact.dial);
      expect(verified?.verificationLevel).toBe("high");
      expect(verified?.usageContext).not.toBe("outbound_info");
    }
  });
});
