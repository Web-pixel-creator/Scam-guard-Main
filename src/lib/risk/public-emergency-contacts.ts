import type { Lang } from "@/lib/i18n";
import { findVerifiedContact } from "@/lib/risk/verified-contacts";

const PUBLIC_EMERGENCY_CONTACT_IDS = ["102", "+998712000044", "1257"] as const;

export interface PublicEmergencyContact {
  dial: string;
  number: string;
  title: string;
  note: string;
}

/**
 * Homepage emergency contacts must come from the verified callback directory.
 * This prevents stale or unverified short codes from being copied into public UI.
 */
export function getPublicEmergencyContacts(lang: Lang): readonly PublicEmergencyContact[] {
  return PUBLIC_EMERGENCY_CONTACT_IDS.map((id) => {
    const contact = findVerifiedContact(id);
    if (!contact) {
      throw new Error(`Missing verified public emergency contact: ${id}`);
    }

    return {
      dial: contact.normalized,
      number: contact.display,
      title: contact.org[lang],
      note: contact.description[lang],
    };
  });
}
