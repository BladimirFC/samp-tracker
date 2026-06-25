export const runtime = "nodejs";

// ─── IN-MEMORY STORAGE ────────────────────────────────────────────

interface User { id: number; name: string; username: string; password: string; role: string; color: string; bg: string; avatar: string; discordWebhook: string; createdAt: string; }
interface Comment { id: number; text: string; author: string; createdAt: string; }
interface Attachment { id: number; url: string; name: string; added_by: string; created_at: string; }
interface HistoryEntry { user: string; action: string; from: string; to: string; date: string; }
interface Report { id: string; title: string; type: string; priority: string; status: string; description: string; evidence: string; author: string; assignee: string | null; followers: string[]; tags: number[]; comments: Comment[]; attachments: Attachment[]; history: HistoryEntry[]; createdAt: string; updatedAt: string; }
interface Patch { id: string; version: string; date: string; notes: string; bugIds: string[]; createdAt: string; }
interface Tag { id: number; name: string; color: string; }
interface NotificationItem { id: number; type: string; message: string; report_id: string; username: string; read: number; created_at: string; }

// ─── STATE ────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  CEO: { color: "#e8c547", bg: "rgba(232,197,71,0.15)" },
  Developer: { color: "#bc8cff", bg: "rgba(188,140,255,0.15)" },
  Tester: { color: "#58a6ff", bg: "rgba(88,166,255,0.15)" },
};

let nextUserId = 2, nextCommentId = 1, nextAttachmentId = 1, nextTagId = 1, nextNotifId = 1, reportCounter = 1, patchCounter = 1;

const users: User[] = [{
  id: 1, name: "Admin", username: "admin", password: "admin123", role: "CEO",
  color: ROLE_COLORS.CEO.color, bg: ROLE_COLORS.CEO.bg, avatar: "", discordWebhook: "", createdAt: new Date().toISOString(),
}];

const reports: Report[] = [];
const patches: Patch[] = [];
const tags: Tag[] = [
  { id: 1, name: "urgente", color: "#dc2626" },
  { id: 2, name: "UI", color: "#2563eb" },
  { id: 3, name: "backend", color: "#16a34a" },
];
const notifications: NotificationItem[] = [];
const kvSettings: Record<string, string> = {};
if (tags.length > 0) nextTagId = Math.max(...tags.map(t => t.id)) + 1;

// ─── HELPERS ──────────────────────────────────────────────────────

