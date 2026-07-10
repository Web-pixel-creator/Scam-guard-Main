import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Radar, ShieldAlert } from "lucide-react";
import { ScamMapIndexPanel } from "@/components/ScamMapIndexPanel";
import { SchemeTrendsPanel } from "@/components/SchemeTrendsPanel";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/scam-trends")({
  head: () => ({
    meta: [
      { title: "Активные схемы мошенничества в Узбекистане - Ishonch Guard" },
      {
        name: "description",
        content:
          "Публичная карта актуальных антискам-тактик Ishonch Guard: SMS-коды, APK, Telegram, TON, казино, NFT, доставка и дропперство. Без персональных данных и обвинений.",
      },
      { property: "og:title", content: "Активные схемы мошенничества - Ishonch Guard" },
      {
        property: "og:description",
        content: "Смотрите крючки, цели и безопасные шаги по повторяющимся схемам мошенничества.",
      },
    ],
    links: [{ rel: "canonical", href: "/scam-trends" }],
  }),
  component: ScamTrendsPage,
});

function ScamTrendsPage() {
  const { lang } = useLang();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <Radar aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {
              {
                ru: "публичная карта схем",
                uz: "ommaviy sxemalar xaritasi",
                en: "public scheme map",
              }[lang]
            }
          </p>
          <h1 className="max-w-3xl font-sans text-[34px] font-medium leading-[1.05] tracking-[-0.045em] text-[#18181B] sm:text-5xl md:text-[58px]">
            {
              {
                ru: "Актуальные схемы, которые стоит узнать до клика",
                uz: "Bosishdan oldin bilish kerak bo'lgan dolzarb sxemalar",
                en: "Current schemes to recognize before you click",
              }[lang]
            }
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Это агрегированная обучающая страница: мы показываем повторяющиеся тактики, а не публикуем сырые жалобы, номера, ссылки или usernames.",
                uz: "Bu agregatsiyalangan o'quv sahifa: xom shikoyat, raqam, havola yoki username emas, takrorlanuvchi taktikalarni ko'rsatamiz.",
                en: "This is an aggregated education page: it shows recurring tactics, not raw reports, phone numbers, links or usernames.",
              }[lang]
            }
          </p>
        </div>

        <div className="rounded-[8px] border border-[#E2E0D8] bg-white p-5 shadow-[0_10px_28px_-18px_rgba(11,11,15,0.28)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] bg-[#FEF2F2] text-[#DC2626]">
              <ShieldAlert aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-[#18181B]">
                {
                  {
                    ru: "Осторожно: тренд не равен обвинению",
                    uz: "Ehtiyot: trend ayblov emas",
                    en: "Careful: a trend is not an accusation",
                  }[lang]
                }
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#52525B]">
                {
                  {
                    ru: "Даже если сообщение похоже на одну из схем, итог зависит от конкретного текста, ссылки, номера и того, что вас просят сделать.",
                    uz: "Xabar sxemaga o'xshasa ham, yakuniy baho aniq matn, havola, raqam va sizdan nima so'ralganiga bog'liq.",
                    en: "Even if a message resembles a scheme, the verdict depends on the exact text, link, number and requested action.",
                  }[lang]
                }
              </p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-[6px] bg-[#F4F2EB] px-3 py-2 text-[12.5px] font-semibold text-[#3F3F46]">
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
                {
                  {
                    ru: "Обновлено: июль 2026",
                    uz: "Yangilangan: iyul 2026",
                    en: "Updated: July 2026",
                  }[lang]
                }
              </p>
            </div>
          </div>
        </div>
      </section>

      <ScamMapIndexPanel />
      <SchemeTrendsPanel />
    </main>
  );
}
