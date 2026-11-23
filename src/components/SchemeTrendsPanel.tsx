import { useMemo, useState } from "react";
import { MagnifyingGlass, ShieldCheck, ShieldWarning } from "@phosphor-icons/react";
import { Callout, Pill, RowHead } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import {
  filterSchemeTrends,
  getSchemeTrendStats,
  getTrendSeverityRank,
  SCHEME_TREND_CATEGORIES,
  SCHEME_TREND_CATEGORY_LABELS,
  SCHEME_TREND_SOURCE_LABELS,
  SCHEME_TREND_STATUS_LABELS,
  type PublicSchemeTrend,
  type SchemeTrendCategory,
  type SchemeTrendSeverity,
} from "@/lib/trust/scheme-trends";

const SEVERITY_LABEL: Record<SchemeTrendSeverity, Record<"ru" | "uz" | "en", string>> = {
  critical: { ru: "Критично", uz: "Kritik", en: "Critical" },
  high: { ru: "Высокий", uz: "Yuqori", en: "High" },
  medium: { ru: "Средний", uz: "O‘rtacha", en: "Medium" },
};

type CategoryFilter = SchemeTrendCategory | "all";

const TEXT = {
  ru: {
    label: "Тактики",
    note: "Сначала самые опасные",
    stats: ["Публичные тренды", "На контроле", "Критичные", "Коды признаков"],
    search: "Поиск по схемам",
    placeholder: "Поиск: SMS, APK, Stars, wallet, доставка…",
    categories: "Категория",
    all: "Все",
    hook: "Крючок",
    goal: "Цель",
    safe: "Безопасный шаг",
    notice: "Что заметить",
    bot: "Что прислать боту",
    disclaimerTitle: "Это не список обвиняемых",
    disclaimer:
      "Это не список обвиняемых людей или каналов. Это публичная карта тактик: какие крючки встречаются, что обычно хотят получить и какой безопасный шаг сделать первым.",
    emptyTitle: "Ничего не найдено",
    emptyText: "Попробуйте другой запрос или откройте все категории.",
    check: "Проверить сейчас",
    numbers: "Официальные номера",
    report: "Сообщить схему",
  },
  uz: {
    label: "Taktikalar",
    note: "Avval eng xavflilari",
    stats: ["Ommaviy trendlar", "Kuzatuvda", "Kritik", "Belgi kodlari"],
    search: "Sxemalar bo‘yicha qidirish",
    placeholder: "Qidirish: SMS, APK, Stars, wallet, yetkazish…",
    categories: "Kategoriya",
    all: "Hammasi",
    hook: "Ilgak",
    goal: "Maqsad",
    safe: "Xavfsiz qadam",
    notice: "Nimaga e’tibor berish kerak",
    bot: "Botga nima yuborish",
    disclaimerTitle: "Bu ayblanuvchilar ro‘yxati emas",
    disclaimer:
      "Bu odamlar yoki kanallarni ayblash ro‘yxati emas. Bu ommaviy taktika xaritasi: qanday ilgaklar uchraydi, odatda nimani olishmoqchi va birinchi xavfsiz qadam nima.",
    emptyTitle: "Hech narsa topilmadi",
    emptyText: "Boshqa so‘rov kiriting yoki barcha kategoriyalarni oching.",
    check: "Hozir tekshirish",
    numbers: "Rasmiy raqamlar",
    report: "Sxema yuborish",
  },
  en: {
    label: "Tactics",
    note: "Most dangerous first",
    stats: ["Public trends", "Currently watched", "Critical", "Reason codes"],
    search: "Search schemes",
    placeholder: "Search: SMS, APK, Stars, wallet, delivery…",
    categories: "Category",
    all: "All",
    hook: "Hook",
    goal: "Goal",
    safe: "Safe step",
    notice: "What to notice",
    bot: "What to send the bot",
    disclaimerTitle: "This is not a list of accused people",
    disclaimer:
      "This is not a list of accused people or channels. It is a public tactics map: common hooks, likely goals and the safest first step.",
    emptyTitle: "No trends found",
    emptyText: "Try another query or open all categories.",
    check: "Check now",
    numbers: "Official numbers",
    report: "Report a pattern",
  },
} as const;

