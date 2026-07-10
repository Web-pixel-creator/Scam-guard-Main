import type { Lang } from "@/lib/i18n";
import { INCIDENT_ONLY_REDACTED_VALUE } from "@/lib/report-boundary";

export interface QuickReportSubmitData {
  value: string;
  description: string;
  lang: Lang;
  incidentOnly?: true;
}

export function buildQuickReportSubmitData({
  value,
  description,
  lang,
}: {
  value: string;
  description: string;
  lang: Lang;
}): QuickReportSubmitData {
  const trimmedValue = value.trim();
  const trimmedDescription = description.trim();

  if (!trimmedValue) {
    return {
      value: INCIDENT_ONLY_REDACTED_VALUE,
      description: trimmedDescription,
      lang,
      incidentOnly: true,
    };
  }

  return {
    value: trimmedValue,
    description: trimmedDescription,
    lang,
  };
}
