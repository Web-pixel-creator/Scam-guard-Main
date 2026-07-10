import type { Lang } from "@/lib/i18n";
import {
  PUBLIC_SCHEME_TRENDS,
  SCHEME_TREND_CATEGORIES,
  SCHEME_TREND_CATEGORY_LABELS,
  type PublicSchemeTrend,
  type SchemeTrendCategory,
  type SchemeTrendSeverity,
  type SchemeTrendSource,
  type SchemeTrendStatus,
} from "@/lib/trust/scheme-trends";

type LocalizedText = Record<Lang, string>;

export const SCAM_MAP_PRIVACY_POLICY = {
  minModeratedReportsPerRegion: 5,
  minDistinctSchemesPerRegion: 3,
  minSourceTypesPerRegion: 2,
} as const;

export const SCAM_MAP_FORBIDDEN_PUBLIC_FIELDS = [
  "rawReport",
  "description",
  "ocrText",
  "screenshot",
  "phone",
  "phoneNumber",
  "username",
  "url",
  "fullUrl",
  "card",
  "otp",
  "pin",
  "cvv",
  "chatId",
  "userId",
] as const;

export type ScamMapLayer = "national_index" | "regional_suppressed";

export interface ScamMapCategoryBucket {
  id: SchemeTrendCategory;
  label: LocalizedText;
  trendCount: number;
  activeWatchCount: number;
  criticalCount: number;
  highestSeverity: SchemeTrendSeverity;
  sourceTypes: SchemeTrendSource[];
  statuses: SchemeTrendStatus[];
  trendIds: string[];
}

export interface ScamMapRegionBucket {
  id: string;
  label: LocalizedText;
  layer: ScamMapLayer;
  published: boolean;
  trendCount: number;
  suppressionReason: LocalizedText | null;
}

export interface PrivacySafeScamMapIndex {
  updatedAt: string;
  policy: typeof SCAM_MAP_PRIVACY_POLICY;
  summary: {
    trendCount: number;
    categoryCount: number;
    activeWatchCount: number;
    criticalCount: number;
    publicRegionBuckets: number;
    suppressedRegionBuckets: number;
  };
  categoryBuckets: ScamMapCategoryBucket[];
  regionBuckets: ScamMapRegionBucket[];
}

const SEVERITY_RANK: Record<SchemeTrendSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function highestSeverity(trends: readonly PublicSchemeTrend[]): SchemeTrendSeverity {
  return trends.reduce<SchemeTrendSeverity>((highest, trend) => {
    return SEVERITY_RANK[trend.severity] > SEVERITY_RANK[highest] ? trend.severity : highest;
  }, "medium");
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

export function isRegionBucketPublishable(input: {
  moderatedReports: number;
  distinctSchemes: number;
  sourceTypes: number;
}): boolean {
  return (
    input.moderatedReports >= SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion &&
    input.distinctSchemes >= SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion &&
    input.sourceTypes >= SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion
  );
}

export function buildScamMapCategoryBuckets(
  trends: readonly PublicSchemeTrend[] = PUBLIC_SCHEME_TRENDS,
): ScamMapCategoryBucket[] {
  return SCHEME_TREND_CATEGORIES.map((category) => {
    const categoryTrends = trends.filter((trend) => trend.category === category);
    return {
      id: category,
      label: SCHEME_TREND_CATEGORY_LABELS[category],
      trendCount: categoryTrends.length,
      activeWatchCount: categoryTrends.filter((trend) => trend.status === "active_watch").length,
      criticalCount: categoryTrends.filter((trend) => trend.severity === "critical").length,
      highestSeverity: highestSeverity(categoryTrends),
      sourceTypes: uniqueSorted(categoryTrends.map((trend) => trend.source)),
      statuses: uniqueSorted(categoryTrends.map((trend) => trend.status)),
      trendIds: categoryTrends.map((trend) => trend.id),
    };
  }).filter((bucket) => bucket.trendCount > 0);
}

export function getPrivacySafeScamMapIndex(
  trends: readonly PublicSchemeTrend[] = PUBLIC_SCHEME_TRENDS,
): PrivacySafeScamMapIndex {
  const categoryBuckets = buildScamMapCategoryBuckets(trends);
  const activeWatchCount = trends.filter((trend) => trend.status === "active_watch").length;
  const criticalCount = trends.filter((trend) => trend.severity === "critical").length;

  const regionBuckets: ScamMapRegionBucket[] = [
    {
      id: "uzbekistan-national",
      label: {
        ru: "Узбекистан: общая карта тактик",
        uz: "O'zbekiston: umumiy taktika xaritasi",
        en: "Uzbekistan: national tactics map",
      },
      layer: "national_index",
      published: true,
      trendCount: trends.length,
      suppressionReason: null,
    },
    {
      id: "regional-low-counts",
      label: {
        ru: "Региональные бакеты",
        uz: "Hududiy guruhlar",
        en: "Regional buckets",
      },
      layer: "regional_suppressed",
      published: false,
      trendCount: 0,
      suppressionReason: {
        ru: "Не публикуем города/районы, пока нет достаточного числа модерированных агрегатов.",
        uz: "Yetarli moderatsiyalangan agregatlar bo'lmaguncha shahar/tumanlarni ko'rsatmaymiz.",
        en: "Cities and districts stay hidden until enough moderated aggregate data exists.",
      },
    },
  ];

  return {
    updatedAt: "2026-07-02",
    policy: SCAM_MAP_PRIVACY_POLICY,
    summary: {
      trendCount: trends.length,
      categoryCount: categoryBuckets.length,
      activeWatchCount,
      criticalCount,
      publicRegionBuckets: regionBuckets.filter((bucket) => bucket.published).length,
      suppressedRegionBuckets: regionBuckets.filter((bucket) => !bucket.published).length,
    },
    categoryBuckets,
    regionBuckets,
  };
}
