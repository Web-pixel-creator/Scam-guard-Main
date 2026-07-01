export type OperatorQueueSortMode = "priority" | "newest";
export type OperatorQueueBand = "review_next" | "needs_context" | "standard";

export type OperatorQueueReport = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  amount_lost_uzs?: number | null;
  target_signal_count?: number | null;
  target_report_count?: number | null;
  target_check_risk_level?: string | null;
  target_check_risk_score?: number | null;
  target_check_reason_codes?: string[] | null;
  target_check_created_at?: string | null;
};

export type OperatorQueuePriority = {
  band: OperatorQueueBand;
  score: number;
  signals: number;
  reasonCount: number;
};

export type OperatorQueueSummary = {
  total: number;
  reviewNext: number;
  needsContext: number;
  repeatedTargets: number;
};

const RISK_LEVEL_SCORE: Record<string, number> = {
  high_risk: 36,
  suspicious: 22,
  unknown: 4,
  safe: -12,
};

export function operatorQueuePriority(report: OperatorQueueReport): OperatorQueuePriority {
  const signals = reportSignalCount(report);
  const reasonCount = reportReasonCodes(report).length;
  const riskScore = finiteNumber(report.target_check_risk_score);
  const riskLevel = report.target_check_risk_level ?? "";
  const hasCheckContext =
    Boolean(report.target_check_created_at) ||
    typeof riskScore === "number" ||
    reasonCount > 0 ||
    Boolean(riskLevel);

  let score = report.status === "new" ? 12 : 0;
  score += RISK_LEVEL_SCORE[riskLevel] ?? 0;
  if (typeof riskScore === "number") {
    if (riskScore >= 80) score += 44;
    else if (riskScore >= 60) score += 34;
    else if (riskScore >= 40) score += 18;
    else if (riskScore <= 15) score -= 6;
  }
  if (signals >= 4) score += 32;
  else if (signals === 3) score += 24;
  else if (signals === 2) score += 15;
  score += Math.min(reasonCount, 4) * 4;
  if ((report.amount_lost_uzs ?? 0) > 0) score += 6;

  const band =
    score >= 58 || riskLevel === "high_risk" || (signals > 1 && (riskScore ?? 0) >= 40)
      ? "review_next"
      : !hasCheckContext && signals <= 1
        ? "needs_context"
        : "standard";

  return { band, score, signals, reasonCount };
}

export function operatorQueueSummary(reports: OperatorQueueReport[]): OperatorQueueSummary {
  return reports.reduce<OperatorQueueSummary>(
    (summary, report) => {
      const priority = operatorQueuePriority(report);
      summary.total += 1;
      if (priority.band === "review_next") summary.reviewNext += 1;
      if (priority.band === "needs_context") summary.needsContext += 1;
      if (priority.signals > 1) summary.repeatedTargets += 1;
      return summary;
    },
    { total: 0, reviewNext: 0, needsContext: 0, repeatedTargets: 0 },
  );
}

export function sortOperatorQueueReports<Report extends OperatorQueueReport>(
  reports: Report[],
  mode: OperatorQueueSortMode,
): Report[] {
  const withIndex = reports.map((report, index) => ({ report, index }));
  withIndex.sort((a, b) => {
    if (mode === "newest") {
      return compareDateDesc(a.report.created_at, b.report.created_at) || a.index - b.index;
    }

    const aPriority = operatorQueuePriority(a.report);
    const bPriority = operatorQueuePriority(b.report);
    return (
      bPriority.score - aPriority.score ||
      compareDateDesc(a.report.created_at, b.report.created_at) ||
      a.index - b.index
    );
  });
  return withIndex.map(({ report }) => report);
}

function reportSignalCount(report: OperatorQueueReport) {
  const value = finiteNumber(report.target_signal_count ?? report.target_report_count);
  return typeof value === "number" && value > 0 ? Math.round(value) : 1;
}

function reportReasonCodes(report: OperatorQueueReport): string[] {
  return (report.target_check_reason_codes ?? []).filter(
    (code): code is string => typeof code === "string" && code.trim().length > 0,
  );
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function compareDateDesc(a?: string | null, b?: string | null) {
  return dateMs(b) - dateMs(a);
}

function dateMs(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
