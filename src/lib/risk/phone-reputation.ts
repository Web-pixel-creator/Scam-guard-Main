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

export function phoneReputationConfidence(confirmedReportCount: number): PhoneReputationConfidence {
  if (confirmedReportCount >= 5) return "high";
  if (confirmedReportCount >= 2) return "medium";
  return "low";
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
