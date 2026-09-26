import { Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { Modal } from "../components/Modal";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Patch, Report, User } from "../types";
import { PageError, PageLoading } from "./DashboardPage";

export function PatchesPage({ token, user }: { token: string; user: User }) {
  const loader = useMemo(() => async () => { const [patches, reports] = await Promise.all([api<Patch[]>("/patches", token), api<Report[]>("/reports", token)]); return { patches, reports }; }, [token]);
  const { data, loading, error, reload } = useData(loader, [loader]);
  const [creating, setCreating] = useState(false);
  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  const reportMap = new Map(data.reports.map((report) => [report.id, report]));
  const canCreate = user.role === "CEO" || user.role === "Developer";
  return <><div className="page-heading"><div><p className="eyebrow">Historial de entregas</p><h1>Parches</h1></div>{canCreate ? <button className="button button-primary button-inline" onClick={() => setCreating(true)}><Plus size={17} />Publicar parche</button> : null}</div>{data.patches.length === 0 ? <EmptyState>No hay parches publicados.</EmptyState> : <div className="patch-grid">{data.patches.map((patch) => <article className="patch-card" key={patch.id}><header><div><small>{patch.id}</small><h2>v{patch.version}</h2></div><time>{patch.date}</time></header>{patch.notes ? <p>{patch.notes}</p> : null}<ul>{patch.bugIds.map((id) => <li key={id}>✓ {reportMap.get(id)?.title || id}</li>)}</ul></article>)}</div>}{creating ? <CreatePatchModal token={token} reports={data.reports} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await reload(); }} /> : null}</>;
}

function CreatePatchModal({ token, reports, onClose, onCreated }: { token: string; reports: Report[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const solved = reports.filter((report) => report.status === "Solucionado");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); await api("/patches", token, { method: "POST", body: { version: values.get("version"), date: values.get("date"), notes: values.get("notes"), bugIds: values.getAll("bugIds") } }); await onCreated(); }
  return <Modal title="Publicar parche" onClose={onClose}><form className="form-grid" onSubmit={submit}><label>Versión<input name="version" required autoFocus /></label><label>Fecha<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label className="full">Notas<textarea name="notes" rows={4} /></label><fieldset className="full check-list"><legend>Reportes solucionados</legend>{solved.length ? solved.map((report) => <label key={report.id}><input type="checkbox" name="bugIds" value={report.id} />{report.id} · {report.title}</label>) : <span className="muted">No hay reportes solucionados disponibles.</span>}</fieldset><div className="modal-actions full"><button className="button" type="button" onClick={onClose}>Cancelar</button><button className="button button-primary button-inline">Publicar</button></div></form></Modal>;
}
