import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck, EyeOff, Database, FileWarning } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Приватность — Ishonch Guard" },
      { name: "description", content: "Как Ishonch Guard защищает ваши данные: маскирование, хеширование, никаких OTP, CVV и PIN." },
      { property: "og:title", content: "Приватность — Ishonch Guard" },
    ],
  }),
  component: PrivacyPage,
});

const ICONS = [EyeOff, Database, ShieldCheck, FileWarning] as const;

const TEXT = {
  ru: {
    h_lead: "Приватность и",
    h_accent: "безопасность",
    sub: "Мы антискам-продукт. Защищать данные — это часть нашей работы.",
    sections: [
      { title: "Что мы НЕ просим", items: [
        "OTP и SMS-коды подтверждения.",
        "PIN-код карты.",
        "CVV / CVC карты.",
        "Полный номер банковской карты.",
        "Пароли от банка, почты, Telegram.",
        "Скан паспорта.",
      ]},
      { title: "Как мы работаем с данными", items: [
        "Номера и Telegram ID хешируются и хранятся в защищённом виде.",
        "В интерфейсе показывается только маскированная версия (например, +998 90 ••• •• 12).",
        "Тексты сообщений автоматически чистятся от карт, OTP и личных номеров.",
        "Скриншоты, которые вы прикрепляете, не публикуются автоматически.",
        "Жалобы проходят модерацию перед тем, как влиять на публичный risk score.",
      ]},
      { title: "Что мы НЕ публикуем", items: [
        "Имя владельца номера, фото, адрес.",
        "Личные данные людей, на которых пожаловались.",
        "Прямые обвинения конкретного человека.",
      ]},
      { title: "Дисклеймер", items: [
        "Ishonch Guard помогает оценить риск, но не заменяет банк, правоохранительные органы или юридическую консультацию.",
      ]},
    ],
  },
  uz: {
    h_lead: "Maxfiylik va",
    h_accent: "xavfsizlik",
    sub: "Biz anti-skam mahsulotmiz. Ma'lumotlarni himoya qilish — bizning ishimizning bir qismi.",
    sections: [
      { title: "Biz HECHQACHON so'ramaymiz", items: [
        "OTP va SMS tasdiqlash kodlari.",
        "Karta PIN kodi.",
        "Karta CVV / CVC.",
        "To'liq karta raqami.",
        "Bank, pochta yoki Telegram parollari.",
        "Pasport nusxasi.",
      ]},
      { title: "Ma'lumotlar bilan qanday ishlaymiz", items: [
        "Raqam va Telegram ID xeshlanadi hamda himoyalangan tarzda saqlanadi.",
        "Interfeysda faqat maskalangan ko'rinish ko'rsatiladi.",
        "Xabar matnlaridagi karta, OTP va shaxsiy raqamlar avtomatik tozalanadi.",
        "Biriktirilgan skrinshotlar avtomatik ravishda e'lon qilinmaydi.",
        "Shikoyatlar publik risk score'ga ta'sir qilishidan oldin moderatsiyadan o'tadi.",
      ]},
      { title: "Biz E'LON QILMAYMIZ", items: [
        "Raqam egasining ismi, fotosi, manzili.",
        "Shikoyat qilingan odamlarning shaxsiy ma'lumotlari.",
        "Aniq odamga qaratilgan ochiq ayblovlar.",
      ]},
      { title: "Eslatma", items: [
        "Ishonch Guard xavfni baholashga yordam beradi, lekin bank, huquq idoralari yoki yuridik maslahat o'rnini bosmaydi.",
      ]},
    ],
  },
  en: {
    h_lead: "Privacy and",
    h_accent: "security",
    sub: "We're an anti-scam product. Protecting your data is part of the job.",
    sections: [
      { title: "What we NEVER ask for", items: [
        "OTP and SMS confirmation codes.",
        "Card PIN.",
        "Card CVV / CVC.",
        "Full card number.",
        "Passwords for bank, email or Telegram.",
        "Passport scans.",
      ]},
      { title: "How we handle data", items: [
        "Numbers and Telegram IDs are hashed and stored in a protected form.",
        "The UI only shows a masked version (e.g. +998 90 ••• •• 12).",
        "Message text is automatically cleaned of card numbers, OTPs and personal phone numbers.",
        "Screenshots you attach are not published automatically.",
        "Reports go through moderation before they affect any public risk score.",
      ]},
      { title: "What we NEVER publish", items: [
        "The phone owner's name, photo or address.",
        "Personal data of reported people.",
        "Direct accusations against a specific person.",
      ]},
      { title: "Disclaimer", items: [
        "Ishonch Guard helps assess risk but does not replace your bank, law enforcement or legal advice.",
      ]},
    ],
  },
} as const;

function PrivacyPage() {
  const { lang } = useLang();
  const data = TEXT[lang];

  return (
    <div className="apex-page space-y-8 sm:space-y-10">
      <div className="apex-card apex-frame apex-stripes">
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-[#F97316]" strokeWidth={2} aria-hidden="true" focusable="false" />
            {{ ru: "Приватность", uz: "Maxfiylik", en: "Privacy" }[lang]}
          </span>
          <span className="apex-mono text-right">
            <span className="hidden xs:inline">{{ ru: "Данные зашифрованы", uz: "Ma'lumotlar shifrlangan", en: "Data encrypted" }[lang]}</span>
            <span className="xs:hidden">{{ ru: "Зашифровано", uz: "Shifrlangan", en: "Encrypted" }[lang]}</span>
          </span>
        </div>

        <div className="max-w-3xl">
          <span className="pain-pill">
            <span className="pain-pill-dot" />
            {{ ru: "Боитесь, что данные утекут? Читайте, что мы НЕ делаем", uz: "Ma'lumotlar oqib ketishidan qo'rqasizmi? Biz NIMA qilmasligimizni o'qing", en: "Worried your data leaks? See what we never do" }[lang]}
          </span>
          <p className="label-md mb-3 sm:mb-4">04 — {{ ru: "Приватность", uz: "Maxfiylik", en: "Privacy" }[lang]}</p>
          <h1 className="apex-h1">
            {data.h_lead} <span className="font-serif-italic text-[#8B8B92]">{data.h_accent}</span>
          </h1>
          <p className="apex-lead mt-5 sm:mt-6">{data.sub}</p>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] rounded-[6px] overflow-hidden">
        {data.sections.map((s, idx) => {
          const Icon = ICONS[idx % ICONS.length];
          return (
            <article key={s.title} className="bg-white/90 backdrop-blur-[4px] p-6 sm:p-8 md:p-10 flex flex-col min-h-[260px] sm:min-h-[300px]">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <span className="apex-mono">0{idx + 1}</span>
                <div className="flex items-center justify-center w-9 h-9 rounded-[3px] border border-[#E2E0D8] text-[#F97316]">
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" focusable="false" />
                </div>
              </div>
              <h2 className="apex-h2 mb-4 sm:mb-5">{s.title}</h2>
              <ul className="space-y-3 text-[15.5px] leading-[1.7] text-[#3F3F46]">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[#F97316] mt-[8px] h-[3px] w-[3px] rounded-full bg-current shrink-0" aria-hidden />
                    <span className="prose-pretty">{it}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </div>
  );
}
