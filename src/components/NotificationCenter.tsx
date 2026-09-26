import { Bell, CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { NotificationItem, User } from "../types";

export function NotificationCenter({ token, user, onOpenReport }: { token: string; user: User; onOpenReport: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const loader = useMemo(() => () => api<NotificationItem[]>(`/notifications?username=${encodeURIComponent(user.username)}`, token), [token, user.username]);
  const { data = [], reload, setData } = useData(loader, [loader]);
  const unread = data?.filter((item) => !item.read).length || 0;
  async function mark(item: NotificationItem) { if (!item.read) { await api(`/notifications/${item.id}/read`, token, { method: "PUT" }); setData((current) => current?.map((value) => value.id === item.id ? { ...value, read: 1 } : value) || []); } if (item.report_id) onOpenReport(item.report_id); setOpen(false); }
  async function markAll() { await api("/notifications/read-all", token, { method: "PUT" }); setData((current) => current?.map((item) => ({ ...item, read: 1 })) || []); }
  return <div className="notification-wrap"><button className="topbar-icon" type="button" aria-label="Notificaciones" onClick={() => { setOpen((value) => !value); void reload(); }}><Bell size={18}/>{unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}</button>{open ? <section className="notification-panel"><header><div><strong>Notificaciones</strong><span>{unread} sin leer</span></div><button type="button" onClick={() => void markAll()}><CheckCheck size={16}/>Marcar leídas</button></header><div>{data?.length ? data.slice(0, 12).map((item) => <button type="button" className={item.read ? "" : "notification-unread"} key={item.id} onClick={() => void mark(item)}><i/><span><strong>{item.message}</strong><small>{new Date(item.created_at).toLocaleString("es")}</small></span></button>) : <p>No hay notificaciones todavía.</p>}</div></section> : null}</div>;
}
