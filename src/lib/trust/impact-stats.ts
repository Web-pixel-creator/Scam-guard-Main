export interface PublicStats {
  total: number;
  today: number;
  confirmed_entities: number;
  high_risk: number;
  suspicious: number;
  dangerous: number;
  reports_total: number;
  reports_with_loss_amount: number;
  reported_loss_uzs: number;
}

export const PUBLIC_STATS_KEYS = [
  "total",
  "today",
  "confirmed_entities",
  "high_risk",
  "suspicious",
  "dangerous",
  "reports_total",
  "reports_with_loss_amount",
  "reported_loss_uzs",
] as const satisfies ReadonlyArray<keyof PublicStats>;

export const EMPTY_PUBLIC_STATS: PublicStats = {
  total: 0,
  today: 0,
  confirmed_entities: 0,
  high_risk: 0,
  suspicious: 0,
  dangerous: 0,
  reports_total: 0,
  reports_with_loss_amount: 0,
  reported_loss_uzs: 0,
};

function toSafeInteger(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
  }

  return 0;
}

export function normalizePublicStatsRow(
  row: unknown,
  overrides: Partial<PublicStats> = {},
): PublicStats {
  const source =
    row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};

  const normalized = { ...EMPTY_PUBLIC_STATS };
  for (const key of PUBLIC_STATS_KEYS) normalized[key] = toSafeInteger(source[key]);

  const merged = { ...normalized, ...overrides };
  merged.dangerous = merged.dangerous || merged.high_risk + merged.suspicious;

  return merged;
}

export function formatImpactNumber(value: number, lang: string): string {
  try {
    return new Intl.NumberFormat(
      lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US",
    ).format(value);
  } catch {
    return String(value);
  }
}

export function formatUzsCompact(value: number, lang: string): string {
  if (value <= 0) {
    return {
      ru: "нет суммы",
      uz: "summa yo'q",
      en: "no amount",
    }[lang]!;
  }

  try {
    return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US", {
      notation: value >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
    }).format(value);
  } catch {
    return String(value);
  }
}
