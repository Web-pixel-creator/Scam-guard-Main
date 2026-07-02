import type { Lang } from "@/lib/i18n";
import type { RiskLevel } from "./rules";

export type PhoneReputationSource = "ishonch_guard_moderated_reports";
export type PhoneReputationConfidence = "low" | "medium" | "high";

export interface PhoneReputationSummary {
  source: PhoneReputationSource;
  confirmedReportCount: number;
  confidence: PhoneReputationConfidence;
  riskLevel: RiskLevel;
  publicScope: "confirmed_moderated_reports_only";
}

type EntityReputationRow = {
  report_count?: number | null;
  risk_level?: string | null;
  moderation_status?: string | null;
};

const RISK_LEVELS = new Set<RiskLevel>(["safe", "unknown", "suspicious", "high_risk"]);

const PHONE_REPUTATION_COPY: Record<
  Lang,
  {
    noConfirmedReports: string;
    evidence: (count: number, confidence: PhoneReputationConfidence) => string;
    scope: string;
  }
> = {
  ru: {
    noConfirmedReports:
      "Подтверждённых модерированных жалоб в Ishonch Guard не найдено. Это не гарантия безопасности.",
    evidence: (count, confidence) =>
      `Источник: подтверждённые модераторами жалобы Ishonch Guard. Количество: ${count} подтверждённых жалоб. Уверенность: ${phoneReputationConfidenceLabel(confidence, "ru")}.`,
    scope:
      "Не включает непроверенные жалобы, владельца номера, данные оператора или скрытые внешние метки.",
  },
  uz: {
    noConfirmedReports:
      "Ishonch Guardda moderatsiyadan o'tgan tasdiqlangan shikoyat topilmadi. Bu xavfsizlik kafolati emas.",
    evidence: (count, confidence) =>
      `Manba: Ishonch Guard moderatorlari tasdiqlagan shikoyatlar. Soni: ${count} ta tasdiqlangan shikoyat. Ishonchlilik: ${phoneReputationConfidenceLabel(confidence, "uz")}.`,
    scope:
      "Tekshirilmagan shikoyatlar, raqam egasi, operator ma'lumoti yoki yashirin tashqi belgilar kiritilmaydi.",
  },
  en: {
    noConfirmedReports:
      "No moderator-confirmed Ishonch Guard reports found. This is not a safety guarantee.",
    evidence: (count, confidence) =>
      `Source: Ishonch Guard moderator-confirmed reports. Count: ${count} confirmed report(s). Confidence: ${phoneReputationConfidenceLabel(confidence, "en")}.`,
    scope:
      "Does not include unverified reports, number owner data, carrier data, or hidden external labels.",
  },
};

export function phoneReputationConfidence(confirmedReportCount: number): PhoneReputationConfidence {
  if (confirmedReportCount >= 5) return "high";
  if (confirmedReportCount >= 2) return "medium";
  return "low";
}

export function phoneReputationConfidenceLabel(
  confidence: PhoneReputationConfidence,
  lang: Lang,
): string {
  const labels: Record<PhoneReputationConfidence, Record<Lang, string>> = {
    low: { ru: "низкая", uz: "past", en: "low" },
    medium: { ru: "средняя", uz: "o'rtacha", en: "medium" },
    high: { ru: "высокая", uz: "yuqori", en: "high" },
  };
  return labels[confidence][lang];
}

export function formatPhoneReputationEvidenceLine(
  summary: PhoneReputationSummary,
  lang: Lang,
): string {
  return PHONE_REPUTATION_COPY[lang].evidence(summary.confirmedReportCount, summary.confidence);
}

export function formatNoPhoneReputationLine(lang: Lang): string {
  return PHONE_REPUTATION_COPY[lang].noConfirmedReports;
}

export function formatPhoneReputationScopeLine(lang: Lang): string {
  return PHONE_REPUTATION_COPY[lang].scope;
}

export function buildPhoneReputationSummary(
  row: EntityReputationRow | null | undefined,
): PhoneReputationSummary | null {
  if (!row || row.moderation_status !== "confirmed") return null;

  const confirmedReportCount = Math.max(0, Math.floor(Number(row.report_count ?? 0)));
  if (confirmedReportCount <= 0) return null;

  const riskLevel = RISK_LEVELS.has(row.risk_level as RiskLevel)
    ? (row.risk_level as RiskLevel)
    : "unknown";

  return {
    source: "ishonch_guard_moderated_reports",
    confirmedReportCount,
    confidence: phoneReputationConfidence(confirmedReportCount),
    riskLevel,
    publicScope: "confirmed_moderated_reports_only",
  };
}