function r(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function nf() { return r({ error: "Not found" }, 404); }

function genRptId() { return `BUG-${String(reportCounter++).padStart(3, "0")}`; }
function genPatchId() { return `PATCH-${String(patchCounter++).padStart(3, "0")}`; }

function addHist(report: Report, user: string, action: string, from?: string, to?: string) {
  if (!report.history) report.history = [];
  report.history.push({ user, action, from: from || "", to: to || "", date: new Date().toISOString() });
}
function addNotif(type: string, msg: string, reportId: string, username: string) {
  notifications.push({ id: nextNotifId++, type, message: msg, report_id: reportId, username, read: 0, created_at: new Date().toISOString() });
}

// ─── HANDLERS ─────────────────────────────────────────────────────

function hRegister(b: Record<string, unknown>) {
  const { name, username, password, role } = b as { name: string; username: string; password: string; role: string };
  if (!name || !username || !password) return r({ error: "Todos los campos son requeridos." }, 400);
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return r({ error: "Ese usuario ya existe." }, 409);
  const rc = ROLE_COLORS[role] || ROLE_COLORS.Tester;
  const user: User = { id: nextUserId++, name, username, password, role: role || "Tester", color: rc.color, bg: rc.bg, avatar: "", discordWebhook: "", createdAt: new Date().toISOString() };
  users.push(user);
  const { password: _, ...safe } = user;
  return r(safe, 201);
}

function hLogin(b: Record<string, unknown>) {
  const { username, password } = b as { username: string; password: string };
  const user = users.find(u => u.username.toLowerCase() === (username || "").toLowerCase() && u.password === password);
  if (!user) return r({ error: "Usuario o contraseña incorrectos." }, 401);
  const { password: _, ...safe } = user;
  return r(safe);
}

function hUpdateUser(id: number, b: Record<string, unknown>) {
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return nf();
  const user = users[idx];
  const { name, currentPassword, newPassword, avatar, discordWebhook } = b as { name?: string; currentPassword?: string; newPassword?: string; avatar?: string; discordWebhook?: string };
  if (currentPassword) { if (currentPassword !== user.password) return r({ error: "Contraseña actual incorrecta." }, 400); if (newPassword) user.password = newPassword; }
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  if (discordWebhook !== undefined) user.discordWebhook = discordWebhook;
  const { password: _, ...safe } = user;
  return r(safe);
}

function hListReports(url: URL) {
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";
  const type = url.searchParams.get("type") || "";
  let filtered = [...reports];
  if (search) filtered = filtered.filter(r => r.title.toLowerCase().includes(search) || r.id.toLowerCase().includes(search));
  if (status) filtered = filtered.filter(r => r.status === status);
  if (priority) filtered = filtered.filter(r => r.priority === priority);
  if (type) filtered = filtered.filter(r => r.type === type);
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return r(filtered);
}

function hCreateReport(b: Record<string, unknown>) {
  const { title, type, priority, description, evidence, author } = b as { title: string; type: string; priority: string; description: string; evidence?: string; author: string };
  if (!title || !description || !author) return r({ error: "Título, descripción y autor son requeridos." }, 400);
  const id = genRptId(), now = new Date().toISOString();
  const report: Report = { id, title, type: type || "Bug", priority: priority || "Media", status: "Pendiente", description, evidence: evidence || "", author, assignee: null, followers: [author], tags: [], comments: [], attachments: [], history: [{ user: author, action: "creó el reporte", from: "", to: "", date: now }], createdAt: now, updatedAt: now };
  reports.push(report);
  addNotif("new_report", `Nuevo reporte ${id}: ${title}`, id, author);
  users.filter(u => u.role === "CEO").forEach(u => addNotif("new_report", `Nuevo reporte ${id}: ${title} por ${author}`, id, u.username));
  return r(report, 201);
}

function hGetReport(id: string) { const x = reports.find(r => r.id === id); return x ? r(x) : nf(); }
function hDeleteReport(id: string) { const i = reports.findIndex(r => r.id === id); if (i === -1) return nf(); reports.splice(i, 1); return r({ ok: true }); }

function hUpdateStatus(id: string, b: Record<string, unknown>) {
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { status, username } = b as { status: string; username: string };
  if (!status) return r({ error: "Estado requerido" }, 400);
  const old = rep.status; rep.status = status; rep.updatedAt = new Date().toISOString();
  if (username) addHist(rep, username, "cambió el estado", old, status);
  if (username) { const f = rep.followers.filter(f => f !== username); f.forEach(f => addNotif("status_change", `${rep.id}: ${username} cambió estado a "${status}"`, id, f)); if (!f.includes(rep.author) && rep.author !== username) addNotif("status_change", `${rep.id}: ${username} cambió estado a "${status}"`, id, rep.author); }
  return r(rep);
}

function hAssign(id: string, b: Record<string, unknown>) {
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { username } = b as { username: string };
  const old = rep.assignee; rep.assignee = username; rep.updatedAt = new Date().toISOString();
  if (username) addHist(rep, username, "se asignó el reporte", old || "nadie", username);
  addNotif("assigned", `Te asignaron el reporte ${id}`, id, username);
  return r(rep);
}

function hUnassign(id: string) { const rep = reports.find(r => r.id === id); if (!rep) return nf(); rep.assignee = null; rep.updatedAt = new Date().toISOString(); return r(rep); }

function hAddComment(id: string, b: Record<string, unknown>) {
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { text, author } = b as { text: string; author: string };
  if (!text || !author) return r({ error: "Texto y autor requeridos" }, 400);
  if (!rep.comments) rep.comments = [];
  const c: Comment = { id: nextCommentId++, text, author, createdAt: new Date().toISOString() };
  rep.comments.push(c); rep.updatedAt = new Date().toISOString();
  addHist(rep, author, "agregó un comentario");
  const f = rep.followers.filter(f => f !== author); f.forEach(f => addNotif("new_comment", `${author} comentó en ${id}`, id, f));
  if (!f.includes(rep.author) && rep.author !== author) addNotif("new_comment", `${author} comentó en ${id}`, id, rep.author);
  return r(c, 201);
}

function hFollow(id: string, b: Record<string, unknown>) {
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { username } = b as { username: string };
  if (!rep.followers) rep.followers = [];
  const i = rep.followers.indexOf(username);
  if (i >= 0) rep.followers.splice(i, 1); else rep.followers.push(username);
  return r(rep);
}

function hAddAttachment(id: string, b: Record<string, unknown>) {
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { url, name, added_by } = b as { url: string; name: string; added_by: string };
  if (!url) return r({ error: "URL requerida" }, 400);
  if (!rep.attachments) rep.attachments = [];
  const a: Attachment = { id: nextAttachmentId++, url, name: name || "Adjunto", added_by: added_by || "Desconocido", created_at: new Date().toISOString() };
  rep.attachments.push(a); if (added_by) addHist(rep, added_by, "agregó un adjunto");
  return r(a, 201);
}

function hDeleteAttachment(rid: string, aid: number) {
  const rep = reports.find(r => r.id === rid); if (!rep || !rep.attachments) return nf();
  const i = rep.attachments.findIndex(a => a.id === aid); if (i === -1) return nf();
  rep.attachments.splice(i, 1); return r({ ok: true });
}

function hCreatePatch(b: Record<string, unknown>) {
  const { version, date, notes, bugIds } = b as { version: string; date: string; notes?: string; bugIds?: string[] };
  if (!version) return r({ error: "Versión requerida" }, 400);
  const id = genPatchId();
  const patch: Patch = { id, version, date: date || new Date().toISOString().slice(0, 10), notes: notes || "", bugIds: bugIds || [], createdAt: new Date().toISOString() };
  patches.push(patch);
  (bugIds || []).forEach(bid => { const rp = reports.find(r => r.id === bid); if (rp && rp.status === "Solucionado") { rp.status = "Cerrado"; addHist(rp, "Sistema", "cambió el estado", "Solucionado", "Cerrado"); } });
  return r(patch, 201);
}

function hStats() {
  const total = reports.length;
  return r({
    total, pending: reports.filter(r => r.status === "Pendiente").length,
    inRevision: reports.filter(r => r.status === "En revisión").length,
    inDev: reports.filter(r => r.status === "En desarrollo").length,
    testing: reports.filter(r => r.status === "Esperando pruebas").length,
    solved: reports.filter(r => r.status === "Solucionado").length,
    critical: reports.filter(r => r.priority === "Crítica").length,
    priorities: ["Crítica", "Alta", "Media", "Baja"].map(p => ({ priority: p, count: reports.filter(r => r.priority === p).length })),
    types: ["Bug", "Exploit", "Sugerencia", "Optimización", "Mejora"].map(t => ({ type: t, count: reports.filter(r => r.type === t).length })),
  });
}

function hMetrics() {
  const now = new Date(), days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); days.push({ date: ds, total: reports.filter(r => r.createdAt.slice(0, 10) === ds).length }); }
  const wa = new Date(now); wa.setDate(wa.getDate() - 7);
  const solved7 = reports.filter(r => r.status === "Solucionado" && r.updatedAt >= wa.toISOString()).length;
  const byStatus = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"].map(s => ({ status: s, count: reports.filter(r => r.status === s).length }));
  const byPriority = ["Crítica", "Alta", "Media", "Baja"].map(p => ({ priority: p, count: reports.filter(r => r.priority === p).length }));
  const dm: Record<string, { assignee: string; open: number; closed: number; total: number }> = {};
  reports.forEach(r => { if (!r.assignee) return; if (!dm[r.assignee]) dm[r.assignee] = { assignee: r.assignee, open: 0, closed: 0, total: 0 }; dm[r.assignee].total++; if (r.status === "Solucionado" || r.status === "Cerrado") dm[r.assignee].closed++; else dm[r.assignee].open++; });
  return r({ solved7, avgResolutionDays: "—", days, byStatus, byPriority, byDev: Object.values(dm).sort((a, b) => b.total - a.total) });
}

