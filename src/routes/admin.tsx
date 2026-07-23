import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Loader2,
  ShieldCheck,
  Check,
  X,
  LogOut,
  RefreshCcw,
  ArrowLeft,
  ChevronDown,
  FileText,
  ListFilter,
  Inbox,
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
import {
  operatorQueuePriority,
  operatorQueueSummary,
  sortOperatorQueueReports,
  type OperatorQueuePriority,
  type OperatorQueueSortMode,
} from "@/lib/admin-operator-queue";
import { REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Админка — Ishonch Guard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

const FILTERS = ["new", "confirmed", "rejected", "duplicate", "all"] as const;
type FilterKey = (typeof FILTERS)[number];
const APPEAL_FILTERS = ["new", "reviewing", "resolved", "rejected", "all"] as const;
type AppealFilterKey = (typeof APPEAL_FILTERS)[number];
type AdminReport = {
  id: string;
  entity_hash: string;
  entity_type: string;
  redacted_value: string;
  description: string;
  status: string;
  scam_type?: string | null;
  city?: string | null;
  amount_lost_uzs?: number | null;
  language?: string | null;
  created_at: string;
  target_signal_count?: number | null;
  target_last_report_at?: string | null;
  target_report_count?: number | null;
  target_last_seen_at?: string | null;
  target_moderation_status?: string | null;
  target_risk_level?: string | null;
  target_check_risk_level?: string | null;
  target_check_risk_score?: number | null;
  target_check_reason_codes?: string[] | null;
  target_check_has_ai_explanation?: boolean | null;
  target_check_created_at?: string | null;
};

function AdminPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<FilterKey>("new");
  const [appealStatus, setAppealStatus] = useState<AppealFilterKey>("new");
  const [reportSort, setReportSort] = useState<OperatorQueueSortMode>("priority");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
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
  const reportRows = useMemo(() => (reports.data ?? []) as AdminReport[], [reports.data]);
  const sortedReports = useMemo(
    () => sortOperatorQueueReports(reportRows, reportSort),
    [reportRows, reportSort],
  );
  const reportQueueSummary = useMemo(() => operatorQueueSummary(reportRows), [reportRows]);
  const selectedReport = reportRows.find((r) => r.id === selectedReportId) ?? null;

  useEffect(() => {
    if (selectedReportId && reports.data && !selectedReport) {
      setSelectedReportId(null);
    }
  }, [selectedReportId, reports.data, selectedReport]);

  const moderate = useMutation({
    mutationFn: (v: { reportId: string; decision: "confirmed" | "rejected" }) =>
      moderateFn({ data: { ...v, riskLevel: "high_risk" } }),
    onSuccess: () => {
      setSelectedReportId(null);
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
    <div className="admin-redesign home-stripes-bg">
      <main className="admin-shell">
        <header className="admin-topbar">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <ShieldCheck aria-hidden="true" />
            </span>
            <span>Ishonch Guard</span>
          </Link>
          <div className="admin-top-actions">
            <span className="admin-live">
              <i /> Оператор онлайн
            </span>
            <Link to="/">На главную</Link>
          </div>
        </header>
        {/* Header */}
        <div className="admin-hero">
          <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
            <span className="apex-mono">Админка</span>
            <span className="apex-status" data-state="success">
              <span className="apex-status-dot" />
              Вы вошли
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div className="min-w-0">
              <p className="label-md mb-3">Внутренняя система / Модерация</p>
              <h1 className="apex-h1">
                Проверяйте сигналы. <span>Защищайте людей.</span>
              </h1>
              <p className="admin-hero-lead">
                Единая очередь жалоб, апелляций и риск-целей — без передачи личных данных в рабочие
                чаты.
              </p>
            </div>
            <div className="admin-shift-card">
              <span>
                <ShieldCheck aria-hidden="true" /> Смена активна
              </span>
              <strong>{user.email}</strong>
              <small>Данные доступны только после проверки роли</small>
              <div className="admin-shift-actions">
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
        </div>

        {/* Stats — hairline grid */}
        <div className="admin-metrics">
          <Stat label="Новые жалобы" value={stats.data?.reports_new} highlight />
          <Stat label="Подтверждённых жалоб" value={stats.data?.reports_confirmed} />
          <Stat label="Целей в публичной базе" value={stats.data?.entities_confirmed} />
          <Stat label="Всего проверок" value={stats.data?.checks_total} />
          <Stat label="Апелляции" value={stats.data?.appeals_new} />
        </div>

        {/* Operator guide */}
        <section className="admin-guide premium-surface">
          <div className="admin-guide-grid">
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
                В группу уходит только маска цели и безопасная сводка. Коды, карты, скриншоты и
                полные контакты туда не пересылаются.
              </p>
            </div>
            <div className="border-t border-[#E2E0D8] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="apex-mono mb-2">Как решать</p>
              <p className="text-[13.5px] leading-[1.7] text-[#52525B]">
                Смотрите, что просили сделать, сколько сигналов пришло на цель, есть ли похожие
                записи и не выглядит ли жалоба как ложное обвинение.
              </p>
            </div>
            <div className="border-t border-[#E2E0D8] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="apex-mono mb-2">Приватность</p>
              <p className="text-[13.5px] leading-[1.7] text-[#52525B]">
                Коды, карты и полные контакты не публикуются. Работайте с чувствительными данными
                только внутри защищённой системы.
              </p>
            </div>
          </div>
        </section>

        {/* Reports */}
        <section className="admin-queue premium-surface" id="admin-queue">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-[#E2E0D8]">
            <div>
              <p className="label-md mb-2">01 — Жалобы</p>
              <h2 className="apex-h2">Входящие жалобы</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#52525B] max-w-2xl">
                Подтверждайте риск только по понятному описанию опасной просьбы. Мало контекста —
                отклоните: жалоба останется в истории, а повторные сигналы поднимут приоритет.
                Публичная метка появляется только после ручного подтверждения.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
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
              <div className="inline-flex w-full overflow-hidden rounded-[4px] border border-[#E2E0D8] bg-white sm:w-auto">
                <button
                  type="button"
                  onClick={() => setReportSort("priority")}
                  aria-pressed={reportSort === "priority"}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 apex-mono transition-colors sm:flex-none ${
                    reportSort === "priority"
                      ? "bg-[#0B0B0F] apex-on-dark text-white"
                      : "text-[#52525B] hover:bg-[#FCFBF7] hover:text-[#18181B]"
                  }`}
                >
                  <ListFilter className="h-3.5 w-3.5" aria-hidden="true" /> Сначала срочное
                </button>
                <button
                  type="button"
                  onClick={() => setReportSort("newest")}
                  aria-pressed={reportSort === "newest"}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 border-l border-[#E2E0D8] px-3 py-2 apex-mono transition-colors sm:flex-none ${
                    reportSort === "newest"
                      ? "bg-[#0B0B0F] apex-on-dark text-white"
                      : "text-[#52525B] hover:bg-[#FCFBF7] hover:text-[#18181B]"
                  }`}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" /> Сначала новые
                </button>
              </div>
            </div>
          </div>

          {!reports.isLoading && reportQueueSummary.total > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-[1px] border border-[#E2E0D8] bg-[#E2E0D8] lg:grid-cols-4">
              <QueueMetric label="Всего в фильтре" value={reportQueueSummary.total} />
              <QueueMetric
                label="Смотреть первым"
                value={reportQueueSummary.reviewNext}
                tone="danger"
              />
              <QueueMetric
                label="Нужен контекст"
                value={reportQueueSummary.needsContext}
                tone="warn"
              />
              <QueueMetric label="Повторы" value={reportQueueSummary.repeatedTargets} tone="warn" />
            </div>
          )}

          {reports.isLoading && (
            <p className="apex-mono inline-flex items-center gap-2 text-[#52525B]">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> ЗАГРУЗКА…
            </p>
          )}
          {reports.data?.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-12 text-center">
              <Inbox className="h-6 w-6 text-[#D4D1C6]" aria-hidden="true" />
              <p className="text-[14px] text-[#52525B]">Новых жалоб нет</p>
            </div>
          )}

          <div className="admin-report-list">
            {sortedReports.map((r) => {
              const priority = operatorQueuePriority(r);
              return (
                <article key={r.id} className="admin-report-card">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="apex-mono inline-flex items-center px-2 py-0.5 rounded-[3px] border border-[#E2E0D8] bg-white">
                          {r.entity_type}
                        </span>
                        <code className="text-[13px] font-mono text-[#18181B] break-all">
                          {r.redacted_value}
                        </code>
                        <StatusBadge status={r.status} />
                        <QueuePriorityBadge priority={priority} />
                        <span className="ml-auto">
                          <RiskChip level={r.target_risk_level} />
                        </span>
                      </div>
                      <p className="text-[15px] leading-[1.55] text-[#18181B] whitespace-pre-wrap prose-pretty">
                        {r.description}
                      </p>
                      <ReportReasonSummary report={r} compact />
                      <p className="mt-3 text-[12.5px] leading-relaxed text-[#71717A]">
                        {[
                          r.scam_type,
                          r.city,
                          reportSignalLabel(reportSignalCount(r)),
                          formatDateTime(
                            r.target_last_report_at ?? r.target_last_seen_at ?? r.created_at,
                          ),
                          `ущерб ${formatLoss(r.amount_lost_uzs)}`,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </p>
                      {reportSignalCount(r) > 1 && (
                        <p className="mt-3 rounded-[4px] border border-[#FDBA74]/60 bg-[#FFF7ED] px-3 py-2 text-[13px] leading-relaxed text-[#7C2D12]">
                          По этой цели уже есть повторные сигналы. Перед публичной меткой проверьте
                          контекст в описании и похожие записи в базе.
                        </p>
                      )}
                    </div>
                    <div className="lg:w-[220px] shrink-0 flex flex-col gap-2">
                      {r.status === "new" && (
                        <>
                          <button
                            type="button"
                            disabled={moderate.isPending}
                            onClick={() =>
                              moderate.mutate({ reportId: r.id, decision: "confirmed" })
                            }
                            className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] bg-[#DC2626] text-white apex-on-dark apex-mono hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Подтвердить риск
                          </button>
                          <button
                            type="button"
                            disabled={moderate.isPending}
                            onClick={() =>
                              moderate.mutate({ reportId: r.id, decision: "rejected" })
                            }
                            className="apex-btn-outline inline-flex w-full items-center justify-center gap-1.5"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" /> Отклонить
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedReportId(r.id)}
                        className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-[13px] text-[#71717A] hover:text-[#18181B] transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" /> Открыть детали
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {selectedReport && (
          <ReportDetailDialog
            report={selectedReport}
            isPending={moderate.isPending}
            onClose={() => setSelectedReportId(null)}
            onConfirm={() =>
              moderate.mutate({ reportId: selectedReport.id, decision: "confirmed" })
            }
            onReject={() => moderate.mutate({ reportId: selectedReport.id, decision: "rejected" })}
          />
        )}

        {/* Reputation Appeals */}
        <section className="admin-panel admin-appeals premium-surface">
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
            <div className="flex flex-col items-center gap-1.5 py-12 text-center">
              <Inbox className="h-6 w-6 text-[#D4D1C6]" aria-hidden="true" />
              <p className="text-[14px] text-[#52525B]">Апелляций нет</p>
            </div>
          )}

          <div className="appeal-list">
            {appeals.data?.map((a) => (
              <article key={a.id}>
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
                    </div>
                    <p className="text-[15px] leading-[1.55] text-[#18181B] whitespace-pre-wrap prose-pretty">
                      {a.reason}
                    </p>
                    {a.resolution && (
                      <p className="mt-3 rounded-[4px] border border-[#E2E0D8] bg-[#FCFBF7] px-3 py-2 text-[13px] leading-relaxed text-[#52525B]">
                        Решение: {a.resolution}
                      </p>
                    )}
                    <p className="mt-3 text-[12.5px] leading-relaxed text-[#71717A]">
                      {[
                        a.contact_display ? `контакт: ${a.contact_display}` : null,
                        new Date(a.created_at).toLocaleString(),
                      ]
                        .filter(Boolean)
                        .join("  ·  ")}
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
              </article>
            ))}
          </div>
        </section>

        {/* Entities */}
        <section className="admin-panel admin-database premium-surface" id="admin-data">
          <div className="mb-6 pb-5 sm:pb-6 border-b border-[#E2E0D8]">
            <p className="label-md mb-2">03 — База</p>
            <h2 className="apex-h2">База сущностей</h2>
          </div>
          <div className="admin-table-wrap">
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
              <div className="flex flex-col items-center gap-1.5 py-12 text-center">
                <Inbox className="h-6 w-6 text-[#D4D1C6]" aria-hidden="true" />
                <p className="text-[14px] text-[#52525B]">В базе пока пусто</p>
              </div>
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
      </main>
    </div>
  );
}

function ReportDetailDialog({
  report,
  isPending,
  onClose,
  onConfirm,
  onReject,
}: {
  report: AdminReport;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const signalCount = reportSignalCount(report);
  const canModerate = report.status === "new";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0F]/55 px-3 py-5 sm:px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
    >
      <div className="apex-card apex-frame apex-stripes max-h-[92vh] w-full max-w-5xl overflow-y-auto bg-[#FCFBF7] p-5 shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#E2E0D8] pb-5">
          <div className="min-w-0">
            <p className="label-md mb-2">Жалоба · ручная проверка</p>
            <h2 id="report-detail-title" className="apex-h2">
              Детали сигнала
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#52525B]">
              Это рабочий экран модератора. Telegram-чат нужен только как уведомление; решение
              принимается здесь, после проверки контекста.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="apex-btn-outline inline-flex h-10 w-10 shrink-0 items-center justify-center p-0"
            aria-label="Закрыть детали"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5">
            <section>
              <p className="apex-mono mb-3 text-[#71717A]">Что пожаловались</p>
              <div className="border border-[#E2E0D8] bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="apex-mono inline-flex items-center rounded-[3px] border border-[#E2E0D8] bg-white px-2 py-0.5">
                    {report.entity_type}
                  </span>
                  <code className="break-all font-mono text-[13px] text-[#18181B]">
                    {report.redacted_value}
                  </code>
                  <StatusBadge status={report.status} />
                </div>
                <p className="prose-pretty whitespace-pre-wrap text-[15px] leading-[1.7] text-[#18181B]">
                  {report.description}
                </p>
              </div>
            </section>

            <section>
              <p className="apex-mono mb-3 text-[#71717A]">Паспорт жалобы</p>
              <dl className="grid grid-cols-1 gap-[1px] border border-[#E2E0D8] bg-[#E2E0D8] sm:grid-cols-2">
                <ReportFact label="Тип схемы" value={report.scam_type ?? "не указан"} />
                <ReportFact label="Город / регион" value={report.city ?? "не указан"} />
                <ReportFact label="Ущерб" value={formatLoss(report.amount_lost_uzs)} />
                <ReportFact label="Язык" value={report.language ?? "не указан"} />
                <ReportFact label="Когда поступило" value={formatDateTime(report.created_at)} />
                <ReportFact
                  label="Последний сигнал"
                  value={formatDateTime(
                    report.target_last_report_at ?? report.target_last_seen_at ?? report.created_at,
                  )}
                />
              </dl>
            </section>

            <section>
              <p className="apex-mono mb-3 text-[#71717A]">Сигналы по этой цели</p>
              <div className="grid grid-cols-1 gap-[1px] border border-[#E2E0D8] bg-[#E2E0D8] sm:grid-cols-3">
                <ReportFact
                  label="Повторы"
                  value={reportSignalLabel(signalCount)}
                  tone={signalCount > 1 ? "warn" : "neutral"}
                />
                <ReportFact
                  label="Статус цели"
                  value={labelTargetStatus(report.target_moderation_status)}
                />
                <ReportFact label="Риск цели" value={labelRiskLevel(report.target_risk_level)} />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#71717A]">
                Повторы помогают выбрать приоритет проверки, но не являются доказательством сами по
                себе. Подтверждайте риск только если в жалобе видно опасную просьбу: код, карта,
                перевод, APK, QR-вход или подозрительная ссылка.
              </p>
            </section>

            <section>
              <p className="apex-mono mb-3 text-[#71717A]">Почему система отметила цель</p>
              <ReportReasonSummary report={report} />
              {reportReasonCodes(report).length > 0 && (
                <div className="mt-3">
                  <ReasonTimeline
                    reasonCodes={reportReasonCodes(report)}
                    riskLevel={reportCheckRiskLevel(report)}
                    hasAiExplanation={Boolean(report.target_check_has_ai_explanation)}
                  />
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="border border-[#E2E0D8] bg-white p-4">
              <p className="apex-mono mb-2 text-[#71717A]">Решение модератора</p>
              <p className="text-[13.5px] leading-[1.7] text-[#52525B]">
                {moderationDecisionHint(signalCount)}
              </p>
              {canModerate ? (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={onConfirm}
                    className="inline-flex items-center justify-center gap-1.5 rounded-[4px] bg-[#DC2626] px-3 py-2 apex-mono text-white apex-on-dark transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Подтвердить риск
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={onReject}
                    className="apex-btn-outline inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Отклонить публичную метку
                  </button>
                </div>
              ) : (
                <p className="mt-4 rounded-[4px] border border-[#E2E0D8] bg-[#FCFBF7] px-3 py-2 text-[13px] leading-relaxed text-[#52525B]">
                  Эта жалоба уже обработана. История остаётся в базе для будущих повторных сигналов.
                </p>
              )}
            </section>

            <section className="border border-[#E2E0D8] bg-[#FFFBEB] p-4">
              <p className="apex-mono mb-2 text-[#92400E]">Приватность</p>
              <p className="text-[13.5px] leading-[1.7] text-[#78350F]">
                В Telegram-чат отправляется только маска и краткая сводка. Не копируйте туда коды,
                карты, пароли, скриншоты с личными данными или полные контакты. Если нужен разбор,
                работайте через админку.
              </p>
            </section>

            <section className="border border-[#E2E0D8] bg-white p-4">
              <p className="apex-mono mb-2 text-[#71717A]">Что проверить перед меткой</p>
              <ul className="space-y-2 text-[13.5px] leading-[1.6] text-[#52525B]">
                <li>Есть ли конкретная просьба: код, карта, перевод, APK, QR или ссылка.</li>
                <li>Не выглядит ли жалоба как одиночное ложное обвинение без контекста.</li>
                <li>Есть ли повторные сигналы или похожие записи по этой цели.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
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
      <tr className="entity-data-row" onClick={() => setExpanded(!expanded)}>
        <td className="py-3 px-2 sm:px-3 apex-mono uppercase">{entity.entity_type}</td>
        <td className="py-3 px-2 sm:px-3 font-mono text-[#18181B] break-all">
          {entity.display_mask}
        </td>
        <td className="py-3 px-2 sm:px-3 tabular-nums">{entity.report_count}</td>
        <td className="py-3 px-2 sm:px-3">
          <RiskChip level={entity.risk_level} />
        </td>
        <td className="py-3 px-2 sm:px-3 apex-mono">{labelStatus(entity.moderation_status)}</td>
        <td className="py-3 px-2 sm:px-3 apex-mono text-[#A1A1AA]">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`Показать причины риска для ${entity.display_mask}`}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <span>{new Date(entity.last_seen_at).toLocaleString()}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </td>
      </tr>
      <tr className={`entity-expanded${expanded ? " is-open" : ""}`} aria-hidden={!expanded}>
        <td colSpan={6}>
          <div className="entity-expand-motion">
            <div className="entity-expand-inner">
              <div className="entity-expand-content">
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
              </div>
            </div>
          </div>
        </td>
      </tr>
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

function QueueMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "danger";
}) {
  const valueClass =
    tone === "danger" ? "text-[#991B1B]" : tone === "warn" ? "text-[#9A3412]" : "text-[#18181B]";
  return (
    <div className="bg-white/90 p-4">
      <p className="apex-mono text-[#71717A]">{label}</p>
      <p
        className={`mt-2 font-display text-[24px] font-extrabold leading-none tabular-nums ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function QueuePriorityBadge({ priority }: { priority: OperatorQueuePriority }) {
  const config: Record<
    OperatorQueuePriority["band"],
    { label: string; title: string; className: string }
  > = {
    review_next: {
      label: "Смотреть первым",
      title: "Высокий риск, сильный score или повторные сигналы по цели.",
      className: "border-[#FCA5A5]/60 bg-[#FEF2F2] text-[#991B1B]",
    },
    needs_context: {
      label: "Нужен контекст",
      title: "По цели мало сохранённого risk-контекста; решение лучше принимать по тексту жалобы.",
      className: "border-[#FDBA74]/60 bg-[#FFF7ED] text-[#9A3412]",
    },
    standard: {
      label: "Обычная очередь",
      title: "Нет сильных признаков для повышения приоритета.",
      className: "border-[#E2E0D8] bg-white text-[#71717A]",
    },
  };
  const current = config[priority.band];

  return (
    <span
      className={`apex-mono inline-flex items-center px-2 py-0.5 rounded-[3px] border ${current.className}`}
      title={`${current.title} Score: ${priority.score}.`}
    >
      {current.label}
    </span>
  );
}

function ReportReasonSummary({
  report,
  compact = false,
}: {
  report: AdminReport;
  compact?: boolean;
}) {
  const reasons = reportRawReasonCodes(report);
  const visibleReasons = reasons.slice(0, compact ? 3 : 6);
  const hiddenReasonCount = Math.max(0, reasons.length - visibleReasons.length);
  const hasSummary = hasReportCheckSummary(report);

  return (
    <div className="mt-4 border border-[#E2E0D8] bg-[#FCFBF7] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="apex-mono mb-1 text-[#71717A]">Последняя проверка цели</p>
          <p className="text-[13px] leading-relaxed text-[#52525B]">
            {hasSummary
              ? `${labelRiskLevel(report.target_check_risk_level)}${
                  typeof report.target_check_risk_score === "number"
                    ? ` · score ${report.target_check_risk_score}`
                    : ""
                }`
              : "Нет сохранённой проверки для этой цели."}
          </p>
        </div>
        {report.target_check_created_at && (
          <span className="apex-mono shrink-0 text-[#A1A1AA]">
            {formatDateTime(report.target_check_created_at)}
          </span>
        )}
      </div>

      {visibleReasons.length > 0 ? (
        <ul className="mt-3 grid gap-1 text-[13px] leading-relaxed text-[#52525B] sm:grid-cols-2">
          {visibleReasons.map((code) => (
            <li key={code}>• {reasonLabel(code)}</li>
          ))}
          {hiddenReasonCount > 0 && <li className="text-[#71717A]">• ещё {hiddenReasonCount}</li>}
        </ul>
      ) : (
        hasSummary && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#71717A]">
            Reason-кодов нет: решение можно принимать только по тексту жалобы и повторным сигналам.
          </p>
        )
      )}

      {hasSummary && (
        <p className="mt-3 apex-mono text-[#A1A1AA]">
          {report.target_check_has_ai_explanation ? "rules + AI explanation" : "rules only"}
        </p>
      )}
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

function hasReportCheckSummary(report: AdminReport) {
  return (
    Boolean(report.target_check_risk_level) ||
    typeof report.target_check_risk_score === "number" ||
    reportRawReasonCodes(report).length > 0 ||
    Boolean(report.target_check_created_at)
  );
}

function reportRawReasonCodes(report: AdminReport): string[] {
  return (report.target_check_reason_codes ?? []).filter(
    (code): code is string => typeof code === "string" && code.trim().length > 0,
  );
}

function reportReasonCodes(report: AdminReport): ReasonCode[] {
  return reportRawReasonCodes(report).filter((code): code is ReasonCode => code in REASON_LABELS);
}

function reasonLabel(code: string) {
  return REASON_LABELS[code as ReasonCode]?.ru ?? code;
}

function isRiskLevel(value?: string | null): value is RiskLevel {
  return value === "safe" || value === "unknown" || value === "suspicious" || value === "high_risk";
}

function reportCheckRiskLevel(report: AdminReport): RiskLevel {
  if (isRiskLevel(report.target_check_risk_level)) return report.target_check_risk_level;
  if (isRiskLevel(report.target_risk_level)) return report.target_risk_level;
  return "unknown";
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: "bg-[#FFF7ED]", text: "text-[#9A3412]", border: "border-[#FDBA74]/70" },
    confirmed: { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FCA5A5]/60" },
    rejected: { bg: "bg-[#F4F4F5]", text: "text-[#3F3F46]", border: "border-[#E4E4E7]" },
    duplicate: { bg: "bg-[#F8FAFC]", text: "text-[#475569]", border: "border-[#CBD5E1]" },
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

function RiskChip({ level }: { level?: string | null }) {
  const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    high_risk: {
      bg: "bg-[#FEF2F2]",
      text: "text-[#991B1B]",
      border: "border-[#FCA5A5]/60",
      dot: "bg-[#DC2626]",
    },
    suspicious: {
      bg: "bg-[#FFF7ED]",
      text: "text-[#9A3412]",
      border: "border-[#FDBA74]/70",
      dot: "bg-[#EA580C]",
    },
    safe: {
      bg: "bg-[#F0FDF4]",
      text: "text-[#166534]",
      border: "border-[#86EFAC]/60",
      dot: "bg-[#16A34A]",
    },
  };
  const s = map[level ?? ""] ?? {
    bg: "bg-[#F4F4F5]",
    text: "text-[#3F3F46]",
    border: "border-[#E4E4E7]",
    dot: "bg-[#A1A1AA]",
  };
  return (
    <span
      className={`apex-mono inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[999px] border ${s.bg} ${s.text} ${s.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {labelRiskLevel(level)}
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
        duplicate: "Дубликаты",
        all: "Все",
      } as Record<string, string>
    )[s] ?? s
  );
}

function reportSignalCount(report: {
  entity_hash: string;
  target_signal_count?: number | null;
  target_report_count?: number | null;
}) {
  const value = Number(report.target_signal_count ?? report.target_report_count ?? 1);
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
