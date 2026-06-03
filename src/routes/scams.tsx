import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, AlertTriangle, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { SCAM_PATTERNS, type ScamPattern, type ScamSeverity } from "@/lib/scam-patterns";
import { FancyShell } from "@/components/FancyButton";

export const Route = createFileRoute("/scams")({
  head: () => ({
    meta: [
      { title: "Схемы мошенничества — Ishonch Guard" },
      {
        name: "description",
        content:
          "Типовые схемы мошенничества в Узбекистане: OTP-коды, APK, фейковые банки, безопасный счёт, Telegram-угон. Узнайте как защититься.",
      },
      { property: "og:title", content: "Схемы мошенничества — Ishonch Guard" },
    ],
  }),
  component: ScamsPage,
});

const SEVERITY_STYLES: Record<ScamSeverity, { bg: string; text: string; label: Record<string, string> }> = {
  critical: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    label: { ru: "Критический", uz: "Kritik", en: "Critical" },
  },
  high: {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-700",
    label: { ru: "Высокий", uz: "Yuqori", en: "High" },
  },
  medium: {
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-700",
    label: { ru: "Средний", uz: "O'rtacha", en: "Medium" },
  },
  low: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-700",
    label: { ru: "Низкий", uz: "Past", en: "Low" },
  },
};

const PAGE_TITLES = {
  ru: "Схемы мошенничества",
  uz: "Firibgarlik sxemalari",
  en: "Scam Schemes",
};

const PAGE_SUBTITLES = {
  ru: "Знай врага в лицо. Вот самые распространённые схемы обмана в Узбекистане.",
  uz: "Dushmanni yuzidan taniing. O'zbekistondagi eng keng tarqalgan firibgarlik sxemalari.",
  en: "Know your enemy. The most common fraud schemes in Uzbekistan.",
};

function ScamCard({ pattern }: { pattern: ScamPattern }) {
  const { lang } = useLang();
  const sev = SEVERITY_STYLES[pattern.severity];

  return (
    <div className={`rounded-xl border p-6 ${sev.bg} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-[#18181B]">
          {pattern.title[lang]}
        </h3>
        <span className={`shrink-0 text-xs font-bold uppercase px-2 py-1 rounded ${sev.text} bg-white/60`}>
          {sev.label[lang]}
        </span>
      </div>

      <p className="text-[14px] text-[#52525B] mb-4 leading-relaxed">
        {pattern.description[lang]}
      </p>

      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[#18181B] mb-1">
          🚩 {{ ru: "Красные флаги", uz: "Xavf belgilari", en: "Red flags" }[lang]}
        </p>
        <ul className="space-y-1">
          {pattern.redFlags[lang].map((flag, i) => (
            <li key={i} className="text-[13px] text-[#52525B] flex items-start gap-2">
              <span className="text-red-500 shrink-0">•</span>
              {flag}
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[#18181B] mb-1">
          ✅ {{ ru: "Что делать", uz: "Nima qilish kerak", en: "What to do" }[lang]}
        </p>
        <ul className="space-y-1">
          {pattern.whatToDo[lang].map((step, i) => (
            <li key={i} className="text-[13px] text-[#52525B] flex items-start gap-2">
              <span className="text-green-600 shrink-0">•</span>
              {step}
            </li>
          ))}
        </ul>
      </div>

      <details className="mt-3">
        <summary className="text-[13px] font-medium text-[#71717A] cursor-pointer hover:text-[#18181B]">
          💬 {{ ru: "Примеры сообщений", uz: "Xabar namunalari", en: "Example messages" }[lang]}
        </summary>
        <ul className="mt-2 space-y-1 pl-4">
          {pattern.examples[lang].map((ex, i) => (
            <li key={i} className="text-[12px] text-[#71717A] italic">
              {ex}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScamsPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 mb-4">
          <ShieldAlert className="h-8 w-8 text-[#F97316]" />
          <h1 className="text-3xl sm:text-4xl font-bold text-[#18181B]">
            {PAGE_TITLES[lang]}
          </h1>
        </div>
        <p className="text-[16px] text-[#52525B] max-w-2xl mx-auto">
          {PAGE_SUBTITLES[lang]}
        </p>
      </div>

      {/* Pattern cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {SCAM_PATTERNS.map((pattern) => (
          <ScamCard key={pattern.id} pattern={pattern} />
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link to="/check">
          <FancyShell>
            <span className="flex items-center gap-2">
              🔍 {{ ru: "Проверить сообщение", uz: "Xabarni tekshirish", en: "Check a message" }[lang]}
              <ArrowRight className="h-4 w-4" />
            </span>
          </FancyShell>
        </Link>
        <Link to="/report">
          <FancyShell>
            <span className="flex items-center gap-2">
              📢 {{ ru: "Сообщить о мошеннике", uz: "Firibgar haqida xabar berish", en: "Report a scammer" }[lang]}
              <ArrowRight className="h-4 w-4" />
            </span>
          </FancyShell>
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="mt-8 text-center text-[12px] text-[#A1A1AA]">
        {{ ru: "Ishonch Guard помогает сориентироваться, но не заменяет банк или правоохранительные органы.",
           uz: "Ishonch Guard yo'l-yo'riq beradi, lekin bank yoki huquq-tartibot organlarini almashtirmaydi.",
           en: "Ishonch Guard helps you orient, but does not replace banks or law enforcement." }[lang]}
      </p>
    </div>
  );
}
