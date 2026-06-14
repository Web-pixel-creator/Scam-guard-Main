import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Home,
  ListChecks,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { submitReputationAppeal } from "@/lib/reputation-appeal.functions";

export const Route = createFileRoute("/appeal")({
  head: () => ({
    meta: [
      { title: "Апелляция репутации — Ishonch Guard" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Запросить проверку, исправление или снятие публичной репутационной метки Ishonch Guard.",
      },
    ],
    links: [{ rel: "canonical", href: "/appeal" }],
  }),
  component: AppealPage,
});

function AppealPage() {
  const { lang } = useLang();
  const router = useRouter();
  const submit = useServerFn(submitReputationAppeal);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"new" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGoBackRef = useRef<boolean>(
    typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      window.history.length > 1 &&
      !!document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })(),
  );

  const copy = {
    title: {
      ru: "Исправить репутационную запись",
      uz: "Reputatsiya yozuvini tekshirtirish",
      en: "Correct a reputation record",
    },
    subtitle: {
      ru: "Эта форма нужна только для исправления уже существующей публичной метки Ishonch Guard. Новые случаи мошенничества отправляйте как жалобу — так модератор получит правильный контекст.",
      uz: "Bu forma faqat Ishonch Guard'dagi mavjud ommaviy belgini tuzatish uchun. Yangi firibgarlik holatlarini shikoyat sifatida yuboring — moderator to'g'ri kontekst oladi.",
      en: "This form is only for correcting an existing public Ishonch Guard label. New scam incidents should be submitted as reports so moderators get the right context.",
    },
    useForTitle: { ru: "Используйте здесь", uz: "Bu yerda ishlating", en: "Use this for" },
    useForItems: {
      ru: [
        "ваш номер или username помечен ошибочно",
        "запись устарела или доказательства неверные",
        "нужно пересмотреть URL или APK-ссылку",
      ],
      uz: [
        "raqam yoki username xato belgilangan",
        "yozuv eskirgan yoki dalil noto'g'ri",
        "URL yoki APK havolasini qayta ko'rish kerak",
      ],
      en: [
        "your number or username was labeled by mistake",
        "the record is outdated or evidence is wrong",
        "a URL or APK link needs review",
      ],
    },
    notForTitle: { ru: "Не для этого", uz: "Buning uchun emas", en: "Not for this" },
    notForItems: {
      ru: [
        "новый звонок, SMS или подозрительная ссылка",
        "массовые жалобы без доказательств",
        "сообщения с SMS-кодами, PIN, CVV или паролями",
      ],
      uz: [
        "yangi qo'ng'iroq, SMS yoki shubhali havola",
        "dalilsiz ommaviy shikoyatlar",
        "SMS-kod, PIN, CVV yoki parolli xabarlar",
      ],
      en: [
        "a new call, SMS, or suspicious link",
        "mass complaints without evidence",
        "messages containing SMS codes, PINs, CVVs, or passwords",
      ],
    },
    examplesTitle: {
      ru: "Что можно указать",
      uz: "Nimani ko'rsatish mumkin",
      en: "What you can enter",
    },
    examples: {
      ru: ["+998 90 ...", "@username", "https://site.uz", "APK-ссылка"],
      uz: ["+998 90 ...", "@username", "https://site.uz", "APK havola"],
      en: ["+998 90 ...", "@username", "https://site.uz", "APK URL"],
    },
    target: {
      ru: "Номер, Telegram или ссылка",
      uz: "Raqam, Telegram yoki havola",
      en: "Number, Telegram, or link",
    },
    reason: {
      ru: "Почему запись нужно исправить",
      uz: "Nega yozuvni tuzatish kerak",
      en: "Why this record should be corrected",
    },
    contact: {
      ru: "Контакт для ответа (необязательно)",
      uz: "Javob uchun kontakt (ixtiyoriy)",
      en: "Contact for follow-up (optional)",
    },
    submit: { ru: "Отправить на проверку", uz: "Tekshiruvga yuborish", en: "Submit for review" },
    doneTitle: { ru: "Запрос принят", uz: "So'rov qabul qilindi", en: "Request received" },
    duplicateTitle: {
      ru: "Такой запрос уже в очереди",
      uz: "Bu so'rov navbatda bor",
      en: "This request is already queued",
    },
    doneText: {
      ru: "Мы проверим запись вручную. Если метка ошибочна или устарела, администратор снимет её или обновит данные. Ваши личные контакты не станут публичными.",
      uz: "Yozuv qo'lda tekshiriladi. Agar belgi xato yoki eskirgan bo'lsa, administrator uni olib tashlaydi yoki ma'lumotni yangilaydi. Shaxsiy kontaktingiz ommaga chiqmaydi.",
      en: "We will review the record manually. If the label is wrong or outdated, an admin will remove it or update the data. Your personal contact details will not become public.",
    },
    unsupported: {
      ru: "Укажите номер телефона, Telegram-username/ссылку или URL. Свободный текст лучше отправить как жалобу.",
      uz: "Telefon raqami, Telegram username/havola yoki URL kiriting. Erkin matnni shikoyat sifatida yuborgan ma'qul.",
      en: "Enter a phone number, Telegram username/link, or URL. Free text is better submitted as a report.",
    },
    rate: {
      ru: "Слишком много запросов. Попробуйте позже.",
      uz: "So'rovlar juda ko'p. Keyinroq urinib ko'ring.",
      en: "Too many requests. Try again later.",
    },
    failed: {
      ru: "Не удалось отправить запрос. Попробуйте позже.",
      uz: "So'rov yuborilmadi. Keyinroq urinib ko'ring.",
      en: "Could not submit the request. Try again later.",
    },
  };

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canGoBackRef.current) router.history.back();
    else router.navigate({ to: "/" });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await submit({
        data: {
          target: target.trim(),
          reason: reason.trim(),
          contact: contact.trim() || undefined,
          lang,
        },
      });
      if (result.ok) {
        setDone(result.duplicate ? "duplicate" : "new");
        return;
      }
      setError(
        result.error === "unsupported_target"
          ? copy.unsupported[lang]
          : result.error === "rate_limited"
            ? copy.rate[lang]
            : copy.failed[lang],
      );
    } catch (err) {
      console.error(err);
      setError(copy.failed[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a href="/" onClick={goBack} className="apex-pill inline-flex cursor-pointer">
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 text-[#52525B]" />
          {{ ru: "Назад", uz: "Orqaga", en: "Back" }[lang]}
        </a>
        <Link
          to="/"
          className="apex-mono inline-flex items-center gap-1.5 text-[#52525B] hover:text-[#18181B]"
        >
          <Home aria-hidden="true" className="h-3 w-3" />
          {{ ru: "Главная", uz: "Bosh sahifa", en: "Home" }[lang]}
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <div className="apex-card apex-frame apex-stripes">
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            {
              {
                ru: "модерация репутации",
                uz: "reputatsiya moderatsiyasi",
                en: "reputation review",
              }[lang]
            }
          </p>
          <h1 className="font-sans text-[34px] font-medium leading-[1.05] tracking-[-0.045em] text-[#18181B] sm:text-5xl">
            {copy.title[lang]}
          </h1>
          <p className="mt-5 text-[16px] leading-[1.7] text-[#52525B]">{copy.subtitle[lang]}</p>

          <div className="mt-8 grid gap-6 text-[14px] leading-relaxed text-[#3F3F46] sm:grid-cols-2">
            <div className="border-t border-[#E2E0D8] pt-4">
              <p className="apex-mono mb-3 inline-flex items-center gap-2 text-emerald-700">
                <ListChecks aria-hidden="true" className="h-3.5 w-3.5" />
                {copy.useForTitle[lang]}
              </p>
              <ul className="space-y-2">
                {copy.useForItems[lang].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[#E2E0D8] pt-4">
              <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
                <FileWarning aria-hidden="true" className="h-3.5 w-3.5" />
                {copy.notForTitle[lang]}
              </p>
              <ul className="space-y-2">
                {copy.notForItems[lang].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="apex-card apex-frame apex-stripes">
          {done ? (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-[4px] border border-[#E2E0D8] bg-white text-emerald-600">
                <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 className="apex-h1 mt-5 text-[32px]">
                {done === "duplicate" ? copy.duplicateTitle[lang] : copy.doneTitle[lang]}
              </h2>
              <p className="apex-lead mx-auto mt-3">{copy.doneText[lang]}</p>
              <button
                type="button"
                onClick={() => {
                  setDone(null);
                  setTarget("");
                  setReason("");
                  setContact("");
                }}
                className="apex-btn-outline mt-7 inline-flex items-center gap-2"
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                {{ ru: "Новый запрос", uz: "Yangi so'rov", en: "New request" }[lang]}
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" aria-busy={loading}>
              <div className="border-y border-dashed border-[#D7D3C7] py-4">
                <p className="apex-label mb-3">{copy.examplesTitle[lang]}</p>
                <div className="flex flex-wrap gap-2">
                  {copy.examples[lang].map((example) => (
                    <span key={example} className="apex-pill">
                      {example}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="appeal-target" className="apex-label">
                  {copy.target[lang]}
                </label>
                <input
                  id="appeal-target"
                  required
                  maxLength={500}
                  disabled={loading}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="+998 90 ••• •• •• / @username / https://…"
                  className="apex-field"
                />
              </div>

              <div>
                <label htmlFor="appeal-reason" className="apex-label">
                  {copy.reason[lang]}
                </label>
                <textarea
                  id="appeal-reason"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                  disabled={loading}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="apex-field"
                  placeholder={
                    {
                      ru: "Например: это официальный номер компании; жалоба ошибочная; запись устарела; есть подтверждение.",
                      uz: "Masalan: bu kompaniyaning rasmiy raqami; shikoyat xato; yozuv eskirgan; tasdiq bor.",
                      en: "Example: this is an official company number; the report is wrong; the record is outdated; there is proof.",
                    }[lang]
                  }
                />
              </div>

              <div>
                <label htmlFor="appeal-contact" className="apex-label">
                  {copy.contact[lang]}
                </label>
                <input
                  id="appeal-contact"
                  maxLength={160}
                  disabled={loading}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="@username / email / phone"
                  className="apex-field"
                />
              </div>

              {error && (
                <p className="apex-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading} className="fancy-btn w-full sm:w-auto">
                <span className="fancy-inner">
                  {loading ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send aria-hidden="true" className="h-4 w-4" />
                  )}
                  {loading
                    ? { ru: "Отправка…", uz: "Yuborilmoqda…", en: "Submitting…" }[lang]
                    : copy.submit[lang]}
                </span>
              </button>

              <p className="apex-mono text-[#71717A]">
                {
                  {
                    ru: "Не отправляйте SMS-коды, PIN, CVV, пароли или фото документов.",
                    uz: "SMS-kod, PIN, CVV, parol yoki hujjat fotosini yubormang.",
                    en: "Do not send SMS codes, PINs, CVVs, passwords, or document photos.",
                  }[lang]
                }
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
