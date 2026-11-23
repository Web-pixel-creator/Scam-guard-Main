import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle,
  CircleNotch,
  Lock,
  Megaphone,
  PaperPlaneRight,
  WarningCircle,
} from "@phosphor-icons/react";
import { PageHero, Pill, PillButton } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { isOffline, offlineMessage, safeClientErrorReason } from "@/lib/client-error";
import { submitReport } from "@/lib/report.functions";

const reportSearchSchema = z.object({ v: z.string().optional() });

const SUBMIT_ERRORS = {
  rateLimited: {
    ru: "Слишком много жалоб подряд. Попробуйте снова через {min} мин. — введённый текст сохранён.",
    uz: "Juda ko‘p shikoyat ketma-ket yuborildi. {min} daqiqadan keyin qayta urinib ko‘ring — matningiz saqlangan.",
    en: "Too many reports in a row. Try again in {min} min — what you typed is still here.",
  },
  failed: {
    ru: "Не удалось отправить. Попробуйте ещё раз чуть позже — введённый текст сохранён.",
    uz: "Yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring — matningiz saqlangan.",
    en: "Could not send. Try again a little later — what you typed is still here.",
  },
} as const;

export const Route = createFileRoute("/report")({
  validateSearch: reportSearchSchema,

  component: ReportPage,
});

