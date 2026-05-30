import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const FIELD_CLS =
  "rounded-[4px] border-[#E2E0D8] bg-white text-[#18181B] placeholder:text-[#A1A1AA] focus-visible:border-[#0B0B0F]/40 focus-visible:ring-[3px] focus-visible:ring-[#0B0B0F]/6 shadow-none";

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
    accent: { ru: "мошеннике", uz: "firibgarni", en: "scammer" },
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
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-16">
        <div className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] bg-white/55 p-10 md:p-14 text-center">
          <div className="flex items-center justify-between gap-4 mb-8">
            <span className="apex-mono">SYS · RECEIVED</span>
            <span className="apex-status" data-state="success">
              <span className="apex-status-dot" />
              REPORT · QUEUED
            </span>
          </div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[4px] border border-[#E2E0D8] bg-white text-emerald-600">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h1 className="mt-6 font-sans font-medium text-[34px] md:text-5xl tracking-[-0.05em] text-[#18181B]">
            {labels.thanks_h[lang]}
          </h1>
          <p className="mt-4 text-[15px] text-[#52525B] leading-[1.65] max-w-md mx-auto">{labels.thanks_d[lang]}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] bg-white/55 p-6 sm:p-10 md:p-14">
        <div className="flex items-start justify-between gap-4 mb-6">
          <span className="apex-mono">SYS · REPORT</span>
          <span className="apex-mono text-right">MODERATED · ANONYMOUS</span>
        </div>

        <div className="mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8] max-w-3xl">
          <p className="label-md mb-4">02 — {{ ru: "Жалоба", uz: "Shikoyat", en: "Report" }[lang]}</p>
          <h1 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">
            {{
              ru: <>Сообщить о <span className="font-serif-italic text-[#8B8B92]">мошеннике</span></>,
              uz: <>Firibgarni <span className="font-serif-italic text-[#8B8B92]">xabar qilish</span></>,
              en: <>Report a <span className="font-serif-italic text-[#8B8B92]">scammer</span></>,
            }[lang]}
          </h1>
          <p className="mt-6 text-[15px] md:text-[16px] text-[#52525B] leading-[1.65] max-w-xl text-pretty">
            {labels.sub[lang]}
          </p>
        </div>

        <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
          <div className="space-y-2">
            <Label htmlFor="v" className="apex-mono text-[#52525B]">{labels.value[lang]}</Label>
            <Input id="v" required maxLength={500} value={value} onChange={(e) => setValue(e.target.value)}
                   placeholder="+998 90 ••• •• ••  /  @username  /  https://…" className={FIELD_CLS} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="d" className="apex-mono text-[#52525B]">{labels.desc[lang]}</Label>
            <Textarea id="d" required minLength={5} maxLength={5000} rows={6}
                      value={desc} onChange={(e) => setDesc(e.target.value)}
                      className={`${FIELD_CLS} resize-none leading-relaxed`} />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="s" className="apex-mono text-[#52525B]">{labels.scam[lang]}</Label>
              <Input id="s" maxLength={80} value={scamType} onChange={(e) => setScamType(e.target.value)} className={FIELD_CLS} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c" className="apex-mono text-[#52525B]">{labels.city[lang]}</Label>
              <Input id="c" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} className={FIELD_CLS} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="a" className="apex-mono text-[#52525B]">{labels.amount[lang]}</Label>
            <Input id="a" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD_CLS} />
          </div>

          {error && (
            <p className="apex-mono text-[#DC2626]" role="alert">! {error}</p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <button type="submit" disabled={loading} className="fancy-btn min-w-[220px]">
              <span className="fancy-points" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
              </span>
              <span className="fancy-inner">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {labels.send[lang]}
              </span>
            </button>
            <p className="apex-mono text-[#71717A]">{t("privacy_promise", lang)}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
