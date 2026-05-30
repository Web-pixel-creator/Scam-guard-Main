import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";
import { FancyShell } from "@/components/FancyButton";

export type CheckResult = {
  type: string;
  display: string;
  level: RiskLevel;
  score: number;
  reasons: ReasonCode[];
  explanation: string | null;
  knownReports: number;
};

type LevelStyle = {
  icon: typeof ShieldCheck;
  key: string;
  accent: string;        // hex used for dot/icon
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tag: string;           // SCAM/SAFE/WATCH text
  topBar: string;        // gradient class for top stripe
};

const LEVEL_STYLES: Record<RiskLevel, LevelStyle> = {
  safe: {
    icon: ShieldCheck, key: "risk_safe", accent: "#059669",
    badgeBg: "bg-[#ECFDF5]", badgeBorder: "border-[#A7F3D0]/70", badgeText: "text-[#065F46]",
    tag: "SAFE",
    topBar: "from-[#10B981] via-[#34D399] to-[#6EE7B7]",
  },
  unknown: {
    icon: ShieldQuestion, key: "risk_unknown", accent: "#71717A",
    badgeBg: "bg-[#F4F4F5]", badgeBorder: "border-[#E4E4E7]", badgeText: "text-[#3F3F46]",
    tag: "UNKNOWN",
    topBar: "from-[#FDBA74]/40 via-[#E2E0D8] to-[#FDBA74]/40",
  },
  suspicious: {
    icon: AlertTriangle, key: "risk_suspicious", accent: "#D97706",
    badgeBg: "bg-[#FFFBEB]", badgeBorder: "border-[#FCD34D]/70", badgeText: "text-[#92400E]",
    tag: "WATCH",
    topBar: "from-[#F59E0B] via-[#FBBF24] to-[#FCD34D]",
  },
  high_risk: {
    icon: ShieldAlert, key: "risk_high", accent: "#DC2626",
    badgeBg: "bg-[#FEF2F2]", badgeBorder: "border-[#FCA5A5]/60", badgeText: "text-[#991B1B]",
    tag: "SCAM",
    topBar: "from-[#F97316] via-[#FB923C] to-[#C2410C]",
  },
};

export function RiskResultCard({ result }: { result: CheckResult }) {
  const { lang } = useLang();
  const s = LEVEL_STYLES[result.level];
  const Icon = s.icon;
  const advice = ADVICE[result.level][lang];
  const isHot = result.level === "high_risk" || result.level === "suspicious";

  return (
    <div className="apex-shell">
      <div className="relative bg-white">
        <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${s.topBar} z-[1]`} />
        <div className="p-7 sm:p-9 md:p-10">
          {/* Header strip */}
          <div className="flex items-center justify-between gap-4 mb-8 pb-5 border-b border-[#E2E0D8]">
            <span className="apex-mono inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {isHot && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                    style={{ backgroundColor: s.accent }}
                  />
                )}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.accent }} />
              </span>
              SYS · RESULT
            </span>
            <span className="apex-mono text-right tabular-nums">
              SCORE · {Math.round(result.score)}%
            </span>
          </div>

          {/* Title block */}
          <div className="flex items-start gap-5">
            <div className="grid h-12 w-12 place-items-center rounded-[4px] border border-[#E2E0D8] shrink-0" style={{ color: s.accent }}>
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] border ${s.badgeBg} ${s.badgeBorder} ${s.badgeText} text-[11px] font-medium tracking-[0.08em] uppercase mb-3`}
              >
                <span className="font-mono text-[10px]" style={{ color: s.accent }}>{s.tag}</span>
                <span className="h-3 w-px" style={{ backgroundColor: `${s.accent}55` }} />
                <span>{result.type}</span>
              </span>
              <h3 className="font-sans text-[26px] sm:text-3xl md:text-[34px] font-medium tracking-[-0.04em] text-[#18181B] leading-[1.1]">
                {t(s.key as never, lang)}
              </h3>
              {result.type === "text" ? (
                <blockquote className="mt-3 border-l-2 border-[#E2E0D8] pl-3 text-[13.5px] leading-[1.6] text-[#52525B] font-sans whitespace-pre-wrap break-words line-clamp-4">
                  {result.display}
                </blockquote>
              ) : (
                <p className="mt-2 apex-mono break-all">{result.display}</p>
              )}

              {result.explanation && (
                <p className="mt-5 text-[14.5px] md:text-[15px] leading-[1.65] text-[#52525B] whitespace-pre-line text-pretty">
                  {result.explanation}
                </p>
              )}
            </div>
          </div>

          {/* Reasons */}
          {result.reasons.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#E2E0D8]">
              <p className="label-md mb-4">{t("why_title", lang)}</p>
              <ul className="space-y-2.5">
                {result.reasons.map((r, idx) => (
                  <li key={r} className="flex gap-3 text-[14.5px] leading-[1.6] text-[#52525B]">
                    <span className="apex-mono text-[#A1A1AA] shrink-0 mt-[2px] tabular-nums">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="text-pretty">{REASON_LABELS[r]?.[lang] ?? r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advice */}
          <div className="mt-8 pt-6 border-t border-[#E2E0D8]">
            <p className="label-md mb-4">{t("what_to_do", lang)}</p>
            <ul className="space-y-2.5">
              {advice.map((a, i) => (
                <li key={i} className="flex gap-3 text-[14.5px] leading-[1.6] text-[#18181B]">
                  <span className="text-[#F97316] shrink-0 mt-[1px]" aria-hidden>→</span>
                  <span className="text-pretty">{a}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#E2E0D8] flex flex-wrap items-center justify-between gap-4">
            <span className="apex-mono text-[#71717A]">
              {result.knownReports > 0
                ? `REPORTS · ${result.knownReports}`
                : "REPORTS · 00"}
            </span>
            <div className="flex flex-wrap gap-3">
              <Link to="/report" className="fancy-btn">
                <FancyShell>{t("report_btn", lang)}</FancyShell>
              </Link>
              {isHot && (
                <Link
                  to="/emergency"
                  className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#52525B] underline-offset-4 decoration-[#E2E0D8] hover:text-[#18181B] hover:underline hover:decoration-[#F97316] transition-colors self-center"
                >
                  {t("emergency_cta", lang)}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
