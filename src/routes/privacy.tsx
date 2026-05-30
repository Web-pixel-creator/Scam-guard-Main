import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
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

const TEXT = {
  ru: {
    h: "Приватность и безопасность",
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
    h: "Maxfiylik va xavfsizlik",
    sub: "Biz anti-skam mahsulotmiz. Ma’lumotlarni himoya qilish — bizning ishimizning bir qismi.",
    sections: [
      { title: "Biz HECHQACHON so‘ramaymiz", items: [
        "OTP va SMS tasdiqlash kodlari.",
        "Karta PIN kodi.",
        "Karta CVV / CVC.",
        "To‘liq karta raqami.",
        "Bank, pochta yoki Telegram parollari.",
        "Pasport nusxasi.",
      ]},
      { title: "Ma’lumotlar bilan qanday ishlaymiz", items: [
        "Raqam va Telegram ID xeshlanadi hamda himoyalangan tarzda saqlanadi.",
        "Interfeysda faqat maskalangan ko‘rinish ko‘rsatiladi.",
        "Xabar matnlaridagi karta, OTP va shaxsiy raqamlar avtomatik tozalanadi.",
        "Biriktirilgan skrinshotlar avtomatik ravishda e’lon qilinmaydi.",
        "Shikoyatlar publik risk score’ga ta’sir qilishidan oldin moderatsiyadan o‘tadi.",
      ]},
      { title: "Biz E’LON QILMAYMIZ", items: [
        "Raqam egasining ismi, fotosi, manzili.",
        "Shikoyat qilingan odamlarning shaxsiy ma’lumotlari.",
        "Aniq odamga qaratilgan ochiq ayblovlar.",
      ]},
      { title: "Eslatma", items: [
        "Ishonch Guard xavfni baholashga yordam beradi, lekin bank, huquq idoralari yoki yuridik maslahat o‘rnini bosmaydi.",
      ]},
    ],
  },
  en: {
    h: "Privacy & security",
    sub: "We’re an anti-scam product. Protecting your data is part of the job.",
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
        "The phone owner’s name, photo or address.",
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
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{data.h}</h1>
          <p className="mt-1 text-muted-foreground">{data.sub}</p>
        </div>
      </div>

      <div className="mt-10 space-y-5">
        {data.sections.map((s) => (
          <Card key={s.title} className="p-6">
            <h2 className="font-semibold">{s.title}</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {s.items.map((it, i) => (
                <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{it}</span></li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