function TrendCard({ trend }: { trend: PublicSchemeTrend }) {
  const { lang } = useLang();
  const text = TEXT[lang];

  return (
    <article className={`vp-trend vp-trend--${trend.severity}`}>
      <div className="vp-card-top">
        <span>{SCHEME_TREND_CATEGORY_LABELS[trend.category][lang]}</span>
        <span className={`vp-tag vp-tag--${trend.severity}`}>
          {SEVERITY_LABEL[trend.severity][lang]}
        </span>
      </div>
      <h3>{trend.title[lang]}</h3>

      <dl className="vp-trend-grid">
        <div>
          <dt>{text.hook}</dt>
          <dd>{trend.hook[lang]}</dd>
        </div>
        <div>
          <dt>{text.goal}</dt>
          <dd>{trend.goal[lang]}</dd>
        </div>
        <div className="vp-trend-safe">
          <dt>
            <ShieldCheck weight="fill" aria-hidden="true" />
            {text.safe}
          </dt>
          <dd>{trend.safeStep[lang]}</dd>
        </div>
      </dl>

      <div className="vp-trend-foot">
        <div>
          <h4>{text.notice}</h4>
          <div className="vp-chiplist">
            {trend.evidence[lang].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div>
          <h4>{text.bot}</h4>
          <p>{trend.sendToBot[lang]}</p>
        </div>
      </div>

      <div className="vp-trend-meta">
        <span className="vp-trend-status">
          <ShieldCheck weight="fill" aria-hidden="true" />
          {SCHEME_TREND_STATUS_LABELS[trend.status][lang]}
        </span>
        <span>{SCHEME_TREND_SOURCE_LABELS[trend.source][lang]}</span>
        {trend.reasonCodes.slice(0, 3).map((code) => (
          <code key={code}>{code}</code>
        ))}
      </div>
    </article>
  );
}

export function SchemeTrendsPanel() {
  const { lang } = useLang();
  const text = TEXT[lang];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const stats = useMemo(() => getSchemeTrendStats(), []);
  const trends = useMemo(() => {
    return filterSchemeTrends({ category, query }).sort(
      (a, b) => getTrendSeverityRank(b.severity) - getTrendSeverityRank(a.severity),
    );
  }, [category, query]);

  const categoryOptions: CategoryFilter[] = ["all", ...SCHEME_TREND_CATEGORIES];
  const statValues = [stats.total, stats.activeWatch, stats.critical, stats.reasonCodes];

  return (
    <section className="vp-page-section" aria-labelledby="scheme-trends-title">
      <RowHead id="scheme-trends-title" label={text.label} note={text.note} />

      <div className="vp-stats vp-stats--4">
        {text.stats.map((label, index) => (
          <article key={label}>
            <div className="vp-stat-top">
              <span>{label}</span>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <b>{statValues[index]}</b>
          </article>
        ))}
      </div>

      <div className="vp-toolbar">
        <label className="vp-search">
          <MagnifyingGlass weight="bold" aria-hidden="true" />
          <span className="sr-only">{text.search}</span>
          <input
            className="vp-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.placeholder}
          />
        </label>
        <div className="vp-filters" role="group" aria-label={text.categories}>
          {categoryOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="vp-filter"
              aria-pressed={category === option}
              onClick={() => setCategory(option)}
            >
              {option === "all" ? text.all : SCHEME_TREND_CATEGORY_LABELS[option][lang]}
            </button>
          ))}
        </div>
      </div>

      <Callout tone="alert" icon={<ShieldWarning weight="bold" />} title={text.disclaimerTitle}>
        <p>{text.disclaimer}</p>
      </Callout>

      {trends.length > 0 ? (
        <div className="vp-trends">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} />
          ))}
        </div>
      ) : (
        <div className="vp-empty">
          <h3>{text.emptyTitle}</h3>
          <p>{text.emptyText}</p>
        </div>
      )}

      <div className="vp-actions">
        <Pill to="/check">{text.check}</Pill>
        <Pill to="/official-numbers" tone="outline">
          {text.numbers}
        </Pill>
        <Pill to="/report" tone="outline">
          {text.report}
        </Pill>
      </div>
    </section>
  );
}
