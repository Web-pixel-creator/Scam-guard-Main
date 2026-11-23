import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Bank,
  Buildings,
  CellSignalFull,
  Copy,
  DeviceMobile,
  EnvelopeSimple,
  MagnifyingGlass,
  Phone,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import { Pill, RowHead } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import { localizeContactSource } from "@/lib/contact-source-label";
import type { Lang } from "@/lib/i18n";
import {
  getActiveVerifiedContacts,
  type OrgType,
  type VerifiedContact,
} from "@/lib/risk/verified-contacts";
import {
  CONTACT_TYPE_LABELS,
  filterOfficialContacts,
  getContactAction,
  getOfficialDirectoryStats,
  isUrlSource,
  OFFICIAL_CONTACT_FILTERS,
  ORG_TYPE_LABELS,
  type OfficialContactFilter,
  USAGE_CONTEXT_LABELS,
} from "@/lib/trust/official-directory";

const FILTER_LABELS: Record<OfficialContactFilter, Record<Lang, string>> = {
  all: { ru: "Все", uz: "Hammasi", en: "All" },
  bank: ORG_TYPE_LABELS.bank,
  payment_system: ORG_TYPE_LABELS.payment_system,
  telecom: ORG_TYPE_LABELS.telecom,
  government: ORG_TYPE_LABELS.government,
  cybersecurity: ORG_TYPE_LABELS.cybersecurity,
};

const ORG_TYPE_ICONS: Record<OrgType, typeof Bank> = {
  bank: Bank,
  payment_system: DeviceMobile,
  telecom: CellSignalFull,
  government: Buildings,
  cybersecurity: ShieldWarning,
};

// Label/description captions avoid Russian number agreement ("21 организаций").
const STAT_COPY: Record<Lang, readonly (readonly [string, string])[]> = {
  ru: [
    ["Проверенные контакты", "Номера и короткие коды — только из официальных источников."],
    ["Организации", "Банки, платёжные системы, операторы и госслужбы."],
    ["Банки и платёжные линии", "Номера, по которым можно перезвонить самому."],
  ],
  uz: [
    ["Tasdiqlangan kontaktlar", "Raqamlar va qisqa kodlar — faqat rasmiy manbalardan."],
    ["Tashkilotlar", "Banklar, to‘lov tizimlari, operatorlar va davlat xizmatlari."],
    ["Bank va to‘lov liniyalari", "O‘zingiz qayta qo‘ng‘iroq qilishingiz mumkin bo‘lgan raqamlar."],
  ],
  en: [
    ["Verified contacts", "Numbers and short codes from official sources only."],
    ["Organisations", "Banks, payment systems, mobile operators and public services."],
    ["Bank and payment lines", "Numbers you can call back yourself."],
  ],
};

const TEXT = {
  ru: {
    listLabel: "Справочник",
    listNote: "Наберите номер вручную",
    search: "Поиск",
    placeholder: "Банк, номер, 1340, Uzcard, Ucell…",
    filters: "Тип организации",
    copy: "Копировать",
    copied: "Скопировано",
    source: "Источник",
    verified: "проверено",
    emptyTitle: "Контакт не найден",
    emptyText:
      "Проверьте номер или ссылку через анализатор. Мы не будем делать вывод по одному совпадению в тексте.",
    check: "Проверить",
  },
  uz: {
    listLabel: "Ma’lumotnoma",
    listNote: "Raqamni qo‘lda tering",
    search: "Qidirish",
    placeholder: "Bank, raqam, 1340, Uzcard, Ucell…",
    filters: "Tashkilot turi",
    copy: "Nusxa olish",
    copied: "Nusxalandi",
    source: "Manba",
    verified: "tekshirilgan",
    emptyTitle: "Kontakt topilmadi",
    emptyText:
      "Raqam yoki havolani analizator orqali tekshiring. Bitta matn mosligidan xulosa chiqarmaymiz.",
    check: "Tekshirish",
  },
  en: {
    listLabel: "Directory",
    listNote: "Dial the number manually",
    search: "Search",
    placeholder: "Bank, number, 1340, Uzcard, Ucell…",
    filters: "Organisation type",
    copy: "Copy",
    copied: "Copied",
    source: "Source",
    verified: "verified",
    emptyTitle: "No contact found",
    emptyText:
      "Check the number or link with the analyzer. We will not infer risk from a single text match.",
    check: "Check",
  },
} as const;