// ─── MAIN ROUTER ──────────────────────────────────────────────────

async function handleAll(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // Extract path from apipath query param (set by Vercel routes)
  const apipath = url.searchParams.get("apipath") || "";
  const path = apipath.split("/").filter(Boolean);
  const method = req.method;
  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    try { body = await req.json(); } catch { /* ignore */ }
  }

  try {
    // Auth
    if (path[0] === "register" && method === "POST") return hRegister(body);
    if (path[0] === "login" && method === "POST") return hLogin(body);
    // Users
    if (path[0] === "users" && path.length === 1 && method === "GET") return r(users.map(({ password, ...u }) => u));
    if (path[0] === "users" && path.length === 2 && method === "PUT") return hUpdateUser(parseInt(path[1]), body);
    // Settings
    if (path[0] === "settings" && method === "GET") return r(kvSettings);
    if (path[0] === "settings" && method === "POST") { const { key, value } = body as { key: string; value: string }; if (key) kvSettings[key] = value || ""; return r({ ok: true }); }
    // Tags
    if (path[0] === "tags" && path.length === 1 && method === "GET") return r(tags);
    if (path[0] === "tags" && path.length === 1 && method === "POST") { const { name, color } = body as { name: string; color: string }; if (!name) return r({ error: "Nombre requerido" }, 400); const t: Tag = { id: nextTagId++, name, color: color || "#7c3aed" }; tags.push(t); return r(t, 201); }
    if (path[0] === "tags" && path.length === 2 && method === "DELETE") { const tid = parseInt(path[1]); const ti = tags.findIndex(t => t.id === tid); if (ti === -1) return nf(); tags.splice(ti, 1); return r({ ok: true }); }
    // Reports
    if (path[0] === "reports" && path.length === 1 && method === "GET") return hListReports(url);
    if (path[0] === "reports" && path.length === 1 && method === "POST") return hCreateReport(body);
    if (path[0] === "reports" && path.length === 2 && method === "GET") return hGetReport(path[1]);
    if (path[0] === "reports" && path.length === 2 && method === "DELETE") return hDeleteReport(path[1]);
    if (path[0] === "reports" && path.length === 3 && path[2] === "status" && method === "PUT") return hUpdateStatus(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "POST") return hAssign(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "DELETE") return hUnassign(path[1]);
    if (path[0] === "reports" && path.length === 3 && path[2] === "comments" && method === "POST") return hAddComment(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "follow" && method === "POST") return hFollow(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "attachments" && method === "POST") return hAddAttachment(path[1], body);
    if (path[0] === "reports" && path.length === 4 && path[2] === "attachments" && method === "DELETE") return hDeleteAttachment(path[1], parseInt(path[3]));
    // Patches
    if (path[0] === "patches" && path.length === 1 && method === "GET") return r(patches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (path[0] === "patches" && path.length === 1 && method === "POST") return hCreatePatch(body);
    // Stats / Metrics
    if (path[0] === "stats" && method === "GET") return hStats();
    if (path[0] === "metrics" && method === "GET") return hMetrics();
    // Notifications
    if (path[0] === "notifications" && path.length === 1 && method === "GET") {
      const uname = url.searchParams.get("username") || "";
      return r(notifications.filter(n => n.username === uname).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
    if (path[0] === "notifications" && path.length === 3 && path[2] === "read" && method === "PUT") { const nid = parseInt(path[1]); const n = notifications.find(n => n.id === nid); if (n) n.read = 1; return r({ ok: true }); }
    if (path[0] === "notifications" && path.length === 2 && path[1] === "read-all" && method === "PUT") { const { username } = body as { username: string }; notifications.forEach(n => { if (n.username === username) n.read = 1; }); return r({ ok: true }); }

    return nf();
  } catch (e: unknown) {
    return r({ error: e instanceof Error ? e.message : "Error del servidor" }, 500);
  }
}

export { handleAll as GET, handleAll as POST, handleAll as PUT, handleAll as DELETE, handleAll as PATCH };
