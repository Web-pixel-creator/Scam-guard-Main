export const INCIDENT_ONLY_REDACTED_VALUE = "__ishonch_guard_incident_only__";
export const INCIDENT_ONLY_HASH_PREFIX = "incident-only:";

export function isIncidentOnlyReportProjection(report: {
  entity_type?: string | null;
  redacted_value?: string | null;
}): boolean {
  return report.entity_type === "text" && report.redacted_value === INCIDENT_ONLY_REDACTED_VALUE;
}
