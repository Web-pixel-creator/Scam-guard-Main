import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import {
  filterSchemeTrends,
  getSchemeTrendStats,
  getTrendSeverityRank,
  PUBLIC_SCHEME_TRENDS,
  SCHEME_TREND_CATEGORIES,
  SCHEME_TREND_CATEGORY_LABELS,
  SCHEME_TREND_SOURCE_LABELS,
  SCHEME_TREND_STATUS_LABELS,
  type PublicSchemeTrend,
  type SchemeTrendCategory,
  type SchemeTrendSeverity,
} from "@/lib/trust/scheme-trends";

const SEVERITY_STYLE: Record<
  SchemeTrendSeverity,
  { label: Record<"ru" | "uz" | "en", string>; badge: string; rail: string }
> = {
  critical: {
    label: { ru: "Критично", uz: "Kritik", en: "Critical" },
    badge: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
    rail: "bg-[#DC2626]",
  },
  high: {
    label: { ru: "Высокий", uz: "Yuqori", en: "High" },
    badge: "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]",
    rail: "bg-[#F97316]",
  },
  medium: {
    label: { ru: "Средний", uz: "O'rtacha", en: "Medium" },
    badge: "border-[#FDE68A] bg-[#FEFCE8] text-[#854D0E]",
    rail: "bg-[#EAB308]",
  },
};

type CategoryFilter = SchemeTrendCategory | "all";

