import { LockKey, ShieldCheck, Stack, Warning, Lock } from "@phosphor-icons/react";

import { Callout, RowHead } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import {
  getPrivacySafeScamMapIndex,
  SCAM_MAP_PRIVACY_POLICY,
  type ScamMapCategoryBucket,
} from "@/lib/trust/scam-map-index";
import type { SchemeTrendSeverity, SchemeTrendSource } from "@/lib/trust/scheme-trends";

const SEVERITY_LABEL: Record<SchemeTrendSeverity, Record<"ru" | "uz" | "en", string>> = {
  critical: { ru: "Критично", uz: "Kritik", en: "Critical" },
  high: { ru: "Высокий", uz: "Yuqori", en: "High" },
  medium: { ru: "Средний", uz: "O‘rtacha", en: "Medium" },
};

// Plain words for the data sources behind each category.
const SOURCE_CHIP: Record<SchemeTrendSource, Record<"ru" | "uz" | "en", string>> = {
  coverage: { ru: "правила", uz: "qoidalar", en: "rules" },
  research_feed: {
    ru: "мониторинг новостей",
    uz: "yangiliklar monitoringi",
    en: "news monitoring",
  },
  moderated_aggregate: {
    ru: "проверенные жалобы",
    uz: "tekshirilgan shikoyatlar",
    en: "moderated reports",
  },
};

const TEXT = {
  ru: {
    label: "Индекс схем",
    note: "Только типы схем — без людей и номеров",
    title: "Карта показывает типы схем, а не людей, номера или чаты",
    lead: "Публичный слой строится из правил, мониторинга новостей и проверенных жалоб в обобщённом виде. Малые региональные группы скрыты, чтобы нельзя было восстановить жалобы или личности.",
    index: "Индекс по типам схем",
    stats: ["Типы схем", "Публичные тактики", "Критичные", "Скрытые слои"],
    locked: "Региональный слой пока закрыт",
  },
  uz: {
    label: "Sxemalar indeksi",
    note: "Faqat sxema turlari — odamlar va raqamlarsiz",
    title: "Xarita odam, raqam yoki chatlarni emas, sxema turlarini ko‘rsatadi",
    lead: "Ommaviy qatlam qoidalar, yangiliklar monitoringi va tekshirilgan shikoyatlarning umumlashtirilgan ma’lumotlaridan tuziladi. Kichik hududiy guruhlar shikoyat yoki shaxsni tiklab bo‘lmasligi uchun yashiriladi.",
    index: "Sxema turlari indeksi",
    stats: ["Sxema turlari", "Ommaviy taktikalar", "Kritik", "Yashirin qatlamlar"],
    locked: "Hududiy qatlam hozircha yopiq",
  },
  en: {
    label: "Scheme index",
    note: "Scheme types only — no people or numbers",
    title: "The map shows scheme types, not people, numbers or chats",
    lead: "The public layer is built from rules, news monitoring and moderated reports in aggregate. Small regional groups stay hidden so reports or identities cannot be reconstructed.",
    index: "Index by scheme type",
    stats: ["Scheme types", "Public tactics", "Critical", "Hidden layers"],
    locked: "Regional layer is locked for now",
  },
} as const;

function CategoryIndexRow({ bucket }: { bucket: ScamMapCategoryBucket }) {
  const { lang } = useLang();

  return (
    <li>
      <div className="vp-index-row-main">
        <strong>{bucket.label[lang]}</strong>
        <span className={`vp-tag vp-tag--${bucket.highestSeverity}`}>
          {SEVERITY_LABEL[bucket.highestSeverity][lang]}
        </span>
      </div>
      <p>
        {
          {
            ru: `${bucket.trendCount} тактик, ${bucket.activeWatchCount} сейчас на контроле`,
            uz: `${bucket.trendCount} taktika, ${bucket.activeWatchCount} hozir kuzatuvda`,
            en: `${bucket.trendCount} tactics, ${bucket.activeWatchCount} currently watched`,
          }[lang]
        }
      </p>
      <div className="vp-chiplist">
        {bucket.sourceTypes.map((source) => (
          <span key={source}>{SOURCE_CHIP[source][lang]}</span>
        ))}
      </div>
    </li>
  );
}

export function ScamMapIndexPanel() {
  const { lang } = useLang();
  const text = TEXT[lang];
  const index = getPrivacySafeScamMapIndex();
  const suppressedRegion = index.regionBuckets.find((bucket) => !bucket.published);
  const stats = [
    { icon: Stack, value: index.summary.categoryCount },
    { icon: ShieldCheck, value: index.summary.trendCount },
    { icon: Warning, value: index.summary.criticalCount },
    { icon: Lock, value: index.summary.suppressedRegionBuckets },
  ];

  return (
    <section className="vp-page-section" aria-labelledby="scam-map-index-title">
      <RowHead id="scam-map-index-title" label={text.label} note={text.note} />
      <div className="vp-split">
        <article className="vp-card">
          <h3 className="vp-card-title">{text.title}</h3>
          <p className="vp-card-text">{text.lead}</p>
          <div className="vp-mini-stats">
            {stats.map(({ icon: Icon, value }, position) => (
              <div key={text.stats[position]}>
                <Icon weight="bold" aria-hidden="true" />
                <b>{value}</b>
                <span>{text.stats[position]}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="vp-stack">
          <article className="vp-card">
            <div className="vp-card-top">
              <span className="vp-card-icon" aria-hidden="true">
                <Stack weight="bold" />
              </span>
              <span>{text.index}</span>
            </div>
            <ul className="vp-index-list">
              {index.categoryBuckets.map((bucket) => (
                <CategoryIndexRow key={bucket.id} bucket={bucket} />
              ))}
            </ul>
          </article>

          <Callout icon={<LockKey weight="bold" />} title={text.locked}>
            <p>{suppressedRegion?.suppressionReason?.[lang]}</p>
            <p className="vp-callout-meta">
              {
                {
                  ru: `Порог: минимум ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} модерированных записей, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} разных схемы и ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} типа источников на регион.`,
                  uz: `Chegara: har hudud uchun kamida ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} moderatsiyalangan yozuv, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} xil sxema va ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} manba turi.`,
                  en: `Threshold: at least ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} moderated records, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} distinct schemes and ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} source types per region.`,
                }[lang]
              }
            </p>
          </Callout>
        </div>
      </div>
    </section>
  );
}