function ContactCard({ contact }: { contact: VerifiedContact }) {
  const { lang } = useLang();
  const text = TEXT[lang];
  const [copied, setCopied] = useState(false);
  const action = getContactAction(contact);
  const sourceIsLink = isUrlSource(contact.source);
  const Icon = ORG_TYPE_ICONS[contact.orgType];
  const ActionIcon =
    contact.contactType === "email"
      ? EnvelopeSimple
      : contact.contactType === "telegram"
        ? ArrowSquareOut
        : Phone;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contact.display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="vp-contact">
      <div className="vp-contact-head">
        <span className="vp-card-icon" aria-hidden="true">
          <Icon weight="bold" />
        </span>
        <div>
          <div className="vp-contact-name">
            <h3>{contact.org[lang]}</h3>
            <span className="vp-tag">{ORG_TYPE_LABELS[contact.orgType][lang]}</span>
          </div>
          <p>{contact.description[lang]}</p>
        </div>
      </div>

      <div className="vp-contact-body">
        <span className="vp-contact-kind">{CONTACT_TYPE_LABELS[contact.contactType][lang]}</span>
        <span className="vp-contact-number" translate="no">
          {contact.display}
        </span>
        <span className="vp-contact-usage">
          <ShieldCheck weight="fill" aria-hidden="true" />
          {USAGE_CONTEXT_LABELS[contact.usageContext][lang]}
        </span>
      </div>

      <div className="vp-contact-actions">
        {action && (
          <a
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noreferrer" : undefined}
            className="vp-pill vp-pill--dark vp-pill--small"
          >
            <span className="vp-pill-dot" aria-hidden="true">
              <ActionIcon weight="fill" />
            </span>
            {action.label[lang]}
            {/* Dozens of identical "Call" links: name each one for screen readers. */}
            <span className="sr-only">
              : {contact.display}, {contact.org[lang]}
            </span>
          </a>
        )}
        <button type="button" onClick={copy} className="vp-pill vp-pill--outline vp-pill--small">
          <span className="vp-pill-dot" aria-hidden="true">
            <Copy weight="bold" />
          </span>
          {copied ? text.copied : text.copy}
          <span className="sr-only">: {contact.display}</span>
        </button>
      </div>

      <p className="vp-contact-foot">
        <span>{text.source}:</span>{" "}
        {sourceIsLink ? (
          <a href={contact.source} target="_blank" rel="noreferrer">
            {contact.source}
          </a>
        ) : (
          localizeContactSource(contact.source, lang)
        )}
        <span aria-hidden="true"> · </span>
        {text.verified} {contact.verifiedAt}
      </p>
    </article>
  );
}

export function OfficialContactsDirectory() {
  const { lang } = useLang();
  const text = TEXT[lang];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OfficialContactFilter>("all");
  const stats = useMemo(() => getOfficialDirectoryStats(), []);
  const organisations = useMemo(
    () => new Set(getActiveVerifiedContacts().map((contact) => contact.org.ru)).size,
    [],
  );
  const contacts = useMemo(() => filterOfficialContacts(query, filter), [filter, query]);
  const numberFormat = new Intl.NumberFormat(
    lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US",
  );
  const statValues = [stats.total, organisations, stats.bank + stats.payment_system];

  return (
    <>
      <div className="vp-stats vp-page-section">
        {STAT_COPY[lang].map(([label, caption], index) => (
          <article key={label}>
            <div className="vp-stat-top">
              <span>{label}</span>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <b>{numberFormat.format(statValues[index])}</b>
            <p>{caption}</p>
          </article>
        ))}
      </div>

      <section className="vp-page-section" aria-labelledby="directory-list">
        <RowHead id="directory-list" label={text.listLabel} note={text.listNote} />
        <div className="vp-toolbar">
          <label className="vp-search">
            <MagnifyingGlass weight="bold" aria-hidden="true" />
            <span className="sr-only">{text.search}</span>
            <input
              className="vp-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.placeholder}
            />
          </label>
          <div className="vp-filters" role="group" aria-label={text.filters}>
            {OFFICIAL_CONTACT_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className="vp-filter"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {FILTER_LABELS[item][lang]}
              </button>
            ))}
          </div>
        </div>

        {contacts.length > 0 ? (
          <div className="vp-contacts">
            {contacts.map((contact) => (
              <ContactCard key={`${contact.contactType}:${contact.normalized}`} contact={contact} />
            ))}
          </div>
        ) : (
          <div className="vp-empty">
            <SealCheck weight="duotone" aria-hidden="true" />
            <h3>{text.emptyTitle}</h3>
            <p>{text.emptyText}</p>
            <Pill to="/check">{text.check}</Pill>
          </div>
        )}
      </section>
    </>
  );
}
