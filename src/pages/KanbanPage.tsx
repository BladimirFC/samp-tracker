import { useMemo } from "react";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Report, ReportStatus } from "../types";
import { PageError, PageLoading } from "./DashboardPage";

const columns: ReportStatus[] = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"];

export function KanbanPage({ token, onOpenReport }: { token: string; onOpenReport: (report: Report) => void }) {
  const loader = useMemo(() => () => api<Report[]>("/reports", token), [token]);
  const { data, loading, error, reload } = useData(loader, [loader]);
  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  return <><div className="page-heading"><div><p className="eyebrow">Flujo del equipo</p><h1>Kanban</h1></div><button className="button" onClick={() => void reload()}>Actualizar</button></div><div className="kanban-board">{columns.map((status) => { const cards = data.filter((report) => report.status === status); return <section className="kanban-column" key={status}><header><span>{status}</span><strong>{cards.length}</strong></header><div>{cards.length === 0 ? <EmptyState>Vacío</EmptyState> : cards.map((report) => <button type="button" className="kanban-card" key={report.id} onClick={() => onOpenReport(report)}><small>{report.id}</small><strong>{report.title}</strong><div><StatusBadge value={report.priority} /><StatusBadge value={report.type} /></div><span>{report.assignee || "Sin asignar"}</span></button>)}</div></section>; })}</div></>;
}
