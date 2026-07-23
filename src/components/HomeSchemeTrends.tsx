import { Link } from "@tanstack/react-router";
import { ArrowRight, Radar, ShieldAlert } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import {
  getSchemeTrendStats,
  getTopSchemeTrends,
  SCHEME_TREND_CATEGORY_LABELS,
  SCHEME_TREND_STATUS_LABELS,
} from "@/lib/trust/scheme-trends";

export function HomeSchemeTrends() {
  const { lang } = useLang();
  const stats = getSchemeTrendStats();
  const trends = getTopSchemeTrends(3);

  return (
    <section
      aria-labelledby="home-scheme-trends-title"
      className="approved-signals rounded-[8px] border border-[#E2E0D8] bg-white p-5 sm:p-7 md:p-8"
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <Radar aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {{ ru: "карта схем", uz: "sxemalar xaritasi", en: "scheme map" }[lang]}
          </p>
          <h2
            id="home-scheme-trends-title"
            className="font-sans text-[26px] font-medium leading-[1.08] tracking-[-0.04em] text-[#18181B] sm:text-3xl md:text-[36px]"
          >
            {
              {
                ru: "Что сейчас чаще используют в сообщениях, звонках и Telegram",
                uz: "Xabar, qo'ng'iroq va Telegramda hozir ko'p uchraydigan usullar",
                en: "What scammers keep using in messages, calls and Telegram",
              }[lang]
            }
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Показываем не людей и не каналы, а повторяющиеся тактики: крючок, цель и безопасный следующий шаг.",
                uz: "Odam yoki kanallarni emas, takrorlanadigan taktikalarni ko'rsatamiz: ilgak, maqsad va xavfsiz qadam.",
                en: "We show recurring tactics, not people or channels: hook, goal and the safest next step.",
              }[lang]
            }
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { value: stats.total, label: { ru: "схем", uz: "sxema", en: "schemes" }[lang] },
              {
                value: stats.activeWatch,
                label: { ru: "на контроле", uz: "kuzatuvda", en: "watched" }[lang],
              },
              {
                value: stats.reasonCodes,
                label: { ru: "сигналов", uz: "signal", en: "signals" }[lang],
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[6px] border border-[#F4F2EB] bg-[#FAFAF8] p-3"
              >
                <p className="font-display text-[24px] font-extrabold leading-none text-[#0B0B0F] tabular-nums">
                  {item.value}
                </p>
                <p className="mt-1 text-[11.5px] font-semibold text-[#71717A]">{item.label}</p>
              </div>
            ))}
          </div>
          <Link
            to="/scam-trends"
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-[#0B0B0F] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#27272A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
          >
            {{ ru: "Открыть тренды", uz: "Trendlarni ochish", en: "Open trends" }[lang]}
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>

        <div className="grid gap-3">
          {trends.map((trend) => (
            <Link
              key={trend.id}
              to="/scam-trends"
              className="group rounded-[8px] border border-[#E2E0D8] bg-[#FAFAF8] p-4 transition-colors hover:border-[#F97316] hover:bg-white"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-[#FFF7ED] text-[#C2410C]">
                  <ShieldAlert aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#C2410C]">
                      {SCHEME_TREND_CATEGORY_LABELS[trend.category][lang]}
                    </span>
                    <span className="text-[11px] font-semibold text-[#71717A]">
                      {SCHEME_TREND_STATUS_LABELS[trend.status][lang]}
                    </span>
                  </div>
                  <p className="text-[15px] font-bold leading-snug text-[#18181B] group-hover:text-[#C2410C]">
                    {trend.title[lang]}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#52525B]">
                    {trend.safeStep[lang]}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
