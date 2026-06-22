import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Loader2,
  ShieldCheck,
  Check,
  X,
  LogOut,
  RefreshCcw,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listReports,
  listEntities,
  listReputationAppeals,
  moderateReport,
  resolveReputationAppeal,
  adminStats,
  getEntityCheck,
} from "@/lib/admin.functions";
import { ReasonTimeline } from "@/components/ReasonTimeline";
import type { ReasonCode, RiskLevel } from "@/lib/risk/rules";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Админка — Ishonch Guard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

const FILTERS = ["new", "confirmed", "rejected", "all"] as const;
type FilterKey = (typeof FILTERS)[number];
const APPEAL_FILTERS = ["new", "reviewing", "resolved", "rejected", "all"] as const;
type AppealFilterKey = (typeof APPEAL_FILTERS)[number];

function AdminPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<FilterKey>("new");
  const [appealStatus, setAppealStatus] = useState<AppealFilterKey>("new");
  const qc = useQueryClient();

  const listReportsFn = useServerFn(listReports);
  const listEntitiesFn = useServerFn(listEntities);
  const listAppealsFn = useServerFn(listReputationAppeals);
  const moderateFn = useServerFn(moderateReport);
  const resolveAppealFn = useServerFn(resolveReputationAppeal);
  const statsFn = useServerFn(adminStats);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const stats = useQuery({
    queryKey: ["admin-stats"],
    enabled: !!user && isAdmin,
    queryFn: () => statsFn({ data: undefined as never }),
  });
  const reports = useQuery({
    queryKey: ["admin-reports", status],
    enabled: !!user && isAdmin,
    queryFn: () => listReportsFn({ data: { status } }),
  });
  const entities = useQuery({
    queryKey: ["admin-entities"],
    enabled: !!user && isAdmin,
    queryFn: () => listEntitiesFn({ data: { status: "all" } }),
  });
  const appeals = useQuery({
    queryKey: ["admin-appeals", appealStatus],
    enabled: !!user && isAdmin,
    queryFn: () => listAppealsFn({ data: { status: appealStatus } }),
  });

  const moderate = useMutation({
    mutationFn: (v: { reportId: string; decision: "confirmed" | "rejected" }) =>
      moderateFn({ data: { ...v, riskLevel: "high_risk" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-entities"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
  const resolveAppeal = useMutation({
    mutationFn: (v: {
      appealId: string;
      decision: "remove_reputation" | "keep_reputation";
      note?: string;
    }) => resolveAppealFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-appeals"] });
      qc.invalidateQueries({ queryKey: ["admin-entities"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  if (loading) {
    return (
      <div className="apex-page">
        <div className="apex-card apex-frame apex-stripes text-center">
          <span className="apex-mono inline-flex items-center gap-2 text-[#52525B]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ЗАГРУЗКА…
          </span>
        </div>
      </div>
    );
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="apex-page" style={{ maxWidth: 520 }}>
        <div className="apex-card apex-frame apex-stripes text-center">
          <p className="label-md mb-3">00 — ACCESS</p>
          <h1 className="apex-h1" style={{ fontSize: "clamp(22px, 5vw, 32px)" }}>
            Нет <span className="font-serif-italic text-[#8B8B92]">доступа</span>
          </h1>
          <p className="apex-lead mt-3 sm:mt-4 mx-auto">
            Этот аккаунт не является администратором.
          </p>
          <button
            onClick={() => signOut().then(() => nav({ to: "/login" }))}
            className="apex-btn-outline mt-6 inline-flex items-center gap-2"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="apex-page space-y-8 sm:space-y-10">
      {/* Header */}
      <div className="apex-card apex-frame apex-stripes">
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono">Админка</span>
          <span className="apex-status" data-state="success">
            <span className="apex-status-dot" />
            Вы вошли
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="min-w-0">
            <p className="label-md mb-3">00 — Модерация</p>
            <h1 className="apex-h1">
              Модерация <span className="font-serif-italic text-[#8B8B92]">жалоб</span>
            </h1>
            <p className="apex-mono mt-3 truncate">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["admin-reports"] });
                qc.invalidateQueries({ queryKey: ["admin-entities"] });
                qc.invalidateQueries({ queryKey: ["admin-appeals"] });
                qc.invalidateQueries({ queryKey: ["admin-stats"] });
              }}
              className="apex-btn-outline inline-flex items-center gap-2"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Обновить
            </button>
            <button
              onClick={() => signOut().then(() => nav({ to: "/login" }))}
              className="apex-btn-outline inline-flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Выйти
            </button>
          </div>
        </div>
      </div>

      {/* Stats — hairline grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] rounded-[6px] overflow-hidden">
        <Stat label="Новые жалобы" value={stats.data?.reports_new} highlight />
        <Stat label="Подтверждённых жалоб" value={stats.data?.reports_confirmed} />
        <Stat label="Целей в публичной базе" value={stats.data?.entities_confirmed} />
        <Stat label="Всего проверок" value={stats.data?.checks_total} />
        <Stat label="Апелляции" value={stats.data?.appeals_new} />
      </div>

      {/* Operator guide */}
      <section className="apex-card apex-frame apex-stripes">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr_1fr]">
          <div>
            <p className="label-md mb-2">Как работать</p>
            <h2 className="apex-h2 text-[28px] sm:text-[34px]">Операторский режим</h2>
            <p className="mt-3 text-[14px] leading-[1.7] text-[#52525B] max-w-2xl">
              Telegram-чат нужен только как быстрый сигнал для модератора. Решение, история цели и
              повторные жалобы проверяются здесь, в админке.
            </p>
          </div>
          <div className="border-t border-[#E2E0D8] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="apex-mono mb-2">Что в чате</p>
            <p className="text-[13.5px] leading-[1.7] text-[#52525B]">
              В группу уходит только маска цели и безопасная сводка. Коды, карты, скриншоты и полные
              контакты туда не пересылаются.
            </p>
          </div>
          <div className="border-t border-[#E2E0D8] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <p className="apex-mono mb-2">Как решать</p>
            <p className="text-[13.5px] leading-[1.7] text-[#52525B]">
              Смотрите, что просили сделать, сколько сигналов пришло на цель, есть ли похожие записи
              и не выглядит ли жалоба как ложное обвинение.
            </p>
          </div>
        </div>
      </section>

      {/* Reports */}
      <section className="apex-card apex-frame apex-stripes">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-[#E2E0D8]">
          <div>
            <p className="label-md mb-2">01 — Жалобы</p>
            <h2 className="apex-h2">Входящие жалобы</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#52525B] max-w-2xl">
              Каждая карточка показывает безопасную маску, суть жалобы и силу повторного сигнала.
              Публичная метка появляется только после ручного подтверждения.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`px-3 py-1.5 rounded-[4px] border apex-mono transition-colors ${
                  status === s
                    ? "bg-[#0B0B0F] apex-on-dark border-[#0B0B0F]"
                    : "border-[#E2E0D8] bg-white text-[#52525B] hover:border-[#D4D1C6] hover:text-[#18181B]"
                }`}
              >
                {labelStatus(s)}
              </button>
            ))}
          </div>
        </div>

        {reports.isLoading && (
          <p className="apex-mono inline-flex items-center gap-2 text-[#52525B]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> ЗАГРУЗКА…
          </p>
        )}
        {reports.data?.length === 0 && (
          <p className="apex-mono text-[#71717A]">— ПУСТО. НЕТ ЗАПИСЕЙ —</p>
        )}

        <div className="grid grid-cols-1 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] mt-1">
          {reports.data?.map((r) => (
            <div key={r.id} className="bg-white/90 backdrop-blur-[4px] p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="apex-mono inline-flex items-center px-2 py-0.5 rounded-[3px] border border-[#E2E0D8] bg-white">
                      {r.entity_type}
                    </span>
                    <code className="text-[13px] font-mono text-[#18181B] break-all">
                      {r.redacted_value}
                    </code>
                    <StatusBadge status={r.status} />
                    {r.scam_type && (
                      <span className="apex-mono text-[#71717A]">· {r.scam_type}</span>
                    )}
                    {r.city && <span className="apex-mono text-[#71717A]">· {r.city}</span>}
                    <span
                      className={`apex-mono ${
                        reportSignalCount(r) > 1 ? "text-[#9A3412]" : "text-[#71717A]"
                      }`}
                    >
                      · {reportSignalLabel(reportSignalCount(r))}
                    </span>
                  </div>
                  <p className="text-[14px] leading-[1.6] text-[#18181B] whitespace-pre-wrap prose-pretty">
                    {r.description}
                  </p>
                  <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
                    <ReportFact label="Что проверить" value={r.redacted_value} mono />
                    <ReportFact
                      label="Сигналы по цели"
                      value={reportSignalLabel(reportSignalCount(r))}
                      tone={reportSignalCount(r) > 1 ? "warn" : "neutral"}
                    />
                    <ReportFact label="Тип схемы" value={r.scam_type ?? "не указан"} />
                    <ReportFact label="Город" value={r.city ?? "не указан"} />
                    <ReportFact label="Ущерб" value={formatLoss(r.amount_lost_uzs)} />
                    <ReportFact
                      label="Статус цели"
                      value={labelTargetStatus(r.target_moderation_status)}
                    />
                    <ReportFact label="Риск цели" value={labelRiskLevel(r.target_risk_level)} />
                    <ReportFact
                      label="Последний сигнал"
                      value={formatDateTime(r.target_last_seen_at ?? r.created_at)}
                    />
                  </dl>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#71717A]">
                    В админке тоже показана безопасная маска. Если для решения не хватает контекста,
                    не ставьте публичную метку: жалоба останется в истории, а повторные сигналы
                    усилят приоритет проверки.
                  </p>
                  {reportSignalCount(r) > 1 && (
                    <p className="mt-3 rounded-[4px] border border-[#FDBA74]/60 bg-[#FFF7ED] px-3 py-2 text-[13px] leading-relaxed text-[#7C2D12]">
                      По этой цели уже есть повторные сигналы. Перед публичной меткой проверьте
                      контекст в описании и похожие записи в базе.
                    </p>
                  )}
                  <p className="mt-3 apex-mono text-[#A1A1AA]">
                    {new Date(r.created_at).toLocaleString()} · LANG: {r.language}
                    {r.amount_lost_uzs ? ` · ${r.amount_lost_uzs.toLocaleString()} UZS` : ""}
                  </p>
                </div>
                {r.status === "new" && (
                  <div className="lg:w-[280px] shrink-0 space-y-3">
                    <div className="rounded-[4px] border border-[#E2E0D8] bg-[#FCFBF7] p-3">
                      <p className="apex-mono mb-2 text-[#71717A]">Решение модератора</p>
                      <p className="text-[13px] leading-relaxed text-[#52525B]">
                        {moderationDecisionHint(reportSignalCount(r))}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ reportId: r.id, decision: "confirmed" })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-[#DC2626] text-white apex-on-dark apex-mono hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Подтвердить риск
                      </button>
                      <button
                        type="button"
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ reportId: r.id, decision: "rejected" })}
                        className="apex-btn-outline inline-flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" /> Отклонить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reputation Appeals */}
      <section className="apex-card apex-frame apex-stripes">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-[#E2E0D8]">
          <div>
            <p className="label-md mb-2">02 — Апелляции</p>
            <h2 className="apex-h2">Исправление репутации</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#52525B] max-w-2xl">
              Если апелляция обоснована, снимайте публичную метку. Жалобы остаются в истории
              модерации, но сущность перестаёт отображаться как подтверждённая.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {APPEAL_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setAppealStatus(s)}
                aria-pressed={appealStatus === s}
                className={`px-3 py-1.5 rounded-[4px] border apex-mono transition-colors ${
                  appealStatus === s
                    ? "bg-[#0B0B0F] apex-on-dark border-[#0B0B0F]"
                    : "border-[#E2E0D8] bg-white text-[#52525B] hover:border-[#D4D1C6] hover:text-[#18181B]"
                }`}
              >
                {labelStatus(s)}
              </button>
            ))}
          </div>
        </div>

        {appeals.isLoading && (
          <p className="apex-mono inline-flex items-center gap-2 text-[#52525B]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> ЗАГРУЗКА…
          </p>
        )}
        {appeals.data?.length === 0 && (
          <p className="apex-mono text-[#71717A]">— ПУСТО. НЕТ АПЕЛЛЯЦИЙ —</p>
        )}

        <div className="grid grid-cols-1 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] mt-1">
          {appeals.data?.map((a) => (
            <div key={a.id} className="bg-white/90 backdrop-blur-[4px] p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="apex-mono inline-flex items-center px-2 py-0.5 rounded-[3px] border border-[#E2E0D8] bg-white">
                      {a.target_type}
                    </span>
                    <code className="text-[13px] font-mono text-[#18181B] break-all">
                      {a.target_display}
                    </code>
                    <StatusBadge status={a.status} />
                    {a.contact_display && (
                      <span className="apex-mono text-[#71717A]">
                        · контакт: {a.contact_display}
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] leading-[1.6] text-[#18181B] whitespace-pre-wrap prose-pretty">
                    {a.reason}
                  </p>
                  {a.resolution && (
                    <p className="mt-3 rounded-[4px] border border-[#E2E0D8] bg-[#FCFBF7] px-3 py-2 text-[13px] leading-relaxed text-[#52525B]">
                      Решение: {a.resolution}
                    </p>
                  )}
                  <p className="mt-3 apex-mono text-[#A1A1AA]">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {(a.status === "new" || a.status === "reviewing") && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={resolveAppeal.isPending}
                      onClick={() =>
                        resolveAppeal.mutate({
                          appealId: a.id,
                          decision: "remove_reputation",
                          note: "Public reputation removed after appeal review.",
                        })
                      }
                      className="apex-btn-outline inline-flex items-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Снять метку
                    </button>
                    <button
                      type="button"
                      disabled={resolveAppeal.isPending}
                      onClick={() =>
                        resolveAppeal.mutate({
                          appealId: a.id,
                          decision: "keep_reputation",
                          note: "Appeal rejected after moderator review.",
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-[#0B0B0F] apex-on-dark apex-mono hover:bg-[#27272A] transition-colors disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Оставить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Entities */}
      <section className="apex-card apex-frame apex-stripes">
        <div className="mb-6 pb-5 sm:pb-6 border-b border-[#E2E0D8]">
          <p className="label-md mb-2">03 — База</p>
          <h2 className="apex-h2">База сущностей</h2>
        </div>
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="apex-mono text-left text-[#71717A] border-b border-[#E2E0D8]">
                <th className="py-3 px-2 sm:px-3">Тип</th>
                <th className="py-3 px-2 sm:px-3">Маска</th>
                <th className="py-3 px-2 sm:px-3">Жалоб</th>
                <th className="py-3 px-2 sm:px-3">Риск</th>
                <th className="py-3 px-2 sm:px-3">Статус</th>
                <th className="py-3 px-2 sm:px-3">Последняя</th>
              </tr>
            </thead>
            <tbody>
              {entities.data?.map((e) => (
                <EntityRow key={e.id} entity={e} />
              ))}
            </tbody>
          </table>
          {entities.data?.length === 0 && (
            <p className="apex-mono text-[#71717A] py-6">— ПУСТО —</p>
          )}
        </div>
      </section>

      <p className="apex-mono">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[#71717A] hover:text-[#18181B] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> На главную сайта
        </Link>
      </p>
    </div>
  );
}

/** Expandable entity row with ReasonTimeline from the latest check. */
function EntityRow({
  entity,
}: {
  entity: {
    id: string;
    entity_type: string;
    display_mask: string;
    report_count: number;
    risk_level: string;
    moderation_status: string;
    last_seen_at: string;
    entity_hash?: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);
  const getCheckFn = useServerFn(getEntityCheck);
  const check = useQuery({
    queryKey: ["entity-check", entity.id],
    enabled: expanded && !!entity.entity_hash,
    queryFn: () => getCheckFn({ data: { entityHash: entity.entity_hash! } }),
  });

  return (
    <>
      <tr
        className="border-b border-[#E2E0D8] last:border-0 hover:bg-[#FCFBF7] transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-3 px-2 sm:px-3 apex-mono uppercase">{entity.entity_type}</td>
        <td className="py-3 px-2 sm:px-3 font-mono text-[#18181B] break-all">
          {entity.display_mask}
        </td>
        <td className="py-3 px-2 sm:px-3 tabular-nums">{entity.report_count}</td>
        <td className="py-3 px-2 sm:px-3 apex-mono">{entity.risk_level}</td>
        <td className="py-3 px-2 sm:px-3 apex-mono">{labelStatus(entity.moderation_status)}</td>
        <td className="py-3 px-2 sm:px-3 apex-mono text-[#A1A1AA] flex items-center gap-1">
          {new Date(entity.last_seen_at).toLocaleString()}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#E2E0D8]">
          <td colSpan={6} className="p-4">
            {check.isLoading && (
              <p className="apex-mono text-[#71717A] flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Загрузка…
              </p>
            )}
            {check.data && (
              <ReasonTimeline
                reasonCodes={(check.data.reason_codes ?? []) as ReasonCode[]}
                riskLevel={(check.data.risk_level ?? "unknown") as RiskLevel}
                hasAiExplanation={!!check.data.ai_explanation}
              />
            )}
            {!check.isLoading && !check.data && (
              <p className="apex-mono text-[#A1A1AA]">Нет проверок для этой сущности</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div
      className={`bg-white/90 backdrop-blur-[4px] p-5 sm:p-6 flex flex-col gap-2 ${highlight ? "ring-1 ring-inset ring-[#F97316]/30" : ""}`}
    >
      <p className="apex-mono text-[#71717A]">{label}</p>
      <p className="font-display text-[28px] sm:text-[32px] font-extrabold tracking-tight tabular-nums text-[#18181B] leading-none">
        {value ?? "—"}
      </p>
    </div>
  );
}

function ReportFact({
  label,
  value,
  mono = false,
  tone = "neutral",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="bg-white p-3">
      <dt className="apex-mono mb-1 text-[#71717A]">{label}</dt>
      <dd
        className={`${mono ? "font-mono break-all" : "font-sans"} text-[13px] leading-snug ${
          tone === "warn" ? "text-[#9A3412]" : "text-[#18181B]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: "bg-[#FFF7ED]", text: "text-[#9A3412]", border: "border-[#FDBA74]/70" },
    confirmed: { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FCA5A5]/60" },
    rejected: { bg: "bg-[#F4F4F5]", text: "text-[#3F3F46]", border: "border-[#E4E4E7]" },
  };
  const s = map[status] ?? map.rejected;
  return (
    <span
      className={`apex-mono inline-flex items-center px-2 py-0.5 rounded-[3px] border ${s.bg} ${s.text} ${s.border}`}
    >
      {labelStatus(status)}
    </span>
  );
}

function labelStatus(s: string) {
  return (
    (
      {
        new: "Новые",
        reviewing: "На проверке",
        confirmed: "Подтверждено",
        resolved: "Решено",
        rejected: "Отклонено",
        all: "Все",
      } as Record<string, string>
    )[s] ?? s
  );
}

function reportSignalCount(report: { entity_hash: string; target_report_count?: number | null }) {
  const value = Number(report.target_report_count ?? 1);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 1;
}

function reportSignalLabel(count: number) {
  return count === 1 ? "1 сигнал по цели" : `${count} ${pluralRu(count)} по цели`;
}

function moderationDecisionHint(count: number) {
  if (count > 1) {
    return "Повторные сигналы повышают приоритет, но не заменяют ручную проверку. Подтверждайте риск, если в описании видно просьбу о коде, карте, переводе, APK или опасной ссылке.";
  }

  return "Подтверждайте риск только по понятному описанию опасной просьбы. Если контекста мало, отклоните публичную метку: жалоба останется в истории.";
}

function pluralRu(value: number) {
  const abs = Math.abs(value);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "сигнал";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сигнала";
  return "сигналов";
}

function formatLoss(value?: number | null) {
  if (!value || !Number.isFinite(value) || value <= 0) return "не указан";
  return `${Math.round(value).toLocaleString("ru-RU")} UZS`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "неизвестно";
  return date.toLocaleString("ru-RU");
}

function labelTargetStatus(value?: string | null) {
  if (!value) return "на проверке";
  return labelStatus(value);
}

function labelRiskLevel(value?: string | null) {
  if (!value) return "не определён";
  return (
    (
      {
        safe: "без явного риска",
        low: "низкий",
        unknown: "недостаточно данных",
        suspicious: "осторожность",
        high_risk: "высокий риск",
      } as Record<string, string>
    )[value] ?? value
  );
}
