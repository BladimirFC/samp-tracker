import { AlertTriangle, ArrowUpRight, Bug, CheckCircle2, Clock3, Flame, Gauge, RefreshCw, Users } from "lucide-react";
import { useMemo } from "react";
import { DistributionChart, TrendChart } from "../components/Analytics";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Metrics, Report, ReportFilters, Stats } from "../types";

interface DashboardPageProps { token: string; onOpenReport: (report: Report) => void; onFilterReports: (filters: ReportFilters) => void }

export function DashboardPage({ token, onOpenReport, onFilterReports }: DashboardPageProps) {
  const loader = useMemo(() => async () => {
    const [stats, metrics, reports] = await Promise.all([api<Stats>("/stats", token), api<Metrics>("/metrics", token), api<Report[]>("/reports", token)]);
    return { stats, metrics, reports };
  }, [token]);
  const { data, loading, error, reload } = useData(loader, [loader]);

  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  const open = data.reports.filter((report) => !["Solucionado", "Cerrado"].includes(report.status)).length;
  const attention = data.reports.filter((report) => report.priority === "Crítica" && !["Solucionado", "Cerrado"].includes(report.status)).slice(0, 4);
  const recent = data.reports.slice(0, 6);
  const cards = [
    { label: "Trabajo abierto", value: open, note: `${data.stats.total} reportes totales`, icon: Bug, tone: "purple" },
    { label: "Críticos activos", value: attention.length, note: attention.length ? "Requieren atención" : "Todo bajo control", icon: Flame, tone: "red" },
    { label: "Resueltos esta semana", value: data.metrics.solved7, note: `${data.metrics.created7} creados`, icon: CheckCircle2, tone: "green" },
    { label: "Resolución promedio", value: data.metrics.avgResolutionDays === null ? "—" : `${data.metrics.avgResolutionDays}d`, note: `${data.metrics.resolvedCount} casos medidos`, icon: Clock3, tone: "blue" },
  ];

  return <>
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">Centro de operaciones</p><h1>Todo el equipo, <span>en una vista.</span></h1><p className="heading-copy">Priorizá bloqueos, medí el ritmo y llevá cada incidencia hasta producción.</p></div><button className="button button-inline" onClick={() => void reload()}><RefreshCw size={16}/>Actualizar</button></div>
    <section className="kpi-grid">{cards.map(({ label, value, note, icon: Icon, tone }) => <article className={`kpi-card tone-${tone}`} key={label}><div className="kpi-icon"><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>)}</section>
    {attention.length ? <section className="attention-strip"><div><AlertTriangle size={19}/><span><strong>{attention.length} incidencias críticas activas</strong><small>Revisalas antes de continuar con trabajo de menor prioridad.</small></span></div><button onClick={() => onFilterReports({ priority: "Crítica" })}>Ver críticas <ArrowUpRight size={15}/></button></section> : null}
    <div className="analytics-grid"><TrendChart metrics={data.metrics}/><DistributionChart title="Flujo por estado" subtitle="Distribución actual del trabajo." data={data.metrics.byStatus.map((item) => ({ label: item.status, value: item.count }))} onSelect={(status) => onFilterReports({ status })}/></div>
    <div className="analytics-grid secondary-analytics"><DistributionChart title="Prioridad" subtitle="Dónde está concentrado el riesgo." data={data.metrics.byPriority.map((item) => ({ label: item.priority, value: item.count }))} onSelect={(priority) => onFilterReports({ priority })}/><section className="panel workload-panel"><div className="panel-heading"><div><h2>Carga del equipo</h2><p>Asignaciones abiertas y completadas.</p></div><Users size={18}/></div><div className="workload-list">{data.metrics.byDev.length ? data.metrics.byDev.slice(0, 6).map((item) => <button type="button" key={item.assignee} onClick={() => onFilterReports({ assignee: item.assignee })}><span className="mini-avatar">{item.assignee.charAt(0).toUpperCase()}</span><span><strong>{item.assignee}</strong><small>{item.open} abiertos · {item.closed} cerrados</small></span><b>{item.total}</b></button>) : <EmptyState>Sin asignaciones todavía.</EmptyState>}</div></section></div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Los últimos reportes creados por el equipo.</p></div><button className="text-link" onClick={() => onFilterReports({})}>Ver todos <ArrowUpRight size={14}/></button></div>
      {recent.length === 0 ? <EmptyState>Todavía no hay reportes.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>Reporte</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Responsable</th><th>Actualizado</th></tr></thead><tbody>{recent.map((report) => <tr key={report.id} onClick={() => onOpenReport(report)}><td><strong>{report.title}</strong><small>{report.id} · {report.author}</small></td><td><StatusBadge value={report.type}/></td><td><StatusBadge value={report.priority}/></td><td><StatusBadge value={report.status}/></td><td>{report.assignee || "Sin asignar"}</td><td>{relativeTime(report.updatedAt)}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

export function relativeTime(value: string) { const delta = Date.now() - new Date(value).getTime(); const days = Math.floor(delta / 86_400_000); if (days > 0) return `hace ${days}d`; const hours = Math.floor(delta / 3_600_000); if (hours > 0) return `hace ${hours}h`; return "hace unos minutos"; }
export function PageLoading() { return <div className="page-state" aria-live="polite"><div className="spinner"/>Cargando información…</div>; }
export function PageError({ message, retry }: { message: string; retry: () => void | Promise<void> }) { return <div className="page-state error-state"><Gauge size={30}/><strong>No se pudo cargar la información</strong><span>{message}</span><button className="button" onClick={() => void retry()}>Reintentar</button></div>; }
