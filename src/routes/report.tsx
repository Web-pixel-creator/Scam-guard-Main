import { createFileRoute, useSearch, useRouter, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, Send, ArrowLeft, ChevronRight, Home } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { submitReport } from "@/lib/report.functions";



const reportSearchSchema = z.object({ v: z.string().optional() });

export const Route = createFileRoute("/report")({
  validateSearch: reportSearchSchema,
  head: () => ({
    meta: [
      { title: "Сообщить о мошеннике — Ishonch Guard" },
      { name: "description", content: "Отправьте подозрительный номер, Telegram, ссылку или сообщение — мы добавим в антискам-базу после модерации." },
      { property: "og:title", content: "Сообщить о мошеннике — Ishonch Guard" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { lang } = useLang();
  const router = useRouter();
  const { v } = useSearch({ from: "/report" });

  // Capture once at first render: did the user arrive from somewhere inside
  // our app? If yes, history.back() is safe. Otherwise (deep link, new tab,
  // refresh, opened from an email) we route to "/" to keep the result predictable.
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
      })()
  );

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canGoBackRef.current) {
      router.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };


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
    setLoading(true); setError(null);
    try {
      const r = await submit({ data: {
        value: value.trim().slice(0, 500),
        description: desc.trim().slice(0, 5000),
        scamType: scamType.trim() || undefined,
        city: city.trim() || undefined,
        amountLostUzs: amount ? Number(amount.replace(/\D/g, "")) || undefined : undefined,
        lang,
      }});
      if (r.ok) setDone(true);
      else setError(r.error ?? "Ошибка");
    } catch (e) {
      console.error(e);
      setError("Не удалось отправить. Попробуйте позже.");
    } finally { setLoading(false); }
  }

  const labels = {
    title: { ru: "Сообщить о мошеннике", uz: "Firibgarni xabar qilish", en: "Report a scammer" },
    sub: { ru: "Каждая жалоба проходит модерацию. Не публикуйте чужие персональные данные.",
           uz: "Har bir shikoyat moderatsiyadan o'tadi. Boshqalarning shaxsiy ma'lumotlarini joylashtirmang.",
           en: "Every report is moderated. Do not include other people's personal data." },
    value: { ru: "Номер, Telegram, ссылка или короткий текст", uz: "Raqam, Telegram, havola yoki qisqa matn", en: "Number, Telegram, link or short text" },
    desc: { ru: "Что произошло", uz: "Nima sodir bo'ldi", en: "What happened" },
    scam: { ru: "Тип схемы (необязательно)", uz: "Sxema turi (ixtiyoriy)", en: "Scam type (optional)" },
    city: { ru: "Город (необязательно)", uz: "Shahar (ixtiyoriy)", en: "City (optional)" },
    amount: { ru: "Сумма потерь, UZS (необязательно)", uz: "Yo'qotilgan summa, UZS (ixtiyoriy)", en: "Amount lost, UZS (optional)" },
    send: { ru: "Отправить жалобу", uz: "Shikoyatni yuborish", en: "Submit report" },
    thanks_h: { ru: "Спасибо!", uz: "Rahmat!", en: "Thank you!" },
    thanks_d: { ru: "Жалоба отправлена. Мы рассмотрим её в ближайшее время.",
                uz: "Shikoyat yuborildi. Yaqin orada ko'rib chiqamiz.",
                en: "Report submitted. We'll review it shortly." },
  };

  if (done) {
    return (
      <div className="apex-page" style={{ maxWidth: 800 }}>
        <div className="mb-4">
          <a href="/" onClick={goBack} className="apex-pill inline-flex cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5 text-[#52525B]" strokeWidth={2} />
            {{ ru: "Назад", uz: "Orqaga", en: "Back" }[lang]}
          </a>
        </div>

        <div className="apex-card apex-frame apex-stripes text-center">

          <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 text-left">
            <span className="apex-mono">SYS · RECEIVED</span>
            <span className="apex-status" data-state="success">
              <span className="apex-status-dot" />
              <span className="hidden xs:inline">REPORT · QUEUED</span>
              <span className="xs:hidden">QUEUED</span>
            </span>
          </div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[4px] border border-[#E2E0D8] bg-white text-emerald-600">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" focusable="false" />
          </div>
          <h1 className="apex-h1 mt-5 sm:mt-6">{labels.thanks_h[lang]}</h1>
          <p className="apex-lead mt-3 sm:mt-4 mx-auto">{labels.thanks_d[lang]}</p>
        </div>
      </div>
    );
  }

  const backLabel = { ru: "Назад", uz: "Orqaga", en: "Back" }[lang];

  return (
    <div className="apex-page" style={{ maxWidth: 960 }}>
      <div className="mb-4">
        <a href="/" onClick={goBack} className="apex-pill inline-flex cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5 text-[#52525B]" strokeWidth={2} />
          {backLabel}
        </a>
      </div>

      <div className="apex-card apex-frame apex-stripes">

        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono">SYS · REPORT</span>
          <span className="apex-mono text-right">
            <span className="hidden xs:inline">MODERATED · ANONYMOUS</span>
            <span className="xs:hidden">ANON</span>
          </span>
        </div>

        <div className="mb-8 sm:mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8] max-w-3xl">
          <p className="label-md mb-3 sm:mb-4">02 — {{ ru: "Жалоба", uz: "Shikoyat", en: "Report" }[lang]}</p>
          <h1 className="apex-h1">
            {{
              ru: <>Сообщить о <span className="font-serif-italic text-[#8B8B92]">мошеннике</span></>,
              uz: <>Firibgarni <span className="font-serif-italic text-[#8B8B92]">xabar qilish</span></>,
              en: <>Report a <span className="font-serif-italic text-[#8B8B92]">scammer</span></>,
            }[lang]}
          </h1>
          <p className="apex-lead mt-5 sm:mt-6">{labels.sub[lang]}</p>
        </div>

        <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-5 sm:space-y-6">
          <div>
            <label htmlFor="v" className="apex-label">{labels.value[lang]}</label>
            <input id="v" required maxLength={500} value={value} onChange={(e) => setValue(e.target.value)}
                   placeholder="+998 90 ••• •• ••  /  @username  /  https://…" className="apex-field" />
          </div>

          <div>
            <label htmlFor="d" className="apex-label">{labels.desc[lang]}</label>
            <textarea id="d" required minLength={5} maxLength={5000} rows={6}
                      value={desc} onChange={(e) => setDesc(e.target.value)}
                      className="apex-field" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label htmlFor="s" className="apex-label">{labels.scam[lang]}</label>
              <input id="s" maxLength={80} value={scamType} onChange={(e) => setScamType(e.target.value)} className="apex-field" />
            </div>
            <div>
              <label htmlFor="c" className="apex-label">{labels.city[lang]}</label>
              <input id="c" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className="apex-field" />
            </div>
          </div>

          <div>
            <label htmlFor="a" className="apex-label">{labels.amount[lang]}</label>
            <input id="a" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="apex-field" />
          </div>

          {error && <p className="apex-error" role="alert">{error}</p>}

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 pt-1">
            <button type="submit" disabled={loading} className="fancy-btn sm:min-w-[220px]">
              <span className="fancy-points" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
              </span>
              <span className="fancy-inner">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {labels.send[lang]}
              </span>
            </button>
            <p className="apex-mono text-[#71717A] leading-relaxed">{t("privacy_promise", lang)}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
