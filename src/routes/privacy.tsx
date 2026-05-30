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
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-10">
      <div className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] bg-white/55 p-6 sm:p-10 md:p-14">
        <div className="flex items-start justify-between gap-4 mb-6">
          <span className="apex-mono inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-[#F97316]" strokeWidth={2} />
            SYS · PRIVACY
          </span>
          <span className="apex-mono text-right">HASHED · MASKED</span>
        </div>

        <div className="max-w-3xl">
          <p className="label-md mb-4">04 — {{ ru: "Приватность", uz: "Maxfiylik", en: "Privacy" }[lang]}</p>
          <h1 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">
            {data.h_lead} <span className="font-serif-italic text-[#8B8B92]">{data.h_accent}</span>
          </h1>
          <p className="mt-6 text-[15px] md:text-[16px] text-[#52525B] leading-[1.65] max-w-xl text-pretty">{data.sub}</p>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] rounded-[6px] overflow-hidden">
        {data.sections.map((s, idx) => {
          const Icon = ICONS[idx % ICONS.length];
          return (
            <article key={s.title} className="bg-white/90 backdrop-blur-[4px] p-7 sm:p-9 md:p-10 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-8">
                <span className="apex-mono">0{idx + 1}</span>
                <div className="flex items-center justify-center w-9 h-9 rounded-[3px] border border-[#E2E0D8] text-[#F97316]">
                  <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" focusable="false" />
                </div>
              </div>
              <h2 className="font-sans text-[18px] md:text-[19px] font-medium tracking-tight text-[#18181B] mb-5 text-balance">{s.title}</h2>
              <ul className="space-y-2.5 text-[14.5px] leading-[1.65] text-[#52525B]">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[#F97316] mt-[8px] h-[3px] w-[3px] rounded-full bg-current shrink-0" aria-hidden />
                    <span className="text-pretty">{it}</span>
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
