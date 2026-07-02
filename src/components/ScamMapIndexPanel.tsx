import { AlertTriangle, Layers, Lock, Map, ShieldCheck } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import {
  getPrivacySafeScamMapIndex,
  SCAM_MAP_PRIVACY_POLICY,
  type ScamMapCategoryBucket,
} from "@/lib/trust/scam-map-index";
import type { SchemeTrendSeverity } from "@/lib/trust/scheme-trends";

const SEVERITY_LABEL: Record<SchemeTrendSeverity, Record<"ru" | "uz" | "en", string>> = {
  critical: { ru: "Критично", uz: "Kritik", en: "Critical" },
  high: { ru: "Высокий", uz: "Yuqori", en: "High" },
  medium: { ru: "Средний", uz: "O'rtacha", en: "Medium" },
};

const SEVERITY_CLASS: Record<SchemeTrendSeverity, string> = {
  critical: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
  high: "border-[#FED7AA] bg-[#FFF7ED] text-[#9A3412]",
  medium: "border-[#FDE68A] bg-[#FEFCE8] text-[#854D0E]",
};

function CategoryIndexRow({ bucket }: { bucket: ScamMapCategoryBucket }) {
  const { lang } = useLang();

  return (
    <li className="grid gap-3 border-t border-[#F4F2EB] py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-bold text-[#18181B]">{bucket.label[lang]}</p>
          <span
            className={`rounded-[999px] border px-2 py-0.5 text-[11px] font-bold ${SEVERITY_CLASS[bucket.highestSeverity]}`}
          >
            {SEVERITY_LABEL[bucket.highestSeverity][lang]}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#71717A]">
          {
            {
              ru: `${bucket.trendCount} тактик, ${bucket.activeWatchCount} сейчас на контроле`,
              uz: `${bucket.trendCount} taktika, ${bucket.activeWatchCount} hozir kuzatuvda`,
              en: `${bucket.trendCount} tactics, ${bucket.activeWatchCount} currently watched`,
            }[lang]
          }
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {bucket.sourceTypes.map((source) => (
          <span
            key={source}
            className="rounded-[6px] bg-[#F4F2EB] px-2.5 py-1 text-[11.5px] font-semibold text-[#52525B]"
          >
            {source.replaceAll("_", " ")}
          </span>
        ))}
      </div>
    </li>
  );
}

export function ScamMapIndexPanel() {
  const { lang } = useLang();
  const index = getPrivacySafeScamMapIndex();
  const suppressedRegion = index.regionBuckets.find((bucket) => !bucket.published);

  return (
    <section
      aria-labelledby="scam-map-index-title"
      className="mb-8 rounded-[8px] border border-[#E2E0D8] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(11,11,15,0.35)] sm:p-6"
    >
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#0F766E]">
            <Map aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {
              {
                ru: "privacy-safe index",
                uz: "privacy-safe indeks",
                en: "privacy-safe index",
              }[lang]
            }
          </p>
          <h2
            id="scam-map-index-title"
            className="font-sans text-[25px] font-medium leading-[1.08] tracking-[-0.035em] text-[#18181B] sm:text-[32px]"
          >
            {
              {
                ru: "Карта показывает типы схем, а не людей, номера или чаты",
                uz: "Xarita odam, raqam yoki chatlarni emas, sxema turlarini ko'rsatadi",
                en: "The map shows scheme types, not people, numbers or chats",
              }[lang]
            }
          </h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Публичный слой строится из правил, research-feed категорий и модерированных агрегатов. Малые региональные группы скрыты, чтобы нельзя было восстановить жалобы или личности.",
                uz: "Ommaviy qatlam qoidalar, research-feed kategoriyalari va moderatsiyalangan agregatlardan tuziladi. Kichik hududiy guruhlar shikoyat yoki shaxsni tiklab bo'lmasligi uchun yashiriladi.",
                en: "The public layer is built from rules, research-feed categories and moderated aggregates. Small regional groups stay hidden so reports or identities cannot be reconstructed.",
              }[lang]
            }
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              {
                icon: Layers,
                value: index.summary.categoryCount,
                label: { ru: "типов схем", uz: "sxema turi", en: "scheme types" }[lang],
              },
              {
                icon: ShieldCheck,
                value: index.summary.trendCount,
                label: { ru: "публичных тактик", uz: "ommaviy taktika", en: "public tactics" }[
                  lang
                ],
              },
              {
                icon: AlertTriangle,
                value: index.summary.criticalCount,
                label: { ru: "критичных", uz: "kritik", en: "critical" }[lang],
              },
              {
                icon: Lock,
                value: index.summary.suppressedRegionBuckets,
                label: { ru: "слоёв скрыто", uz: "qatlam yashirin", en: "layers hidden" }[lang],
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-[6px] border border-[#F4F2EB] bg-[#FAFAF8] p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Icon aria-hidden="true" className="h-4 w-4 text-[#0F766E]" strokeWidth={2} />
                    <span className="font-display text-[22px] font-extrabold leading-none text-[#0B0B0F] tabular-nums">
                      {item.value}
                    </span>
                  </div>
                  <p className="text-[11.5px] font-semibold leading-snug text-[#71717A]">
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[8px] border border-[#E2E0D8] bg-[#FAFAF8] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Layers aria-hidden="true" className="h-4 w-4 text-[#0F766E]" strokeWidth={2} />
              <h3 className="text-[15px] font-bold text-[#18181B]">
                {
                  {
                    ru: "Индекс по типам схем",
                    uz: "Sxema turlari indeksi",
                    en: "Index by scheme type",
                  }[lang]
                }
              </h3>
            </div>
            <ul>
              {index.categoryBuckets.map((bucket) => (
                <CategoryIndexRow key={bucket.id} bucket={bucket} />
              ))}
            </ul>
          </div>

          <div className="rounded-[8px] border border-[#C7D2FE] bg-[#EEF2FF] p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-white text-[#3730A3]">
                <Lock aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-[#18181B]">
                  {
                    {
                      ru: "Региональный слой пока закрыт",
                      uz: "Hududiy qatlam hozircha yopiq",
                      en: "Regional layer is locked for now",
                    }[lang]
                  }
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#3730A3]">
                  {suppressedRegion?.suppressionReason?.[lang]}
                </p>
                <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-[#312E81]">
                  {
                    {
                      ru: `Порог: минимум ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} модерированных записей, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} разных схемы и ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} типа источников на регион.`,
                      uz: `Chegara: har hudud uchun kamida ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} moderatsiyalangan yozuv, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} xil sxema va ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} manba turi.`,
                      en: `Threshold: at least ${SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion} moderated records, ${SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion} distinct schemes and ${SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion} source types per region.`,
                    }[lang]
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
