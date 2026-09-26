import { useMemo, useState, type FormEvent } from "react";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Tag } from "../types";
import { PageError, PageLoading } from "./DashboardPage";

export function SettingsPage({ token }: { token: string }) {
  const loader = useMemo(() => async () => { const [settings, tags] = await Promise.all([api<Record<string, string>>("/settings", token), api<Tag[]>("/tags", token)]); return { settings, tags }; }, [token]);
  const { data, loading, error, reload, setData } = useData(loader, [loader]);
  const [message, setMessage] = useState("");
  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  async function saveWebhook(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("webhook") || ""); await api("/settings", token, { method: "POST", body: { key: "discord_webhook", value } }); setMessage("Webhook guardado."); }
  async function createTag(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const tag = await api<Tag>("/tags", token, { method: "POST", body: { name: values.get("name"), color: values.get("color") } }); setData((current) => current ? { ...current, tags: [...current.tags, tag] } : current); form.reset(); }
  async function deleteTag(id: number) { await api(`/tags/${id}`, token, { method: "DELETE" }); setData((current) => current ? { ...current, tags: current.tags.filter((tag) => tag.id !== id) } : current); }
  return <><div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Ajustes</h1></div></div><div className="settings-grid"><section className="panel settings-card"><h2>Notificaciones Discord</h2><p>Webhook general del tracker.</p><form onSubmit={saveWebhook}><label>URL del webhook<input name="webhook" type="url" defaultValue={data.settings.discord_webhook || ""} placeholder="https://discord.com/api/webhooks/…" /></label><button className="button button-primary button-inline">Guardar</button>{message ? <span className="success-message">{message}</span> : null}</form></section><section className="panel settings-card"><h2>Etiquetas</h2><div className="tag-list">{data.tags.map((tag) => <span className="tag" key={tag.id} style={{ borderColor: tag.color, color: tag.color }}>{tag.name}<button type="button" onClick={() => void deleteTag(tag.id)} aria-label={`Eliminar ${tag.name}`}>×</button></span>)}</div><form className="tag-form" onSubmit={createTag}><input name="name" placeholder="Nombre" required /><input name="color" type="color" defaultValue="#7c3aed" aria-label="Color" /><button className="button">Agregar</button></form></section></div></>;
}
