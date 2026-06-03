// ReasonTimeline — shows the risk decision breakdown for a check.
// Used by: admin panel (per-report), future check detail view.
// Takes reason codes and shows: matched patterns, severity, what triggered.

import { useLang } from "@/lib/lang-context";
import { REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";
import { findMatchingPatterns } from "@/lib/scam-patterns";

interface ReasonTimelineProps {
  reasonCodes: ReasonCode[];
  riskLevel: RiskLevel;
  score: number;
  hasAiExplanation: boolean;
  verifiedContact?: { orgName: string } | null;
}

const LEVEL_COLORS: Record<RiskLevel, string> = {
  safe: "text-green-700 bg-green-50",
  unknown: "text-gray-700 bg-gray-50",
  suspicious: "text-orange-700 bg-orange-50",
  high_risk: "text-red-700 bg-red-50",
};

const LEVEL_LABELS: Record<RiskLevel, Record<string, string>> = {
  safe: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  unknown: { ru: "Неизвестно", uz: "Noma'lum", en: "Unknown" },
  suspicious: { ru: "Подозрительно", uz: "Shubhali", en: "Suspicious" },
  high_risk: { ru: "Высокий риск", uz: "Yuqori xavf", en: "High risk" },
};

export function ReasonTimeline({
  reasonCodes,
  riskLevel,
  score,
  hasAiExplanation,
  verifiedContact,
}: ReasonTimelineProps) {
  const { lang } = useLang();
  const matchingPatterns = findMatchingPatterns(reasonCodes);

  return (
    <div className="border rounded-lg p-4 bg-[#FAFAF9] space-y-3 text-[13px]">
      <h4 className="font-semibold text-[#18181B] text-[14px]">
        {{ ru: "Анализ решения", uz: "Qaror tahlili", en: "Decision Analysis" }[lang]}
      </h4>

      {/* Risk level + score */}
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-[12px] font-bold ${LEVEL_COLORS[riskLevel]}`}>
          {LEVEL_LABELS[riskLevel][lang]}
        </span>
        <span className="text-[#71717A]">Score: {score}</span>
      </div>

      {/* Reason codes */}
      {reasonCodes.length > 0 && (
        <div>
          <p className="text-[#71717A] mb-1">
            {
              { ru: "Сработавшие правила:", uz: "Ishga tushgan qoidalar:", en: "Triggered rules:" }[
                lang
              ]
            }
          </p>
          <ul className="space-y-0.5 pl-3">
            {reasonCodes.map((code) => (
              <li key={code} className="text-[#52525B]">
                • {REASON_LABELS[code]?.[lang] ?? code}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Matching patterns */}
      {matchingPatterns.length > 0 && (
        <div>
          <p className="text-[#71717A] mb-1">
            {{ ru: "Похожие схемы:", uz: "O'xshash sxemalar:", en: "Matching patterns:" }[lang]}
          </p>
          <ul className="space-y-0.5 pl-3">
            {matchingPatterns.slice(0, 3).map((p) => (
              <li key={p.id} className="text-[#52525B]">
                • {p.title[lang]} <span className="text-[#A1A1AA]">({p.severity})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verified contact */}
      {verifiedContact && (
        <p className="text-green-700">
          ✅ {{ ru: "Verified:", uz: "Tasdiqlangan:", en: "Verified:" }[lang]}{" "}
          {verifiedContact.orgName}
        </p>
      )}

      {/* AI status */}
      <p className="text-[#A1A1AA]">
        AI:{" "}
        {hasAiExplanation
          ? { ru: "объяснение доступно", uz: "tushuntirish mavjud", en: "explanation available" }[
              lang
            ]
          : { ru: "нет (только правила)", uz: "yo'q (faqat qoidalar)", en: "none (rules only)" }[
              lang
            ]}
      </p>
    </div>
  );
}
