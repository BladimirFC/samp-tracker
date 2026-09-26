import { Bug, LayoutDashboard, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Page, Report } from "../types";

const pages: Array<{ id: Page; label: string; hint: string }> = [
  { id: "dashboard", label: "Dashboard", hint: "Resumen y métricas" },
  { id: "reports", label: "Reportes", hint: "Incidencias del equipo" },
  { id: "kanban", label: "Kanban", hint: "Flujo de desarrollo" },
  { id: "patches", label: "Parches", hint: "Historial de entregas" },
];

export function GlobalSearch({ token, open, onClose, onNavigate, onOpenReport }: { token: string; open: boolean; onClose: () => void; onNavigate: (page: Page) => void; onOpenReport: (report: Report) => void }) {
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  useEffect(() => { if (open) void api<Report[]>("/reports", token).then(setReports).catch(() => setReports([])); }, [open, token]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  const matches = useMemo(() => deferredQuery ? reports.filter((report) => `${report.id} ${report.title} ${report.author} ${report.assignee || ""}`.toLowerCase().includes(deferredQuery)).slice(0, 8) : reports.slice(0, 5), [deferredQuery, reports]);
  if (!open) return null;
  return <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Búsqueda global"><label className="command-input"><Search size={19}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar reportes o ir a una sección…"/><kbd>ESC</kbd></label><div className="command-results">{!deferredQuery ? <><p>Ir a</p>{pages.map((page) => <button key={page.id} onClick={() => { onNavigate(page.id); onClose(); }}><LayoutDashboard size={17}/><span><strong>{page.label}</strong><small>{page.hint}</small></span></button>)}</> : null}<p>{deferredQuery ? "Resultados" : "Reportes recientes"}</p>{matches.map((report) => <button key={report.id} onClick={() => { onOpenReport(report); onClose(); }}><Bug size={17}/><span><strong>{report.title}</strong><small>{report.id} · {report.status} · {report.assignee || "Sin asignar"}</small></span></button>)}{matches.length === 0 ? <span className="command-empty">No encontramos coincidencias.</span> : null}</div></section></div>;
}
