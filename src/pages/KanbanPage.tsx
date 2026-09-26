import { Filter, GripVertical, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Report, ReportStatus, User } from "../types";
import { PageError, PageLoading, relativeTime } from "./DashboardPage";

const columns: ReportStatus[] = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"];
const priorities = ["Crítica", "Alta", "Media", "Baja"];

export function KanbanPage({ token, user, onOpenReport }: { token: string; user: User; onOpenReport: (report: Report) => void }) {
  const loader = useMemo(() => () => api<Report[]>("/reports", token), [token]);
  const { data, loading, error, reload, setData } = useData(loader, [loader]);
  const [dragged, setDragged] = useState<string | null>(null); const [over, setOver] = useState<ReportStatus | null>(null); const [priority, setPriority] = useState(""); const [assignee, setAssignee] = useState("");
  const canMove = user.role === "CEO" || user.role === "Developer";
  const assignees = useMemo(() => [...new Set((data || []).map((report) => report.assignee).filter(Boolean) as string[])].sort(), [data]);
  const filtered = useMemo(() => (data || []).filter((report) => (!priority || report.priority === priority) && (!assignee || report.assignee === assignee)), [data, priority, assignee]);
  async function move(status: ReportStatus) { if (!dragged || !canMove || !data) return; const previous = data; const report = data.find((item) => item.id === dragged); setDragged(null); setOver(null); if (!report || report.status === status) return; setData(data.map((item) => item.id === report.id ? { ...item, status, updatedAt: new Date().toISOString() } : item)); try { await api(`/reports/${report.id}/status`, token, { method: "PUT", body: { status } }); } catch { setData(previous); } }
  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  return <><div className="page-heading"><div><p className="eyebrow">Flujo del equipo</p><h1>Kanban</h1><p className="heading-copy">Mové el trabajo por etapas y detectá cuellos de botella.</p></div><button className="button button-inline" onClick={() => void reload()}><RefreshCw size={16}/>Actualizar</button></div><div className="kanban-filters"><Filter size={16}/><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Todas las prioridades</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Todo el equipo</option>{assignees.map((item) => <option key={item}>{item}</option>)}</select><span>{canMove ? "Arrastrá las tarjetas para cambiar su estado" : "Vista de solo lectura"}</span></div><div className="kanban-board">{columns.map((status) => { const cards = filtered.filter((report) => report.status === status); return <section className={`kanban-column ${over === status ? "kanban-over" : ""}`} key={status} onDragOver={(event) => { if (canMove) { event.preventDefault(); setOver(status); } }} onDragLeave={() => setOver(null)} onDrop={() => void move(status)}><header><span>{status}</span><strong>{cards.length}</strong></header><div>{cards.length === 0 ? <EmptyState>Sin trabajo</EmptyState> : cards.map((report) => <article draggable={canMove} className={`kanban-card ${dragged === report.id ? "kanban-dragging" : ""}`} key={report.id} onDragStart={() => setDragged(report.id)} onDragEnd={() => { setDragged(null); setOver(null); }}><button type="button" onClick={() => onOpenReport(report)}><span className="kanban-card-top"><small>{report.id}</small>{canMove ? <GripVertical size={15}/> : null}</span><strong>{report.title}</strong><div><StatusBadge value={report.priority}/><StatusBadge value={report.type}/></div><footer><span className="mini-avatar">{(report.assignee || "?").charAt(0).toUpperCase()}</span><span>{report.assignee || "Sin asignar"}</span><time>{relativeTime(report.updatedAt)}</time></footer></button></article>)}</div></section>; })}</div></>;
}
