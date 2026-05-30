import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Check, X, LogOut, RefreshCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listReports, listEntities, moderateReport, adminStats } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Админка — Ishonch Guard" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<"new" | "confirmed" | "rejected" | "all">("new");
  const qc = useQueryClient();

  const listReportsFn = useServerFn(listReports);
  const listEntitiesFn = useServerFn(listEntities);
  const moderateFn = useServerFn(moderateReport);
  const statsFn = useServerFn(adminStats);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  const stats = useQuery({
    queryKey: ["admin-stats"], enabled: !!user && isAdmin,
    queryFn: () => statsFn({ data: undefined as never }),
  });
  const reports = useQuery({
    queryKey: ["admin-reports", status], enabled: !!user && isAdmin,
    queryFn: () => listReportsFn({ data: { status } }),
  });
  const entities = useQuery({
    queryKey: ["admin-entities"], enabled: !!user && isAdmin,
    queryFn: () => listEntitiesFn({ data: { status: "all" } }),
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

  if (loading) {
    return <div className="container mx-auto py-20 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Загрузка…</div>;
  }
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Нет доступа</h1>
        <p className="mt-2 text-muted-foreground">Этот аккаунт не является администратором.</p>
        <Button className="mt-6" onClick={() => signOut().then(() => nav({ to: "/login" }))}>Выйти</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Модерация</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            qc.invalidateQueries({ queryKey: ["admin-reports"] });
            qc.invalidateQueries({ queryKey: ["admin-entities"] });
            qc.invalidateQueries({ queryKey: ["admin-stats"] });
          }}><RefreshCcw className="h-4 w-4 mr-1.5" />Обновить</Button>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav({ to: "/login" }))}>
            <LogOut className="h-4 w-4 mr-1.5" />Выйти
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        <Stat label="Новые жалобы" value={stats.data?.reports_new} highlight />
        <Stat label="Подтверждено" value={stats.data?.reports_confirmed} />
        <Stat label="Сущностей в базе" value={stats.data?.entities_confirmed} />
        <Stat label="Всего проверок" value={stats.data?.checks_total} />
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Жалобы</h2>
          <div className="flex gap-1.5 text-xs">
            {(["new","confirmed","rejected","all"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-2.5 py-1 rounded-md border transition ${status === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}>
                {labelStatus(s)}
              </button>
            ))}
          </div>
        </div>

        {reports.isLoading && <div className="text-sm text-muted-foreground">Загрузка…</div>}
        {reports.data?.length === 0 && <Card className="p-6 text-sm text-muted-foreground">Нет записей.</Card>}
        <div className="space-y-3">
          {reports.data?.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px]">{r.entity_type}</Badge>
                    <code className="text-sm font-mono text-foreground">{r.redacted_value}</code>
                    <Badge variant={r.status === "new" ? "default" : r.status === "confirmed" ? "destructive" : "secondary"}>
                      {labelStatus(r.status)}
                    </Badge>
                    {r.scam_type && <span className="text-xs text-muted-foreground">· {r.scam_type}</span>}
                    {r.city && <span className="text-xs text-muted-foreground">· {r.city}</span>}
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{r.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · lang: {r.language}
                    {r.amount_lost_uzs ? ` · ${r.amount_lost_uzs.toLocaleString()} UZS` : ""}
                  </p>
                </div>
                {r.status === "new" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ reportId: r.id, decision: "confirmed" })}>
                      <Check className="h-4 w-4 mr-1" />Подтвердить скам
                    </Button>
                    <Button size="sm" variant="outline" disabled={moderate.isPending}
                      onClick={() => moderate.mutate({ reportId: r.id, decision: "rejected" })}>
                      <X className="h-4 w-4 mr-1" />Отклонить
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">База сущностей</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">Тип</th>
                <th className="py-2 pr-3">Маска</th>
                <th className="py-2 pr-3">Жалоб</th>
                <th className="py-2 pr-3">Риск</th>
                <th className="py-2 pr-3">Статус</th>
                <th className="py-2 pr-3">Последняя</th>
              </tr>
            </thead>
            <tbody>
              {entities.data?.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 uppercase text-[11px]">{e.entity_type}</td>
                  <td className="py-2 pr-3 font-mono">{e.display_mask}</td>
                  <td className="py-2 pr-3">{e.report_count}</td>
                  <td className="py-2 pr-3">{e.risk_level}</td>
                  <td className="py-2 pr-3">{labelStatus(e.moderation_status)}</td>
                  <td className="py-2 pr-3 text-muted-foreground text-xs">{new Date(e.last_seen_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entities.data?.length === 0 && <p className="text-sm text-muted-foreground py-4">Пока пусто.</p>}
        </div>
      </section>

      <p className="mt-12 text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">← На главную сайта</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? "border-primary/40" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
    </Card>
  );
}

function labelStatus(s: string) {
  return { new: "Новые", confirmed: "Подтверждено", rejected: "Отклонено", all: "Все" }[s] ?? s;
}
