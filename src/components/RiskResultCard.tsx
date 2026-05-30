import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";

export type CheckResult = {
  type: string;
  display: string;
  level: RiskLevel;
  score: number;
  reasons: ReasonCode[];
  explanation: string | null;
  knownReports: number;
};

const LEVEL_STYLES: Record<RiskLevel, { bg: string; text: string; ring: string; icon: typeof ShieldCheck; key: string }> = {
  safe:       { bg: "bg-safe/10",       text: "text-safe",       ring: "ring-safe/30",       icon: ShieldCheck,    key: "risk_safe" },
  unknown:    { bg: "bg-muted",         text: "text-muted-foreground", ring: "ring-border",  icon: ShieldQuestion, key: "risk_unknown" },
  suspicious: { bg: "bg-warn/15",       text: "text-warn-foreground",  ring: "ring-warn/40", icon: AlertTriangle,  key: "risk_suspicious" },
  high_risk:  { bg: "bg-danger/10",     text: "text-danger",     ring: "ring-danger/30",     icon: ShieldAlert,    key: "risk_high" },
};

export function RiskResultCard({ result }: { result: CheckResult }) {
  const { lang } = useLang();
  const s = LEVEL_STYLES[result.level];
  const Icon = s.icon;
  const advice = ADVICE[result.level][lang];

  return (
    <Card className={`p-6 ring-1 ${s.ring} ${s.bg}`}>
      <div className="flex items-start gap-4">
        <div className={`grid h-12 w-12 place-items-center rounded-xl bg-background ${s.text}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className={`text-xl font-semibold ${s.text}`}>{t(s.key as never, lang)}</h3>
            <span className="text-sm text-muted-foreground">
              {result.type} · {result.display}
            </span>
          </div>
          {result.explanation && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
              {result.explanation}
            </p>
          )}
        </div>
      </div>

      {result.reasons.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {t("why_title", lang)}
          </p>
          <ul className="space-y-1.5">
            {result.reasons.map((r) => (
              <li key={r} className="text-sm flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{REASON_LABELS[r]?.[lang] ?? r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          {t("what_to_do", lang)}
        </p>
        <ul className="space-y-1.5">
          {advice.map((a, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-primary">→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>

      {result.knownReports > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Похожих жалоб уже зафиксировано: {result.knownReports}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/report">{t("report_btn", lang)} <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
        {(result.level === "high_risk" || result.level === "suspicious") && (
          <Button asChild variant="ghost">
            <Link to="/emergency">{t("emergency_cta", lang)}</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
