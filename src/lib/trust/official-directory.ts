import type { Lang } from "@/lib/i18n";
import {
  getActiveVerifiedContacts,
  getVerifiedContactsCount,
  isVerifiedContactActive,
  type ContactType,
  type OrgType,
  type UsageContext,
  type VerifiedContact,
} from "@/lib/risk/verified-contacts";

export type OfficialContactFilter = "all" | OrgType;

export const OFFICIAL_CONTACT_FILTERS: readonly OfficialContactFilter[] = [
  "all",
  "bank",
  "payment_system",
  "telecom",
  "government",
  "cybersecurity",
];

export const ORG_TYPE_LABELS: Record<OrgType, Record<Lang, string>> = {
  bank: { ru: "Банки", uz: "Banklar", en: "Banks" },
  payment_system: { ru: "Платёжные системы", uz: "To'lov tizimlari", en: "Payment systems" },
  telecom: { ru: "Операторы", uz: "Operatorlar", en: "Telecoms" },
  government: { ru: "Госслужбы", uz: "Davlat xizmatlari", en: "Government" },
  cybersecurity: { ru: "Кибербезопасность", uz: "Kiberxavfsizlik", en: "Cybersecurity" },
};

export const CONTACT_TYPE_LABELS: Record<ContactType, Record<Lang, string>> = {
  phone: { ru: "Телефон", uz: "Telefon", en: "Phone" },
  short_code: { ru: "Короткий номер", uz: "Qisqa raqam", en: "Short code" },
  toll_free: { ru: "Бесплатный номер", uz: "Bepul raqam", en: "Toll-free" },
  email: { ru: "Email", uz: "Email", en: "Email" },
  telegram: { ru: "Telegram", uz: "Telegram", en: "Telegram" },
};

export const USAGE_CONTEXT_LABELS: Record<UsageContext, Record<Lang, string>> = {
  callback_only: {
    ru: "Только для безопасного обратного звонка",
    uz: "Faqat xavfsiz qayta qo'ng'iroq uchun",
    en: "Safe callback only",
  },
  support_line: { ru: "Поддержка", uz: "Qo'llab-quvvatlash", en: "Support" },
  hotline: { ru: "Горячая линия", uz: "Ishonch telefoni", en: "Hotline" },
  incident_report: {
    ru: "Сообщить об инциденте",
    uz: "Hodisa haqida xabar",
    en: "Incident report",
  },
  outbound_info: {
    ru: "Официальный информационный канал",
    uz: "Rasmiy axborot kanali",
    en: "Official information channel",
  },
};

export interface OfficialDirectoryStats {
  total: number;
  callable: number;
  bank: number;
  payment_system: number;
  telecom: number;
  government: number;
  cybersecurity: number;
}

export interface ContactAction {
  href: string;
  label: Record<Lang, string>;
  external?: boolean;
}

export function isCallableContact(contact: VerifiedContact): boolean {
  return ["phone", "short_code", "toll_free"].includes(contact.contactType);
}

export function isUrlSource(source: string): boolean {
  return /^https?:\/\//i.test(source.trim());
}

export function getOfficialDirectoryStats(): OfficialDirectoryStats {
  const stats: OfficialDirectoryStats = {
    total: getVerifiedContactsCount(),
    callable: 0,
    bank: 0,
    payment_system: 0,
    telecom: 0,
    government: 0,
    cybersecurity: 0,
  };

  for (const contact of getActiveVerifiedContacts()) {
    stats[contact.orgType] += 1;
    if (isCallableContact(contact)) stats.callable += 1;
  }

  return stats;
}

export function getContactAction(contact: VerifiedContact): ContactAction | null {
  if (!isVerifiedContactActive(contact)) return null;

  if (isCallableContact(contact)) {
    return {
      href: `tel:${contact.display.replace(/[^\d+]/g, "")}`,
      label: { ru: "Позвонить", uz: "Qo'ng'iroq", en: "Call" },
    };
  }

  if (contact.contactType === "telegram") {
    const handle = contact.normalized.replace(/^@/, "");
    return {
      href: `https://t.me/${handle}`,
      label: { ru: "Открыть Telegram", uz: "Telegramni ochish", en: "Open Telegram" },
      external: true,
    };
  }

  if (contact.contactType === "email") {
    return {
      href: `mailto:${contact.normalized}`,
      label: { ru: "Написать", uz: "Yozish", en: "Email" },
    };
  }

  return null;
}

function contactSearchText(contact: VerifiedContact): string {
  return [
    contact.display,
    contact.normalized,
    contact.source,
    contact.org.ru,
    contact.org.uz,
    contact.org.en,
    contact.description.ru,
    contact.description.uz,
    contact.description.en,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterOfficialContacts(
  query: string,
  filter: OfficialContactFilter = "all",
): VerifiedContact[] {
  const normalizedQuery = query.trim().toLowerCase();

  return getActiveVerifiedContacts().filter((contact) => {
    if (filter !== "all" && contact.orgType !== filter) return false;
    if (!normalizedQuery) return true;
    return contactSearchText(contact).includes(normalizedQuery);
  });
}