function TrendCard({ trend }: { trend: PublicSchemeTrend }) {
  const { lang } = useLang();
  const severity = SEVERITY_STYLE[trend.severity];

  return (
    <article className="relative overflow-hidden rounded-[8px] border border-[#E2E0D8] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(11,11,15,0.35)]">
      <div className={`absolute left-0 top-0 h-full w-1 ${severity.rail}`} aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="apex-mono mb-2 text-[#71717A]">
            {SCHEME_TREND_CATEGORY_LABELS[trend.category][lang]}
          </p>
          <h3 className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-[#18181B]">
            {trend.title[lang]}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center justify-center rounded-[999px] border px-2.5 py-1 text-[11px] font-bold ${severity.badge}`}
        >
          {severity.label[lang]}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          {
            label: { ru: "Крючок", uz: "Ilgak", en: "Hook" }[lang],
            value: trend.hook[lang],
          },
          {
            label: { ru: "Цель", uz: "Maqsad", en: "Goal" }[lang],
            value: trend.goal[lang],
          },
          {
            label: { ru: "Безопасный шаг", uz: "Xavfsiz qadam", en: "Safe step" }[lang],
            value: trend.safeStep[lang],
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[6px] border border-[#F4F2EB] bg-[#FAFAF8] p-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#71717A]">
              {item.label}
            </p>
            <p className="text-[13.5px] leading-relaxed text-[#27272A]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[#F4F2EB] pt-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-2 text-[12.5px] font-bold text-[#18181B]">
            {{ ru: "Что заметить", uz: "Nimani ko'rish", en: "What to notice" }[lang]}
          </p>
          <div className="flex flex-wrap gap-2">
            {trend.evidence[lang].map((item) => (
              <span
                key={item}
                className="rounded-[999px] border border-[#E2E0D8] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#3F3F46]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:max-w-[360px]">
          <p className="mb-1.5 text-[12.5px] font-bold text-[#18181B]">
            {
              { ru: "Что прислать боту", uz: "Botga nima yuborish", en: "What to send the bot" }[
                lang
              ]
            }
          </p>
          <p className="text-[13px] leading-relaxed text-[#52525B]">{trend.sendToBot[lang]}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F4F2EB] pt-4">
        <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#EEF6FF] px-2.5 py-1 text-[11.5px] font-bold text-[#1D4ED8]">
          <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
          {SCHEME_TREND_STATUS_LABELS[trend.status][lang]}
        </span>
        <span className="rounded-[6px] bg-[#F4F2EB] px-2.5 py-1 text-[11.5px] font-semibold text-[#52525B]">
          {SCHEME_TREND_SOURCE_LABELS[trend.source][lang]}
        </span>
        {trend.reasonCodes.slice(0, 3).map((code) => (
          <code
            key={code}
            className="rounded-[4px] bg-[#0B0B0F] px-2 py-1 text-[11px] font-semibold text-white"
          >
            {code}
          </code>
        ))}
      </div>
    </article>
  );
}

export function SchemeTrendsPanel() {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const stats = useMemo(() => getSchemeTrendStats(), []);
  const trends = useMemo(() => {
    return filterSchemeTrends({ category, query }).sort(
      (a, b) => getTrendSeverityRank(b.severity) - getTrendSeverityRank(a.severity),
    );
  }, [category, query]);

  const categoryOptions: CategoryFilter[] = ["all", ...SCHEME_TREND_CATEGORIES];

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            value: stats.total,
            label: { ru: "публичных трендов", uz: "public trend", en: "public trends" }[lang],
          },
          {
            value: stats.activeWatch,
            label: { ru: "на контроле", uz: "kuzatuvda", en: "currently watched" }[lang],
          },
          {
            value: stats.critical,
            label: { ru: "критичных сценария", uz: "kritik holat", en: "critical scenarios" }[lang],
          },
          {
            value: stats.reasonCodes,
            label: { ru: "reason-кодов", uz: "reason-code", en: "reason codes" }[lang],
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[8px] border border-[#E2E0D8] bg-white p-4">
            <p className="font-display text-[30px] font-extrabold leading-none tracking-tight text-[#0B0B0F] tabular-nums">
              {item.value}
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-[#52525B]">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[8px] border border-[#E2E0D8] bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">
              {
                { ru: "Поиск по схемам", uz: "Sxemalar bo'yicha qidirish", en: "Search schemes" }[
                  lang
                ]
              }
            </span>
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]"
              strokeWidth={2}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                {
                  ru: "Поиск: SMS, APK, Stars, wallet, доставка...",
                  uz: "Qidirish: SMS, APK, Stars, wallet, yetkazish...",
                  en: "Search: SMS, APK, Stars, wallet, delivery...",
                }[lang]
              }
              className="h-11 w-full rounded-[6px] border border-[#E2E0D8] bg-[#FAFAF8] pl-9 pr-3 text-[14px] text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#F97316] focus:outline-2 focus:outline-offset-0 focus:outline-[#F97316]/30"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((option) => {
              const active = category === option;
              const label =
                option === "all"
                  ? { ru: "Все", uz: "Hammasi", en: "All" }[lang]
                  : SCHEME_TREND_CATEGORY_LABELS[option][lang];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  className={`h-9 rounded-[6px] border px-3 text-[12.5px] font-bold transition-colors ${
                    active
                      ? "border-[#0B0B0F] bg-[#0B0B0F] text-white"
                      : "border-[#E2E0D8] bg-white text-[#52525B] hover:border-[#F97316] hover:text-[#C2410C]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[8px] border border-[#FED7AA] bg-[#FFF7ED] p-4 text-[13.5px] leading-relaxed text-[#9A3412]">
        <div className="flex items-start gap-3">
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <p>
            {
              {
                ru: "Это не список обвиняемых людей или каналов. Это публичная карта тактик: какие крючки встречаются, что обычно хотят получить и какой безопасный шаг сделать первым.",
                uz: "Bu odamlar yoki kanallarni ayblash ro'yxati emas. Bu ommaviy taktika xaritasi: qanday ilgaklar uchraydi, odatda nimani olishmoqchi va birinchi xavfsiz qadam nima.",
                en: "This is not a list of accused people or channels. It is a public tactics map: common hooks, likely goals and the safest first step.",
              }[lang]
            }
          </p>
        </div>
      </div>

      {trends.length > 0 ? (
        <div className="grid gap-4">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      ) : (
        <div className="rounded-[8px] border border-[#E2E0D8] bg-white p-8 text-center">
          <p className="text-[16px] font-bold text-[#18181B]">
            {{ ru: "Ничего не найдено", uz: "Hech narsa topilmadi", en: "No trends found" }[lang]}
          </p>
          <p className="mt-2 text-[13.5px] text-[#52525B]">
            {
              {
                ru: "Попробуйте другой запрос или откройте все категории.",
                uz: "Boshqa so'rov kiriting yoki barcha kategoriyalarni oching.",
                en: "Try another query or open all categories.",
              }[lang]
            }
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/check"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-[#0B0B0F] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#27272A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
        >
          <Bot aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          {{ ru: "Проверить сейчас", uz: "Hozir tekshirish", en: "Check now" }[lang]}
          <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </Link>
        <Link
          to="/official-numbers"
          className="inline-flex h-12 items-center justify-center rounded-[6px] border border-[#E2E0D8] bg-white px-4 text-[14px] font-bold text-[#18181B] transition-colors hover:border-[#16A34A] hover:text-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
        >
          {{ ru: "Официальные номера", uz: "Rasmiy raqamlar", en: "Official numbers" }[lang]}
        </Link>
        <Link
          to="/report"
          className="inline-flex h-12 items-center justify-center rounded-[6px] border border-[#E2E0D8] bg-white px-4 text-[14px] font-bold text-[#18181B] transition-colors hover:border-[#F97316] hover:text-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
        >
          {{ ru: "Сообщить схему", uz: "Sxema yuborish", en: "Report a pattern" }[lang]}
        </Link>
      </div>
    </section>
  );
}
