import { createFileRoute } from "@tanstack/react-router";
import {
  ClockCounterClockwise,
  Database,
  DeviceMobile,
  EyeSlash,
  Lock,
  SealCheck,
  ShieldCheck,
  WarningDiamond,
} from "@phosphor-icons/react";
import { HOME_COPY } from "@/components/home/home-copy";
import { Callout, PageHero } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

const ICONS = [
  EyeSlash,
  Database,
  ClockCounterClockwise,
  DeviceMobile,
  SealCheck,
  ShieldCheck,
  WarningDiamond,
] as const;

const TEXT = {
  ru: {
    h_lead: "Приватность и",
    h_accent: "безопасность",
    sub: "Мы антискам-продукт. Защищать данные — это часть нашей работы.",
    sections: [
      {
        title: "Что мы НЕ просим",
        items: [
          "OTP и SMS-коды подтверждения.",
          "PIN-код карты.",
          "CVV / CVC карты.",
          "Полный номер банковской карты.",
          "Пароли от банка, почты, Telegram.",
          "Скан паспорта.",
        ],
      },
      {
        title: "Как мы работаем с данными",
        items: [
          "Номера и Telegram ID хешируются и хранятся в защищённом виде.",
          "В интерфейсе показывается только маскированная версия (например, +998 90 ••• •• 12).",
          "Тексты сообщений автоматически чистятся от карт, OTP и личных номеров.",
          "Скриншоты обрабатываются в памяти и удаляются; сохраняться может только очищенный текст и результат проверки.",
          "Жалобы проходят модерацию перед тем, как влиять на публичную оценку риска.",
        ],
      },
      {
        title: "Сроки хранения",
        items: [
          "Очищенные проверки хранятся до 90 дней, сессии Telegram — до 30 дней после последней активности.",
          "Закрытые жалобы хранятся до 365 дней, незавершённые новые/проверяемые — до 180 дней.",
          "Апелляции содержат только хеш, маску и очищенный текст; окончательный срок для них требует отдельного юридического решения.",
        ],
      },
      {
        title: "Что хранится на вашем устройстве",
        items: [
          "Выбранный язык сайта — в cookie ig_lang (ru, uz или en) на 1 год, чтобы страницы сразу открывались на вашем языке. Пока вы не выбрали язык, сайт ориентируется на язык браузера и ничего не сохраняет.",
          "Настройки доступности (размер шрифта и контраст) — только в памяти вашего браузера.",
          "Эти данные не используются для рекламы и не передаются сторонним сервисам; сторонних счётчиков на сайте нет.",
        ],
      },
      {
        title: "Исправление публичной репутации",
        items: [
          "Через /appeal в Telegram можно запросить проверку или снятие публичной метки.",
          "Решение принимает модератор, а изменение записывается в журнал действий.",
          "Для апелляции не отправляйте паспорт, пароль, код, PIN, CVV или полный номер карты.",
        ],
      },
      {
        title: "Что мы НЕ публикуем",
        items: [
          "Имя владельца номера, фото, адрес.",
          "Личные данные людей, на которых пожаловались.",
          "Прямые обвинения конкретного человека.",
        ],
      },
      {
        title: "Дисклеймер",
        items: [
          "Ishonch Guard помогает оценить риск, но не заменяет банк, правоохранительные органы или юридическую консультацию.",
        ],
      },
    ],
  },
  uz: {
    h_lead: "Maxfiylik va",
    h_accent: "xavfsizlik",
    sub: "Biz antiskam mahsulotmiz. Ma’lumotlarni himoya qilish — bizning ishimizning bir qismi.",
    sections: [
      {
        title: "Biz HECH QACHON so‘ramaymiz",
        items: [
          "OTP va SMS tasdiqlash kodlari.",
          "Karta PIN kodi.",
          "Karta CVV / CVC.",
          "To‘liq karta raqami.",
          "Bank, pochta yoki Telegram parollari.",
          "Pasport nusxasi.",
        ],
      },
      {
        title: "Ma’lumotlar bilan qanday ishlaymiz",
        items: [
          "Raqam va Telegram ID xeshlanadi hamda himoyalangan tarzda saqlanadi.",
          "Interfeysda faqat maskalangan ko‘rinish ko‘rsatiladi.",
          "Xabar matnlaridagi karta, OTP va shaxsiy raqamlar avtomatik tozalanadi.",
          "Skrinshotlar xotirada qayta ishlanib o‘chiriladi; faqat tozalangan matn va tekshiruv natijasi saqlanishi mumkin.",
          "Shikoyatlar ommaviy xavf bahosiga ta’sir qilishidan oldin moderatsiyadan o‘tadi.",
        ],
      },
      {
        title: "Saqlash muddatlari",
        items: [
          "Tozalangan tekshiruvlar 90 kungacha, Telegram sessiyalari oxirgi faollikdan keyin 30 kungacha saqlanadi.",
          "Yakunlangan shikoyatlar 365 kungacha, tugallanmagan yangi va ko‘rib chiqilayotgan shikoyatlar 180 kungacha saqlanadi.",
          "Apellyatsiyada faqat xesh, maska va tozalangan matn qoladi; yakuniy muddat alohida yuridik qarorni talab qiladi.",
        ],
      },
      {
        title: "Qurilmangizda nima saqlanadi",
        items: [
          "Tanlangan sayt tili — ig_lang cookie faylida (ru, uz yoki en) 1 yil saqlanadi, sahifalar darhol sizning tilingizda ochilishi uchun. Til tanlanmaguncha sayt brauzer tiliga qaraydi va hech narsa saqlamaydi.",
          "Maxsus imkoniyatlar sozlamalari (shrift o‘lchami va kontrast) — faqat brauzeringiz xotirasida.",
          "Bu ma’lumotlar reklama uchun ishlatilmaydi va uchinchi tomon xizmatlariga berilmaydi; saytda begona hisoblagichlar yo‘q.",
        ],
      },
      {
        title: "Ommaviy reputatsiyani tuzatish",
        items: [
          "Telegram’dagi /appeal orqali ommaviy belgini tekshirish yoki olib tashlashni so‘rash mumkin.",
          "Qarorni moderator qabul qiladi va o‘zgarish audit jurnaliga yoziladi.",
          "Apellyatsiya uchun pasport, parol, kod, PIN, CVV yoki to‘liq karta raqamini yubormang.",
        ],
      },
      {
        title: "Biz E’LON QILMAYMIZ",
        items: [
          "Raqam egasining ismi, fotosi, manzili.",
          "Shikoyat qilingan odamlarning shaxsiy ma’lumotlari.",
          "Aniq odamga qaratilgan ochiq ayblovlar.",
        ],
      },
      {
        title: "Eslatma",
        items: [
          "Ishonch Guard xavfni baholashga yordam beradi, lekin bank, huquq idoralari yoki yuridik maslahat o‘rnini bosmaydi.",
        ],
      },
    ],
  },
  en: {
    h_lead: "Privacy and",
    h_accent: "security",
    sub: "We're an anti-scam product. Protecting your data is part of the job.",
    sections: [
      {
        title: "What we NEVER ask for",
        items: [
          "OTP and SMS confirmation codes.",
          "Card PIN.",
          "Card CVV / CVC.",
          "Full card number.",
          "Passwords for bank, email or Telegram.",
          "Passport scans.",
        ],
      },
      {
        title: "How we handle data",
        items: [
          "Numbers and Telegram IDs are hashed and stored in a protected form.",
          "The UI only shows a masked version (e.g. +998 90 ••• •• 12).",
          "Message text is automatically cleaned of card numbers, OTPs and personal phone numbers.",
          "Screenshots are processed in memory and discarded; only cleaned text and the check result may be retained.",
          "Reports go through moderation before they affect any public risk score.",
        ],
      },
      {
        title: "Retention periods",
        items: [
          "Cleaned checks are retained for up to 90 days; Telegram sessions for up to 30 days after last activity.",
          "Terminal reports are retained for up to 365 days; stale new/reviewing reports for up to 180 days.",
          "Appeals retain only a hash, masked display and cleaned text; their final period still requires a separate legal decision.",
        ],
      },
      {
        title: "What is stored on your device",
        items: [
          "Your chosen site language — in the ig_lang cookie (ru, uz or en) for 1 year, so pages open in your language straight away. Until you choose, the site follows your browser's language and stores nothing.",
          "Accessibility settings (text size and contrast) — only in your browser's storage.",
          "This data is not used for advertising and is not shared with third-party services; the site has no third-party trackers.",
        ],
      },
      {
        title: "Correcting public reputation",
        items: [
          "Use /appeal in Telegram to request review or removal of a public label.",
          "A moderator decides and the change is recorded in the audit log.",
          "Never send a passport, password, code, PIN, CVV or full card number as appeal evidence.",
        ],
      },
      {
        title: "What we NEVER publish",
        items: [
          "The phone owner's name, photo or address.",
          "Personal data of reported people.",
          "Direct accusations against a specific person.",
        ],
      },
      {
        title: "Disclaimer",
        items: [
          "Ishonch Guard helps assess risk but does not replace your bank, law enforcement or legal advice.",
        ],
      },
    ],
  },
} as const;