function ReportPage() {
  const { lang } = useLang();
  const { v } = useSearch({ from: "/report" });

  const [value, setValue] = useState(v ?? "");
  const [desc, setDesc] = useState("");
  const [scamType, setScamType] = useState("");
  const [city, setCity] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = useServerFn(submitReport);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await submit({
        data: {
          value: value.trim().slice(0, 500),
          description: desc.trim().slice(0, 5000),
          scamType: scamType.trim() || undefined,
          city: city.trim() || undefined,
          amountLostUzs: amount ? Number(amount.replace(/\D/g, "")) || undefined : undefined,
          lang,
        },
      });
      if (r.ok) setDone(true);
      // The server returns codes, never text for people.
      else if (r.error === "rate_limited") {
        const minutes = Math.max(1, Math.ceil((r.retryAfterSec ?? 600) / 60));
        setError(SUBMIT_ERRORS.rateLimited[lang].replace("{min}", String(minutes)));
      } else setError(SUBMIT_ERRORS.failed[lang]);
    } catch (e) {
      console.error("report submit failed", safeClientErrorReason(e));
      setError(isOffline() ? offlineMessage(lang) : SUBMIT_ERRORS.failed[lang]);
    } finally {
      setLoading(false);
    }
  }

  const labels = {
    title: {
      ru: "Сообщить о случае.",
      uz: "Holat haqida xabar bering.",
      en: "Report an incident.",
    },
    titleMuted: {
      ru: "Предупредите других.",
      uz: "Boshqalarni ogohlantiring.",
      en: "Warn other people.",
    },
    sub: {
      ru: "Каждая жалоба проходит модерацию. Не публикуйте чужие персональные данные.",
      uz: "Har bir shikoyat moderatsiyadan o‘tadi. Boshqalarning shaxsiy ma’lumotlarini joylashtirmang.",
      en: "Every report is moderated. Do not include other people's personal data.",
    },
    value: {
      ru: "Номер, Telegram, ссылка или короткий текст",
      uz: "Raqam, Telegram, havola yoki qisqa matn",
      en: "Number, Telegram, link or short text",
    },
    desc: { ru: "Что произошло", uz: "Nima sodir bo‘ldi", en: "What happened" },
    scam: {
      ru: "Тип схемы (необязательно)",
      uz: "Sxema turi (ixtiyoriy)",
      en: "Scam type (optional)",
    },
    city: { ru: "Город (необязательно)", uz: "Shahar (ixtiyoriy)", en: "City (optional)" },
    amount: {
      ru: "Сумма потерь в сумах (необязательно)",
      uz: "Yo‘qotilgan summa, so‘mda (ixtiyoriy)",
      en: "Amount lost, UZS (optional)",
    },
    send: { ru: "Отправить жалобу", uz: "Shikoyatni yuborish", en: "Submit report" },
    thanks_h: { ru: "Спасибо!", uz: "Rahmat!", en: "Thank you!" },
    thanks_d: {
      ru: "Сигнал отправлен. Спасибо: вы помогли предупредить других людей. Мы проверим его вручную; публичная метка появится только после модерации. Если похожий сигнал уже был, ваш помогает поднять приоритет проверки.",
      uz: "Signal yuborildi. Rahmat: siz boshqa odamlarni ogohlantirishga yordam berdingiz. Uni qo‘lda tekshiramiz; ommaviy belgi faqat moderatsiyadan keyin chiqadi. Agar o‘xshash signal oldin bo‘lgan bo‘lsa, sizniki tekshiruv ustuvorligini oshiradi.",
      en: "Signal sent. Thank you: you helped warn other people. We'll review it manually; a public label appears only after moderation. If a similar signal already exists, yours helps raise review priority.",
    },
  };

  const L = {
    step1: {
      ru: "Шаг 1 из 2 · заполнение",
      uz: "1/2 qadam · to‘ldirish",
      en: "Step 1 of 2 · fill in",
    }[lang],
    step2: { ru: "Шаг 2 из 2 · отправлено", uz: "2/2 qadam · yuborildi", en: "Step 2 of 2 · sent" }[
      lang
    ],
    eyebrow: { ru: "Жалоба", uz: "Shikoyat", en: "Report" }[lang],
    sending: { ru: "Отправляем…", uz: "Yuborilmoqda…", en: "Sending…" }[lang],
    failed: { ru: "Ошибка", uz: "Xato", en: "Error" }[lang],
    idle: {
      ru: "Анонимно · с проверкой",
      uz: "Anonim · tekshiriladi",
      en: "Anonymous · moderated",
    }[lang],
    wait: {
      ru: "Отправляем жалобу на модерацию… Не закрывайте страницу.",
      uz: "Shikoyat moderatsiyaga yuborilmoqda… Sahifani yopmang.",
      en: "Sending your report to moderation… Don't close the page.",
    }[lang],
    submitting: { ru: "Отправка…", uz: "Yuborilmoqda…", en: "Submitting…" }[lang],
    home: { ru: "На главную", uz: "Bosh sahifa", en: "Home" }[lang],
    again: { ru: "Проверить ещё", uz: "Yana tekshirish", en: "Check another" }[lang],
  };

  const how = {
    ru: [
      ["Укажите контакт", "Номер, Telegram, ссылку или короткий текст."],
      ["Опишите, что произошло", "Пара предложений — без чужих личных данных."],
      ["Модератор проверит вручную", "Публичная метка появится только после модерации."],
    ],
    uz: [
      ["Kontaktni ko‘rsating", "Raqam, Telegram, havola yoki qisqa matn."],
      ["Nima bo‘lganini yozing", "Bir-ikki gap — boshqalarning shaxsiy ma’lumotlarisiz."],
      ["Moderator qo‘lda tekshiradi", "Ommaviy belgi faqat moderatsiyadan keyin chiqadi."],
    ],
    en: [
      ["Add the contact", "A number, Telegram, link or short text."],
      ["Describe what happened", "A couple of sentences — no other people's personal data."],
      ["A moderator reviews it", "A public label appears only after moderation."],
    ],
  }[lang];

  const status = loading ? "loading" : error ? "error" : "idle";

  if (done) {
    return (
      <div className="vp-home vp-page">
        <div className="vp-shell">
          <div className="vp-done">
            <span className="vp-done-icon" aria-hidden="true">
              <CheckCircle weight="fill" />
            </span>
            <span className="vp-status" data-state="success">
              <i aria-hidden="true" />
              {L.step2}
            </span>
            <h1>{labels.thanks_h[lang]}</h1>
            <p>{labels.thanks_d[lang]}</p>
            <div className="vp-actions">
              <Pill to="/">{L.home}</Pill>
              <Pill to="/check" tone="outline">
                {L.again}
              </Pill>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell vp-form-layout">
        <PageHero
          icon={<Megaphone weight="bold" />}
          eyebrow={L.eyebrow}
          title={[labels.title[lang], labels.titleMuted[lang]]}
          lead={labels.sub[lang]}
        >
          <ol className="vp-howlist">
            {how.map(([title, detail], index) => (
              <li key={title}>
                <span aria-hidden="true">{index + 1}</span>
                <span>
                  <strong>{title}</strong>
                  {detail}
                </span>
              </li>
            ))}
          </ol>
        </PageHero>

        <form onSubmit={onSubmit} aria-busy={loading} className="vp-formcard">
          <div className="vp-formcard-head">
            <span className="vp-checker-label">{L.step1}</span>
            <span className="vp-status" data-state={status} aria-live="polite">
              <i aria-hidden="true" />
              {loading ? L.sending : error ? L.failed : L.idle}
            </span>
          </div>

          <div className="vp-formcard-body">
            <div className="vp-field">
              <label htmlFor="v">{labels.value[lang]}</label>
              <input
                id="v"
                required
                maxLength={500}
                disabled={loading}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="+998 90 ••• •• ••  /  @username  /  https://…"
                className="vp-input"
              />
            </div>

            <div className="vp-field">
              <label htmlFor="d">{labels.desc[lang]}</label>
              <textarea
                id="d"
                required
                minLength={5}
                maxLength={5000}
                rows={6}
                disabled={loading}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="vp-input"
              />
            </div>

            <div className="vp-field-row">
              <div className="vp-field">
                <label htmlFor="s">{labels.scam[lang]}</label>
                <input
                  id="s"
                  maxLength={80}
                  disabled={loading}
                  value={scamType}
                  onChange={(e) => setScamType(e.target.value)}
                  className="vp-input"
                />
              </div>
              <div className="vp-field">
                <label htmlFor="c">{labels.city[lang]}</label>
                <input
                  id="c"
                  maxLength={80}
                  disabled={loading}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="vp-input"
                />
              </div>
            </div>

            <div className="vp-field">
              <label htmlFor="a">{labels.amount[lang]}</label>
              <input
                id="a"
                inputMode="numeric"
                disabled={loading}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="vp-input"
              />
            </div>

            {error && (
              <p className="vp-alert vp-alert--error" role="alert">
                <WarningCircle weight="fill" aria-hidden="true" />
                {error}
              </p>
            )}

            {loading && (
              <p className="vp-alert vp-alert--info" role="status" aria-live="polite">
                <CircleNotch weight="bold" aria-hidden="true" className="vp-spin" />
                {L.wait}
              </p>
            )}

            <PillButton
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              className="vp-formcard-submit"
              icon={
                loading ? (
                  <CircleNotch weight="bold" className="vp-spin" />
                ) : (
                  <PaperPlaneRight weight="fill" />
                )
              }
            >
              {loading ? L.submitting : labels.send[lang]}
            </PillButton>
          </div>

          <p className="vp-formcard-foot">
            <Lock weight="bold" aria-hidden="true" />
            {t("privacy_promise", lang)}
          </p>
        </form>
      </div>
    </div>
  );
}
