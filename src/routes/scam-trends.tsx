import { createFileRoute } from "@tanstack/react-router";
import { CalendarBlank, MapTrifold, ShieldWarning } from "@phosphor-icons/react";
import { ScamMapIndexPanel } from "@/components/ScamMapIndexPanel";
import { SchemeTrendsPanel } from "@/components/SchemeTrendsPanel";
import { Callout, PageHero } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/scam-trends")({
  component: ScamTrendsPage,
});

const COPY = {
  ru: {
    eyebrow: "Карта схем",
    title: ["Актуальные схемы.", "Узнайте их до клика."],
    lead: "Это обучающая страница: мы показываем **повторяющиеся тактики**, а не публикуем сырые жалобы, номера, ссылки или usernames.",
    asideTitle: "Осторожно: тренд не равен обвинению",
    asideText:
      "Даже если сообщение похоже на одну из схем, итог зависит от конкретного текста, ссылки, номера и того, что вас просят сделать.",
    updated: "Обновлено: июль 2026",
  },
  uz: {
    eyebrow: "Sxemalar xaritasi",
    title: ["Dolzarb sxemalar.", "Bosishdan oldin taning."],
    lead: "Bu o‘quv sahifa: xom shikoyat, raqam, havola yoki username emas, **takrorlanuvchi taktikalarni** ko‘rsatamiz.",
    asideTitle: "Ehtiyot: trend ayblov emas",
    asideText:
      "Xabar sxemaga o‘xshasa ham, yakuniy baho aniq matn, havola, raqam va sizdan nima so‘ralganiga bog‘liq.",
    updated: "Yangilangan: iyul 2026",
  },
  en: {
    eyebrow: "Scheme map",
    title: ["Current schemes.", "Spot them before you click."],
    lead: "This is an education page: it shows **recurring tactics**, not raw reports, phone numbers, links or usernames.",
    asideTitle: "Careful: a trend is not an accusation",
    asideText:
      "Even if a message resembles a scheme, the verdict depends on the exact text, link, number and requested action.",
    updated: "Updated: July 2026",
  },
} as const;

function ScamTrendsPage() {
  const { lang } = useLang();
  const copy = COPY[lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <PageHero
          icon={<MapTrifold weight="bold" />}
          eyebrow={copy.eyebrow}
          title={copy.title}
          lead={copy.lead}
          aside={
            <Callout tone="alert" icon={<ShieldWarning weight="bold" />} title={copy.asideTitle}>
              <p>{copy.asideText}</p>
              <span className="vp-callout-meta">
                <CalendarBlank weight="bold" aria-hidden="true" />
                {copy.updated}
              </span>
            </Callout>
          }
        />
        <ScamMapIndexPanel />
        <SchemeTrendsPanel />
      </div>
    </div>
  );
}