// Sections 1 and 6 list what we never ask for / never publish.
const NEGATIVE_SECTIONS = new Set([0, 5]);

function PrivacyPage() {
  const { lang } = useLang();
  const data = TEXT[lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <PageHero
          icon={<Lock weight="bold" />}
          eyebrow={{ ru: "Приватность", uz: "Maxfiylik", en: "Privacy" }[lang]}
          title={[data.h_lead, `${data.h_accent}.`]}
          lead={data.sub}
          aside={
            <Callout
              tone="ok"
              icon={<ShieldCheck weight="fill" />}
              title={HOME_COPY[lang].hero.privacy}
            >
              <p>{HOME_COPY[lang].hero.chips.slice(0, 3).join(" · ")}</p>
            </Callout>
          }
        />

        <div className="vp-privacy-grid vp-page-section">
          {data.sections.map((section, index) => {
            const Icon = ICONS[index % ICONS.length];
            const negative = NEGATIVE_SECTIONS.has(index);
            return (
              <article
                // The closing disclaimer spans the row, so 7 cards never leave one alone.
                className={
                  index === data.sections.length - 1 ? "vp-card vp-privacy-wide" : "vp-card"
                }
                key={section.title}
              >
                <div className="vp-card-top">
                  <span className="vp-card-icon" aria-hidden="true">
                    <Icon weight="bold" />
                  </span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h2 className="vp-card-title">{section.title}</h2>
                <ul className={`vp-list ${negative ? "vp-list--no" : "vp-list--dot"}`}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
