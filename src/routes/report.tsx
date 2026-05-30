import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
    sub: { ru: "Каждая жалоба проходит модерацию. Не публикуйте чужие персональные данные.",
           uz: "Har bir shikoyat moderatsiyadan o‘tadi. Boshqalarning shaxsiy ma’lumotlarini joylashtirmang.",
           en: "Every report is moderated. Do not include other people’s personal data." },
    value: { ru: "Номер, Telegram, ссылка или короткий текст", uz: "Raqam, Telegram, havola yoki qisqa matn", en: "Number, Telegram, link or short text" },
    desc: { ru: "Что произошло", uz: "Nima sodir bo‘ldi", en: "What happened" },
    scam: { ru: "Тип схемы (необязательно)", uz: "Sxema turi (ixtiyoriy)", en: "Scam type (optional)" },
    city: { ru: "Город (необязательно)", uz: "Shahar (ixtiyoriy)", en: "City (optional)" },
    amount: { ru: "Сумма потерь, UZS (необязательно)", uz: "Yo‘qotilgan summa, UZS (ixtiyoriy)", en: "Amount lost, UZS (optional)" },
    send: { ru: "Отправить жалобу", uz: "Shikoyatni yuborish", en: "Submit report" },
    thanks_h: { ru: "Спасибо!", uz: "Rahmat!", en: "Thank you!" },
    thanks_d: { ru: "Жалоба отправлена. Мы рассмотрим её в ближайшее время.",
                uz: "Shikoyat yuborildi. Yaqin orada ko‘rib chiqamiz.",
                en: "Report submitted. We’ll review it shortly." },
  };

  if (done) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-xl">
        <Card className="p-8 text-center">
          <div className="grid place-items-center mx-auto h-14 w-14 rounded-full bg-safe/15 text-safe">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold">{labels.thanks_h[lang]}</h1>
          <p className="mt-2 text-muted-foreground">{labels.thanks_d[lang]}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{labels.title[lang]}</h1>
      <p className="mt-2 text-muted-foreground">{labels.sub[lang]}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="v">{labels.value[lang]}</Label>
          <Input id="v" required maxLength={500} value={value} onChange={(e) => setValue(e.target.value)}
                 placeholder="+998 90 ••• •• ••  /  @username  /  https://…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d">{labels.desc[lang]}</Label>
          <Textarea id="d" required minLength={5} maxLength={5000} rows={6}
                    value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="s">{labels.scam[lang]}</Label>
            <Input id="s" maxLength={80} value={scamType} onChange={(e) => setScamType(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c">{labels.city[lang]}</Label>
            <Input id="c" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a">{labels.amount[lang]}</Label>
          <Input id="a" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className="fancy-btn min-w-[200px]">
          <span className="fancy-points" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
          </span>
          <span className="fancy-inner">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {labels.send[lang]}
          </span>
        </button>
        <p className="text-xs text-muted-foreground">{t("privacy_promise", lang)}</p>
      </form>
    </div>
  );
}
