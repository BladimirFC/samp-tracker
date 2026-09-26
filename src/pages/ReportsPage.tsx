import { MessageSquare, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Report, ReportStatus, User } from "../types";
import { PageError, PageLoading } from "./DashboardPage";

const statuses: ReportStatus[] = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"];
const priorities = ["Crítica", "Alta", "Media", "Baja"];
const types = ["Bug", "Exploit", "Sugerencia", "Optimización", "Mejora"];

interface ReportsPageProps { token: string; user: User; initialReport: Report | null; onInitialReportHandled: () => void }

export function ReportsPage({ token, user, initialReport, onInitialReportHandled }: ReportsPageProps) {
  const loader = useMemo(() => () => api<Report[]>("/reports", token), [token]);
  const { data: reports, loading, error, reload } = useData(loader, [loader]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Report | null>(initialReport);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => (reports || []).filter((report) => {
    const matchesText = `${report.id} ${report.title} ${report.author}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (!status || report.status === status);
  }), [reports, query, status]);

  function closeDetail() { setSelected(null); onInitialReportHandled(); }
  if (loading) return <PageLoading />;
  if (error || !reports) return <PageError message={error} retry={reload} />;

  return <><div className="page-heading"><div><p className="eyebrow">Incidencias y mejoras</p><h1>Reportes</h1></div><button className="button button-primary button-inline" onClick={() => setCreating(true)}><Plus size={17} />Nuevo reporte</button></div>
    <section className="panel"><div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, autor o ID" aria-label="Buscar reportes" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado"><option value="">Todos los estados</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div>
      {filtered.length === 0 ? <EmptyState>No hay reportes que coincidan con los filtros.</EmptyState> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Reporte</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Responsable</th></tr></thead><tbody>{filtered.map((report) => <tr key={report.id} onClick={() => setSelected(report)}><td className="mono">{report.id}</td><td><strong>{report.title}</strong><small>por {report.author}</small></td><td><StatusBadge value={report.type} /></td><td><StatusBadge value={report.priority} /></td><td><StatusBadge value={report.status} /></td><td>{report.assignee || "—"}</td></tr>)}</tbody></table></div>}
    </section>
    {creating ? <CreateReportModal token={token} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await reload(); }} /> : null}
    {selected ? <ReportDetail token={token} user={user} initial={selected} onClose={closeDetail} onChanged={async () => { await reload(); }} /> : null}
  </>;
}

function CreateReportModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await api<Report>("/reports", token, { method: "POST", body: values }); await onCreated(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el reporte."); }
    finally { setBusy(false); }
  }
  return <Modal title="Nuevo reporte" onClose={onClose}><form className="form-grid" onSubmit={submit}>{error ? <div className="form-error full" role="alert">{error}</div> : null}<label className="full">Título<input name="title" required maxLength={120} autoFocus /></label><label>Tipo<select name="type">{types.map((item) => <option key={item}>{item}</option>)}</select></label><label>Prioridad<select name="priority" defaultValue="Media">{priorities.map((item) => <option key={item}>{item}</option>)}</select></label><label className="full">Descripción<textarea name="description" rows={6} required /></label><label className="full">Evidencia URL<input name="evidence" type="url" placeholder="https://…" /></label><div className="modal-actions full"><button className="button" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary button-inline" disabled={busy}>{busy ? "Creando…" : "Crear reporte"}</button></div></form></Modal>;
}

function ReportDetail({ token, user, initial, onClose, onChanged }: { token: string; user: User; initial: Report; onClose: () => void; onChanged: () => Promise<void> }) {
  const [report, setReport] = useState(initial);
  const [comment, setComment] = useState("");
  const canEdit = user.role === "CEO" || user.role === "Developer";
  async function refresh() { setReport(await api<Report>(`/reports/${report.id}`, token)); await onChanged(); }
  async function updateStatus(next: string) { await api(`/reports/${report.id}/status`, token, { method: "PUT", body: { status: next } }); await refresh(); }
  async function assign() { await api(`/reports/${report.id}/assign`, token, { method: "POST", body: {} }); await refresh(); }
  async function addComment(event: FormEvent) { event.preventDefault(); if (!comment.trim()) return; await api(`/reports/${report.id}/comments`, token, { method: "POST", body: { text: comment } }); setComment(""); await refresh(); }
  async function remove() { if (!confirm("¿Eliminar este reporte permanentemente?")) return; await api(`/reports/${report.id}`, token, { method: "DELETE" }); await onChanged(); onClose(); }
  return <Modal title={`${report.id} · ${report.title}`} onClose={onClose} wide><div className="report-detail"><div className="detail-main"><section><p className="section-label">Descripción</p><p className="description">{report.description}</p>{report.evidence ? <a href={report.evidence} target="_blank" rel="noreferrer">Abrir evidencia ↗</a> : null}</section><section><p className="section-label"><MessageSquare size={14} /> Comentarios ({report.comments?.length || 0})</p><div className="comment-list">{report.comments?.length ? report.comments.map((item) => <article className="comment" key={item.id}><strong>{item.author}</strong><time>{new Date(item.createdAt).toLocaleString("es")}</time><p>{item.text}</p></article>) : <span className="muted">Sin comentarios.</span>}</div><form className="comment-form" onSubmit={addComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} placeholder="Escribí un comentario" /><button className="button">Comentar</button></form></section></div><aside className="detail-aside"><div><span>Estado</span>{canEdit ? <select value={report.status} onChange={(event) => void updateStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select> : <StatusBadge value={report.status} />}</div><div><span>Prioridad</span><StatusBadge value={report.priority} /></div><div><span>Tipo</span><StatusBadge value={report.type} /></div><div><span>Autor</span><strong>{report.author}</strong></div><div><span>Responsable</span><strong>{report.assignee || "Sin asignar"}</strong></div>{user.role === "Developer" ? <button className="button button-inline" onClick={() => void assign()}><UserPlus size={16} />Asignarme</button> : null}{user.role === "CEO" ? <button className="button button-danger button-inline" onClick={() => void remove()}><Trash2 size={16} />Eliminar</button> : null}</aside></div></Modal>;
}
