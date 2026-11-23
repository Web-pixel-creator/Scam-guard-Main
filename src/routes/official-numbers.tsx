import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, ShieldCheck } from "@phosphor-icons/react";
import { OfficialContactsDirectory } from "@/components/OfficialContactsDirectory";
import { Callout, PageHero } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/official-numbers")({
  component: OfficialNumbersPage,
});

const COPY = {
  ru: {
    eyebrow: "Официальные номера",
    title: ["Перезванивайте сами.", "По номеру из справочника."],
    lead: "Если вам звонят от имени банка, оператора или службы поддержки, **не продолжайте разговор под давлением**. Найдите контакт здесь и **наберите его вручную**.",
    asideTitle: "Входящий номер может быть подделан",
    asideText:
      "Совпадение в справочнике — это не разрешение диктовать код. Безопасно: положить трубку и перезвонить самому.",
    asideLink: "Проверить подозрительный номер",
  },
  uz: {
    eyebrow: "Rasmiy raqamlar",
    title: ["O‘zingiz qayta qo‘ng‘iroq qiling.", "Ma’lumotnomadagi raqamga."],
    lead: "Bank, operator yoki qo‘llab-quvvatlash nomidan qo‘ng‘iroq qilishsa, **bosim ostida suhbatni davom ettirmang**. Kontaktni shu yerda toping va **uni qo‘lda tering**.",
    asideTitle: "Kiruvchi raqam soxtalashtirilishi mumkin",
    asideText:
      "Katalogdagi moslik kod aytish mumkin degani emas. Xavfsiz yo‘l: go‘shakni qo‘yib, o‘zingiz qayta qo‘ng‘iroq qilish.",
    asideLink: "Shubhali raqamni tekshirish",
  },
  en: {
    eyebrow: "Official numbers",
    title: ["Call back yourself.", "Using a number from the directory."],
    lead: "If someone calls as a bank, telecom or support service, **don’t stay on the line under pressure**. Find the contact here and **dial it manually**.",
    asideTitle: "Incoming caller ID can be spoofed",
    asideText:
      "A directory match is not permission to share a code. The safe move is to hang up and call back yourself.",
    asideLink: "Check a suspicious number",
  },
} as const;

function OfficialNumbersPage() {
  const { lang } = useLang();
  const copy = COPY[lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <PageHero
          icon={<ShieldCheck weight="bold" />}
          eyebrow={copy.eyebrow}
          title={copy.title}
          lead={copy.lead}
          aside={
            <Callout tone="alert" icon={<PhoneCall weight="bold" />} title={copy.asideTitle}>
              <p>{copy.asideText}</p>
              <Link to="/check" className="vp-callout-link">
                {/* The arrow stays glued to the last word so it never wraps alone. */}
                {copy.asideLink.slice(0, copy.asideLink.lastIndexOf(" ") + 1)}
                <span className="vp-nowrap">
                  {copy.asideLink.slice(copy.asideLink.lastIndexOf(" ") + 1)}
                  <ArrowRight weight="bold" aria-hidden="true" />
                </span>
              </Link>
            </Callout>
          }
        />
        <OfficialContactsDirectory />
      </div>
    </div>
  );
}
