import { Activity, Bug, CheckCircle2, Clock3, Flame, Wrench } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { api } from "../lib/api";
import type { Report, Stats } from "../types";
import { useData } from "../hooks/useData";

interface DashboardPageProps { token: string; onOpenReport: (report: Report) => void }

export function DashboardPage({ token, onOpenReport }: DashboardPageProps) {
  const loader = useMemo(() => async () => {
    const [stats, reports] = await Promise.all([api<Stats>("/stats", token), api<Report[]>("/reports", token)]);
    return { stats, reports };
  }, [token]);
  const { data, loading, error, reload } = useData(loader, [loader]);

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  const cards = [
    ["Total", data.stats.total, Bug], ["Pendientes", data.stats.pending, Clock3], ["En desarrollo", data.stats.inDev, Wrench],
    ["Solucionados", data.stats.solved, CheckCircle2], ["Críticos", data.stats.critical, Flame], ["En revisión", data.stats.inRevision, Activity],
  ] as const;
  const recent = data.reports.slice(0, 6);

  return <><div className="page-heading"><div><p className="eyebrow">Resumen operativo</p><h1>Dashboard</h1></div><button className="button" onClick={() => void reload()}>Actualizar</button></div>
    <section className="stats-grid">{cards.map(([label, value, Icon]) => <article className="stat-card" key={label}><Icon size={19} /><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Los últimos reportes creados por el equipo.</p></div></div>
      {recent.length === 0 ? <EmptyState>Todavía no hay reportes.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Reporte</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>{recent.map((report) => <tr key={report.id} onClick={() => onOpenReport(report)}><td><strong>{report.title}</strong><small>{report.id} · {report.author}</small></td><td><StatusBadge value={report.type} /></td><td><StatusBadge value={report.priority} /></td><td><StatusBadge value={report.status} /></td><td>{report.assignee || "Sin asignar"}</td></tr>)}</tbody></table></div>}
    </section></>;
}

export function PageLoading() { return <div className="page-state" aria-live="polite"><div className="spinner" />Cargando…</div>; }
export function PageError({ message, retry }: { message: string; retry: () => void | Promise<void> }) { return <div className="page-state error-state"><strong>No se pudo cargar la información</strong><span>{message}</span><button className="button" onClick={() => void retry()}>Reintentar</button></div>; }
