import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
  CheckCircle,
  CircleNotch,
  Lock,
  PaperPlaneRight,
  Scales,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { PageHero, PillButton } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import { isOffline, offlineMessage, safeClientErrorReason } from "@/lib/client-error";
import { submitReputationAppeal } from "@/lib/reputation-appeal.functions";

export const Route = createFileRoute("/appeal")({
  component: AppealPage,
});

function AppealPage() {
  const { lang } = useLang();
  const submit = useServerFn(submitReputationAppeal);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = {
    eyebrow: { ru: "Апелляция", uz: "Apellyatsiya", en: "Appeal" },
    title: {
      ru: "Исправить репутационную запись.",
      uz: "Reputatsiya yozuvini tuzatish.",
      en: "Correct a reputation record.",
    },
    titleMuted: {
      ru: "Если метка ошибочна.",
      uz: "Agar belgi xato bo‘lsa.",
      en: "If the label is wrong.",
    },
    formLabel: { ru: "Запрос на проверку", uz: "Tekshiruv so‘rovi", en: "Review request" },
    moderated: { ru: "Проверяет модератор", uz: "Moderator tekshiradi", en: "Moderator review" },
    newRequest: { ru: "Новый запрос", uz: "Yangi so‘rov", en: "New request" },
    submitting: { ru: "Отправка…", uz: "Yuborilmoqda…", en: "Submitting…" },
    noSecrets: {
      ru: "Не отправляйте SMS-коды, PIN, CVV, пароли или фото документов.",
      uz: "SMS-kod, PIN, CVV, parol yoki hujjat fotosini yubormang.",
      en: "Do not send SMS codes, PINs, CVVs, passwords, or document photos.",
    },
    subtitle: {
      ru: "Эта форма нужна только для исправления уже существующей публичной метки Ishonch Guard. Новые случаи мошенничества отправляйте как жалобу — так модератор получит правильный контекст.",
      uz: "Bu forma faqat Ishonch Guard’dagi mavjud ommaviy belgini tuzatish uchun. Yangi firibgarlik holatlarini shikoyat sifatida yuboring — moderator to‘g‘ri kontekst oladi.",
      en: "This form is only for correcting an existing public Ishonch Guard label. New scam incidents should be submitted as reports so moderators get the right context.",
    },
    useForTitle: {
      ru: "Используйте здесь",
      uz: "Quyidagi hollarda foydalaning",
      en: "Use this for",
    },
    useForItems: {
      ru: [
        "ваш номер или username помечен ошибочно",
        "запись устарела или доказательства неверные",
        "нужно пересмотреть URL или APK-ссылку",
      ],
      uz: [
        "raqam yoki username xato belgilangan",
        "yozuv eskirgan yoki dalil noto‘g‘ri",
        "URL yoki APK havolasini qayta ko‘rish kerak",
      ],
      en: [
        "your number or username was labeled by mistake",
        "the record is outdated or evidence is wrong",
        "a URL or APK link needs review",
      ],
    },
    notForTitle: { ru: "Не для этого", uz: "Bu hollar uchun emas", en: "Not for this" },
    notForItems: {
      ru: [
        "новый звонок, SMS или подозрительная ссылка",
        "массовые жалобы без доказательств",
        "сообщения с SMS-кодами, PIN, CVV или паролями",
      ],
      uz: [
        "yangi qo‘ng‘iroq, SMS yoki shubhali havola",
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
      uz: "Nimani ko‘rsatish mumkin",
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
    doneTitle: { ru: "Запрос принят", uz: "So‘rov qabul qilindi", en: "Request received" },
    doneText: {
      ru: "Мы проверим запись вручную. Если метка ошибочна или устарела, администратор снимет её или обновит данные. Ваши личные контакты не станут публичными.",
      uz: "Yozuv qo‘lda tekshiriladi. Agar belgi xato yoki eskirgan bo‘lsa, administrator uni olib tashlaydi yoki ma’lumotni yangilaydi. Shaxsiy kontaktingiz ommaga chiqmaydi.",
      en: "We will review the record manually. If the label is wrong or outdated, an admin will remove it or update the data. Your personal contact details will not become public.",
    },
    unsupported: {
      ru: "Укажите номер телефона, Telegram-username/ссылку или URL. Свободный текст лучше отправить как жалобу.",
      uz: "Telefon raqami, Telegram username/havola yoki URL kiriting. Erkin matnni shikoyat sifatida yuborgan ma’qul.",
      en: "Enter a phone number, Telegram username/link, or URL. Free text is better submitted as a report.",
    },
    rate: {
      ru: "Слишком много запросов. Попробуйте позже.",
      uz: "So‘rovlar juda ko‘p. Keyinroq urinib ko‘ring.",
      en: "Too many requests. Try again later.",
    },
    failed: {
      ru: "Не удалось отправить запрос. Попробуйте позже.",
      uz: "So‘rov yuborilmadi. Keyinroq urinib ko‘ring.",
      en: "Could not submit the request. Try again later.",
    },
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
        setDone(true);
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
      console.error("appeal submit failed", safeClientErrorReason(err));
      setError(isOffline() ? offlineMessage(lang) : copy.failed[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell vp-form-layout">
        <PageHero
          icon={<Scales weight="bold" />}
          eyebrow={copy.eyebrow[lang]}
          title={[copy.title[lang], copy.titleMuted[lang]]}
          lead={copy.subtitle[lang]}
        >
          <div className="vp-dodont">
            <div className="vp-dodont-card vp-dodont-card--do">
              <h2>
                <Check weight="bold" aria-hidden="true" />
                {copy.useForTitle[lang]}
              </h2>
              <ul>
                {copy.useForItems[lang].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="vp-dodont-card vp-dodont-card--dont">
              <h2>
                <X weight="bold" aria-hidden="true" />
                {copy.notForTitle[lang]}
              </h2>
              <ul>
                {copy.notForItems[lang].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </PageHero>

        <div className="vp-formcard">
          <div className="vp-formcard-head">
            <span className="vp-checker-label">{copy.formLabel[lang]}</span>
            <span
              className="vp-status"
              data-state={done ? "success" : loading ? "loading" : error ? "error" : "idle"}
            >
              <i aria-hidden="true" />
              {copy.moderated[lang]}
            </span>
          </div>

          {done ? (
            <div className="vp-formcard-body vp-formcard-done">
              <span className="vp-done-icon" aria-hidden="true">
                <CheckCircle weight="fill" />
              </span>
              <h2>{copy.doneTitle[lang]}</h2>
              <p>{copy.doneText[lang]}</p>
              <PillButton
                tone="outline"
                icon={<ArrowCounterClockwise weight="bold" />}
                onClick={() => {
                  setDone(false);
                  setTarget("");
                  setReason("");
                  setContact("");
                }}
              >
                {copy.newRequest[lang]}
              </PillButton>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="vp-formcard-body" aria-busy={loading}>
              <div className="vp-field">
                <span className="vp-field-label">{copy.examplesTitle[lang]}</span>
                <div className="vp-chiplist">
                  {copy.examples[lang].map((example) => (
                    <span key={example}>{example}</span>
                  ))}
                </div>
              </div>

              <div className="vp-field">
                <label htmlFor="appeal-target">{copy.target[lang]}</label>
                <input
                  id="appeal-target"
                  required
                  maxLength={500}
                  disabled={loading}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="+998 90 ••• •• •• / @username / https://…"
                  className="vp-input"
                />
              </div>

              <div className="vp-field">
                <label htmlFor="appeal-reason">{copy.reason[lang]}</label>
                <textarea
                  id="appeal-reason"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={6}
                  disabled={loading}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="vp-input"
                  placeholder={
                    {
                      ru: "Например: это официальный номер компании; жалоба ошибочная; запись устарела; есть подтверждение.",
                      uz: "Masalan: bu kompaniyaning rasmiy raqami; shikoyat xato; yozuv eskirgan; tasdiq bor.",
                      en: "Example: this is an official company number; the report is wrong; the record is outdated; there is proof.",
                    }[lang]
                  }
                />
              </div>

              <div className="vp-field">
                <label htmlFor="appeal-contact">{copy.contact[lang]}</label>
                <input
                  id="appeal-contact"
                  maxLength={160}
                  disabled={loading}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={
                    {
                      ru: "@username, e-mail или телефон",
                      uz: "@username, e-mail yoki telefon",
                      en: "@username / email / phone",
                    }[lang]
                  }
                  className="vp-input"
                />
              </div>

              {error && (
                <p className="vp-alert vp-alert--error" role="alert">
                  <WarningCircle weight="fill" aria-hidden="true" />
                  {error}
                </p>
              )}

              <PillButton
                type="submit"
                disabled={loading}
                className="vp-formcard-submit"
                icon={
                  loading ? (
                    <CircleNotch weight="bold" className="vp-spin" />
                  ) : (
                    <PaperPlaneRight weight="fill" />
                  )
                }
              >
                {loading ? copy.submitting[lang] : copy.submit[lang]}
              </PillButton>
            </form>
          )}

          <p className="vp-formcard-foot">
            <Lock weight="bold" aria-hidden="true" />
            {copy.noSecrets[lang]}
          </p>
        </div>
      </div>
    </div>
  );
}
