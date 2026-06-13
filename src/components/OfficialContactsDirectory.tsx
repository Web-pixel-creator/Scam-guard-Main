import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Copy,
  ExternalLink,
  Landmark,
  Mail,
  PhoneCall,
  RadioTower,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";
import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";
import type { OrgType, VerifiedContact } from "@/lib/risk/verified-contacts";
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

const ORG_TYPE_ICONS: Record<OrgType, typeof Building2> = {
  bank: Landmark,
  payment_system: Smartphone,
  telecom: RadioTower,
  government: Building2,
  cybersecurity: ShieldAlert,
};

function formatNumber(n: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US").format(
    n,
  );
}

function ContactIcon({ orgType }: { orgType: OrgType }) {
  const Icon = ORG_TYPE_ICONS[orgType];
  return <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />;
}

function ContactCard({ contact }: { contact: VerifiedContact }) {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const action = getContactAction(contact);
  const sourceIsLink = isUrlSource(contact.source);

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
    <article className="group relative rounded-[8px] border border-[#E2E0D8] bg-white p-4 sm:p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_10px_28px_-18px_rgba(11,11,15,0.28)] transition-colors hover:border-[#F97316]/70">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-[#D9E8DA] bg-[#F0FDF4] text-[#166534]">
          <ContactIcon orgType={contact.orgType} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold leading-tight text-[#18181B]">
              {contact.org[lang]}
            </h3>
            <span className="rounded-[4px] border border-[#E2E0D8] bg-[#F8F7F3] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#52525B]">
              {ORG_TYPE_LABELS[contact.orgType][lang]}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[#52525B]">
            {contact.description[lang]}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#71717A]">
            {CONTACT_TYPE_LABELS[contact.contactType][lang]}
          </p>
          <p className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-tight text-[#0B0B0F] tabular-nums">
            {contact.display}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#166534]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {USAGE_CONTEXT_LABELS[contact.usageContext][lang]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {action && (
            <a
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noreferrer" : undefined}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#0B0B0F] bg-[#0B0B0F] px-3 text-[13px] font-bold text-white transition-colors hover:bg-[#27272A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
            >
              {contact.contactType === "email" ? (
                <Mail aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              ) : contact.contactType === "telegram" ? (
                <ExternalLink aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              ) : (
                <PhoneCall aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              )}
              {action.label[lang]}
            </a>
          )}
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#E2E0D8] bg-[#F8F7F3] px-3 text-[13px] font-bold text-[#18181B] transition-colors hover:border-[#F97316] hover:text-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
          >
            <Copy aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            {copied
              ? { ru: "Скопировано", uz: "Nusxalandi", en: "Copied" }[lang]
              : { ru: "Копировать", uz: "Nusxa olish", en: "Copy" }[lang]}
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-[#E2E0D8] pt-3 text-[12px] leading-relaxed text-[#71717A]">
        <span className="font-semibold text-[#52525B]">
          {{ ru: "Источник", uz: "Manba", en: "Source" }[lang]}:
        </span>{" "}
        {sourceIsLink ? (
          <a
            href={contact.source}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#C2410C] underline decoration-[#FED7AA] underline-offset-4 hover:decoration-[#F97316]"
          >
            {contact.source}
          </a>
        ) : (
          contact.source
        )}
        <span className="mx-2 text-[#D4D4D8]">/</span>
        <span>
          {{ ru: "проверено", uz: "tekshirilgan", en: "verified" }[lang]} {contact.verifiedAt}
        </span>
      </div>
    </article>
  );
}

export function OfficialContactsDirectory() {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OfficialContactFilter>("all");
  const stats = useMemo(() => getOfficialDirectoryStats(), []);
  const contacts = useMemo(() => filterOfficialContacts(query, filter), [filter, query]);

  const statCards = [
    {
      value: stats.total,
      label: { ru: "проверенных контактов", uz: "tekshirilgan kontakt", en: "verified contacts" }[
        lang
      ],
    },
    {
      value: stats.callable,
      label: {
        ru: "номеров для обратного звонка",
        uz: "qayta qo'ng'iroq raqami",
        en: "callback numbers",
      }[lang],
    },
    {
      value: stats.bank + stats.payment_system,
      label: {
        ru: "банков и платёжных линий",
        uz: "bank va to'lov liniyalari",
        en: "bank/payment lines",
      }[lang],
    },
  ];

  return (
    <div className="space-y-7">
      <section className="rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-white text-[#C2410C]">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-[16px] font-bold text-[#18181B]">
              {
                {
                  ru: "Номер в справочнике не доказывает, что входящий звонок безопасен",
                  uz: "Raqam katalogda bo'lishi kiruvchi qo'ng'iroq xavfsizligini isbotlamaydi",
                  en: "A directory match does not prove an incoming call is safe",
                }[lang]
              }
            </h2>
            <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-[#52525B]">
              {
                {
                  ru: "Caller ID можно подделать. Если вам звонят и просят код, карту, PIN или приложение, положите трубку и наберите официальный номер сами.",
                  uz: "Caller ID soxtalashtirilishi mumkin. Kod, karta, PIN yoki ilova so'ralsa, go'shakni qo'ying va rasmiy raqamni o'zingiz tering.",
                  en: "Caller ID can be spoofed. If a caller asks for a code, card, PIN or app, hang up and dial the official number yourself.",
                }[lang]
              }
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-[8px] border border-[#E2E0D8] bg-white p-4">
            <p className="font-display text-[32px] font-extrabold leading-none tracking-tight text-[#0B0B0F] tabular-nums">
              {formatNumber(card.value, lang)}
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-[#52525B]">
              {card.label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-[8px] border border-[#E2E0D8] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717A]"
              strokeWidth={2}
            />
            <span className="sr-only">{{ ru: "Поиск", uz: "Qidirish", en: "Search" }[lang]}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-[6px] border border-[#E2E0D8] bg-[#FCFAF9] pl-10 pr-3 text-[14px] font-medium text-[#18181B] outline-none transition-colors placeholder:text-[#A1A1AA] focus:border-[#F97316] focus:bg-white"
              placeholder={
                {
                  ru: "Банк, номер, 1340, Uzcard, Ucell...",
                  uz: "Bank, raqam, 1340, Uzcard, Ucell...",
                  en: "Bank, number, 1340, Uzcard, Ucell...",
                }[lang]
              }
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {OFFICIAL_CONTACT_FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "h-10 shrink-0 rounded-[6px] border px-3 text-[12.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]",
                  filter === item
                    ? "border-[#0B0B0F] bg-[#0B0B0F] text-white"
                    : "border-[#E2E0D8] bg-[#F8F7F3] text-[#52525B] hover:border-[#F97316] hover:text-[#C2410C]",
                )}
              >
                {FILTER_LABELS[item][lang]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {contacts.length > 0 ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contacts.map((contact) => (
            <ContactCard key={`${contact.contactType}:${contact.normalized}`} contact={contact} />
          ))}
        </section>
      ) : (
        <section className="rounded-[8px] border border-[#E2E0D8] bg-white p-6 text-center">
          <BadgeCheck className="mx-auto h-8 w-8 text-[#A1A1AA]" strokeWidth={1.8} />
          <h2 className="mt-3 text-[18px] font-bold text-[#18181B]">
            {{ ru: "Контакт не найден", uz: "Kontakt topilmadi", en: "No contact found" }[lang]}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-[#52525B]">
            {
              {
                ru: "Проверьте номер или ссылку через анализатор. Мы не будем делать вывод по одному совпадению в тексте.",
                uz: "Raqam yoki havolani analizator orqali tekshiring. Bitta matn mosligidan xulosa chiqarmaymiz.",
                en: "Check the number or link with the analyzer. We will not infer risk from a single text match.",
              }[lang]
            }
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              to="/check"
              className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#0B0B0F] px-4 text-[13px] font-bold text-white hover:bg-[#27272A]"
            >
              {{ ru: "Проверить", uz: "Tekshirish", en: "Check" }[lang]}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
