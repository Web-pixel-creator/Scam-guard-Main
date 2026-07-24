import { useState, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitReport } from "@/lib/report.functions";
import { buildQuickReportSubmitData } from "@/lib/quick-report-payload";
import { useLang } from "@/lib/lang-context";
import { ArrowRight, Send, CheckCircle2 } from "lucide-react";

export function QuickReportForm({ variant = "default" }: { variant?: "default" | "signal" }) {
  const { lang } = useLang();
  const submit = useServerFn(submitReport);
  const id = useId();
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const L = {
    title: {
      ru: "Сообщить о новом виде мошенничества",
      uz: "Yangi firibgarlik haqida xabar berish",
      en: "Report a new scam pattern",
    }[lang],
    sub: {
      ru: "Видели схему, которой ещё нет в базе? Расскажите коротко — мы добавим в защиту других.",
      uz: "Bazada yo'q sxemani ko'rdingizmi? Qisqacha yozing — boshqalarni himoya qilamiz.",
      en: "Saw a scheme not in our database yet? Tell us briefly — we'll add it to protect others.",
    }[lang],
    valueLabel: {
      ru: "Номер / ссылка / username (необязательно)",
      uz: "Raqam / havola / username (ixtiyoriy)",
      en: "Number / link / username (optional)",
    }[lang],
    valuePh: {
      ru: "+998... · t.me/... · https://...",
      uz: "+998... · t.me/... · https://...",
      en: "+998... · t.me/... · https://...",
    }[lang],
    descLabel: { ru: "Что случилось", uz: "Nima sodir bo'ldi", en: "What happened" }[lang],
    descPh: {
      ru: "Опишите схему: кто, как написал, что просил, чем закончилось…",
      uz: "Sxemani yozing: kim, qanday yozdi, nima so'radi, qanday tugadi…",
      en: "Describe the scheme: who, how they wrote, what they asked, how it ended…",
    }[lang],
    send: { ru: "Отправить жалобу", uz: "Shikoyatni yuborish", en: "Send report" }[lang],
    sending: { ru: "Отправляю…", uz: "Yuborilmoqda…", en: "Sending…" }[lang],
    success: {
      ru: "Спасибо! Сигнал принят. Публичная метка появится только после модерации.",
      uz: "Rahmat! Signal qabul qilindi. Ommaviy belgi faqat moderatsiyadan keyin chiqadi.",
      en: "Thank you! The signal was received. A public label appears only after moderation.",
    }[lang],
    again: { ru: "Отправить ещё одну", uz: "Yana yuborish", en: "Submit another" }[lang],
    rateLimit: {
      ru: "Слишком много отправок за короткое время. Подождите немного и попробуйте снова.",
      uz: "Qisqa vaqtda juda ko'p yuborildi. Biroz kuting va qayta urinib ko'ring.",
      en: "Too many submissions in a short time. Please wait a moment and try again.",
    }[lang],
    err: {
      ru: "Не удалось отправить. Попробуйте позже.",
      uz: "Yuborilmadi. Keyinroq urinib ko'ring.",
      en: "Failed to send. Please try later.",
    }[lang],
    minHint: { ru: "Минимум 5 символов", uz: "Kamida 5 ta belgi", en: "Min. 5 characters" }[lang],
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 5) {
      setError(L.minHint);
      return;
    }
    setSending(true);
    try {
      const res = await submit({
        data: buildQuickReportSubmitData({ value, description, lang }),
      });
      if (res?.ok) {
        setDone(true);
        setValue("");
        setDescription("");
      } else {
        setError(res?.error === "rate_limited" ? L.rateLimit : L.err);
      }
    } catch {
      setError(L.err);
    } finally {
      setSending(false);
    }
  }

  if (done && variant === "signal") {
    return (
      <div className="report-success" role="status" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <strong>Спасибо — сигнал принят</strong>
          <span>Публичная метка появится только после ручной модерации.</span>
        </div>
      </div>
    );
  }

  if (variant === "signal") {
    return (
      <form onSubmit={onSubmit} noValidate>
        <label>
          <span className="sr-only">Опишите подозрительную ситуацию</span>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Например: позвонили из «банка» и попросили установить APK…"
            rows={4}
            minLength={5}
            maxLength={5000}
            aria-invalid={!!error}
          />
        </label>
        {error && (
          <p className="signal-report-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || description.trim().length < 5}
          className="animated-orange-cta"
        >
          <span className="points_wrapper" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, index) => (
              <i className="point" key={index} />
            ))}
          </span>
          <span className="animated-cta-inner">
            {sending ? "Отправляем…" : "Сообщить о случае"}
            {!sending && <ArrowRight aria-hidden="true" />}
          </span>
        </button>
      </form>
    );
  }

  if (done) {
    return (
      <div
        className="rounded-[6px] border border-[#A7F3D0] bg-[#ECFDF5] p-6 flex items-start gap-3"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2
          className="h-5 w-5 text-[#059669] shrink-0 mt-0.5"
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-[#064E3B]">{L.success}</p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-2 text-[13px] text-[#047857] underline underline-offset-4 hover:text-[#064E3B]"
          >
            {L.again}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <p className="font-display text-[20px] md:text-[22px] font-extrabold tracking-tight text-[#0B0B0F]">
          {L.title}
        </p>
        <p className="mt-1.5 text-[13.5px] text-[#52525B]">{L.sub}</p>
      </div>

      <div>
        <label
          htmlFor={`${id}-value`}
          className="block text-[12.5px] font-semibold text-[#18181B] mb-1.5"
        >
          {L.valueLabel}
        </label>
        <input
          id={`${id}-value`}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={L.valuePh}
          maxLength={500}
          className="w-full h-11 px-3 rounded-[6px] border border-[#E2E0D8] bg-white text-[14px] text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#F97316] focus:outline-2 focus:outline-offset-0 focus:outline-[#F97316]/30"
        />
      </div>

      <div>
        <label
          htmlFor={`${id}-desc`}
          className="block text-[12.5px] font-semibold text-[#18181B] mb-1.5"
        >
          {L.descLabel} <span className="text-[#DC2626]">*</span>
        </label>
        <textarea
          id={`${id}-desc`}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={L.descPh}
          rows={4}
          minLength={5}
          maxLength={5000}
          className="w-full px-3 py-2.5 rounded-[6px] border border-[#E2E0D8] bg-white text-[14px] text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#F97316] focus:outline-2 focus:outline-offset-0 focus:outline-[#F97316]/30 resize-y min-h-[100px]"
        />
        <p className="mt-1 text-[11.5px] text-[#A1A1AA] tabular-nums">
          {description.length} / 5000
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-[13px] text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5]/60 rounded-[4px] px-3 py-2"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-[6px] bg-[#0B0B0F] text-white font-semibold text-[14px] hover:bg-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        {sending ? L.sending : L.send}
      </button>
    </form>
  );
}
