// ─── IN-MEMORY STORAGE ────────────────────────────────────────────

interface User {
  id: number;
  name: string;
  username: string;
  password: string;
  role: string;
  color: string;
  bg: string;
  avatar: string;
  discordWebhook: string;
  createdAt: string;
}

interface Comment {
  id: number;
  text: string;
  author: string;
  createdAt: string;
}

interface Attachment {
  id: number;
  url: string;
  name: string;
  added_by: string;
  created_at: string;
}

interface HistoryEntry {
  user: string;
  action: string;
  from: string;
  to: string;
  date: string;
}

interface Report {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string;
  evidence: string;
  author: string;
  assignee: string | null;
  followers: string[];
  tags: number[];
  comments: Comment[];
  attachments: Attachment[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

interface Patch {
  id: string;
  version: string;
  date: string;
  notes: string;
  bugIds: string[];
  createdAt: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Notification {
  id: number;
  type: string;
  message: string;
  report_id: string;
  username: string;
  read: number;
  created_at: string;
}

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  CEO: { color: "#e8c547", bg: "rgba(232,197,71,0.15)" },
  Developer: { color: "#bc8cff", bg: "rgba(188,140,255,0.15)" },
  Tester: { color: "#58a6ff", bg: "rgba(88,166,255,0.15)" },
};

let nextUserId = 2;
let nextCommentId = 1;
let nextAttachmentId = 1;
let nextTagId = 1;
let nextNotifId = 1;
let reportCounter = 1;
let patchCounter = 1;

const users: User[] = [
  {
    id: 1,
    name: "Admin",
    username: "admin",
    password: "admin123",
    role: "CEO",
    color: ROLE_COLORS.CEO.color,
    bg: ROLE_COLORS.CEO.bg,
    avatar: "",
    discordWebhook: "",
    createdAt: new Date().toISOString(),
  },
];

const reports: Report[] = [];
const patches: Patch[] = [];
const tags: Tag[] = [
  { id: 1, name: "urgente", color: "#dc2626" },
  { id: 2, name: "UI", color: "#2563eb" },
  { id: 3, name: "backend", color: "#16a34a" },
];
const notifications: Notification[] = [];
const settings: Record<string, string> = {};

if (tags.length > 0) nextTagId = Math.max(...tags.map(t => t.id)) + 1;

function generateReportId(): string {
  return `BUG-${String(reportCounter++).padStart(3, "0")}`;
}

function generatePatchId(): string {
  return `PATCH-${String(patchCounter++).padStart(3, "0")}`;
}

function resJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(): Response {
  return resJson({ error: "Not found" }, 404);
}

function addHistory(report: Report, user: string, action: string, from?: string, to?: string) {
  if (!report.history) report.history = [];
  report.history.push({
    user,
    action,
    from: from || "",
    to: to || "",
    date: new Date().toISOString(),
  });
}

function addNotification(type: string, message: string, reportId: string, username: string) {
  notifications.push({
    id: nextNotifId++,
    type,
    message,
    report_id: reportId,
    username,
    read: 0,
    created_at: new Date().toISOString(),
  });
}

// ─── AUTH HANDLERS ────────────────────────────────────────────────

function handleRegister(body: Record<string, unknown>): Response {
  const { name, username, password, role } = body as { name: string; username: string; password: string; role: string };
  if (!name || !username || !password) return resJson({ error: "Todos los campos son requeridos." }, 400);
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return resJson({ error: "Ese usuario ya existe." }, 409);
  const rc = ROLE_COLORS[role] || ROLE_COLORS.Tester;
  const user: User = { id: nextUserId++, name, username, password, role: role || "Tester", color: rc.color, bg: rc.bg, avatar: "", discordWebhook: "", createdAt: new Date().toISOString() };
  users.push(user);
  const { password: _, ...safe } = user;
  return resJson(safe, 201);
}

function handleLogin(body: Record<string, unknown>): Response {
  const { username, password } = body as { username: string; password: string };
  const user = users.find(u => u.username.toLowerCase() === (username || "").toLowerCase() && u.password === password);
  if (!user) return resJson({ error: "Usuario o contraseña incorrectos." }, 401);
  const { password: _, ...safe } = user;
  return resJson(safe);
}

function handleUpdateUser(id: number, body: Record<string, unknown>): Response {
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return notFound();
  const user = users[idx];
  const { name, currentPassword, newPassword, avatar, discordWebhook } = body as { name?: string; currentPassword?: string; newPassword?: string; avatar?: string; discordWebhook?: string };
  if (currentPassword) {
    if (currentPassword !== user.password) return resJson({ error: "Contraseña actual incorrecta." }, 400);
    if (newPassword) user.password = newPassword;
  }
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  if (discordWebhook !== undefined) user.discordWebhook = discordWebhook;
  const { password: _, ...safe } = user;
  return resJson(safe);
}

// ─── REPORT HANDLERS ──────────────────────────────────────────────

function handleListReports(url: URL): Response {
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
  return resJson(filtered);
}

function handleCreateReport(body: Record<string, unknown>): Response {
  const { title, type, priority, description, evidence, author } = body as { title: string; type: string; priority: string; description: string; evidence?: string; author: string };
  if (!title || !description || !author) return resJson({ error: "Título, descripción y autor son requeridos." }, 400);
  const id = generateReportId();
  const now = new Date().toISOString();
  const report: Report = { id, title, type: type || "Bug", priority: priority || "Media", status: "Pendiente", description, evidence: evidence || "", author, assignee: null, followers: [author], tags: [], comments: [], attachments: [], history: [{ user: author, action: "creó el reporte", from: "", to: "", date: now }], createdAt: now, updatedAt: now };
  reports.push(report);
  addNotification("new_report", `Nuevo reporte ${id}: ${title}`, id, author);
  users.filter(u => u.role === "CEO").forEach(u => addNotification("new_report", `Nuevo reporte ${id}: ${title} por ${author}`, id, u.username));
  return resJson(report, 201);
}

function handleGetReport(id: string): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  return resJson(report);
}

function handleDeleteReport(id: string): Response {
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return notFound();
  reports.splice(idx, 1);
  return resJson({ ok: true });
}

function handleUpdateStatus(id: string, body: Record<string, unknown>): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  const { status, username } = body as { status: string; username: string };
  if (!status) return resJson({ error: "Estado requerido" }, 400);
  const oldStatus = report.status;
  report.status = status;
  report.updatedAt = new Date().toISOString();
  if (username) addHistory(report, username, "cambió el estado", oldStatus, status);
  if (username) {
    const followers = report.followers.filter(f => f !== username);
    followers.forEach(f => addNotification("status_change", `${report.id}: ${username} cambió estado a "${status}"`, id, f));
    if (!followers.includes(report.author) && report.author !== username) addNotification("status_change", `${report.id}: ${username} cambió estado a "${status}"`, id, report.author);
  }
  return resJson(report);
}

function handleAssign(id: string, body: Record<string, unknown>): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  const { username } = body as { username: string };
  const oldAssignee = report.assignee;
  report.assignee = username;
  report.updatedAt = new Date().toISOString();
  if (username) addHistory(report, username, "se asignó el reporte", oldAssignee || "nadie", username);
  addNotification("assigned", `Te asignaron el reporte ${id}`, id, username);
  return resJson(report);
}

function handleUnassign(id: string): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  report.assignee = null;
  report.updatedAt = new Date().toISOString();
  return resJson(report);
}

function handleAddComment(id: string, body: Record<string, unknown>): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  const { text, author } = body as { text: string; author: string };
  if (!text || !author) return resJson({ error: "Texto y autor requeridos" }, 400);
  if (!report.comments) report.comments = [];
  const comment: Comment = { id: nextCommentId++, text, author, createdAt: new Date().toISOString() };
  report.comments.push(comment);
  report.updatedAt = new Date().toISOString();
  addHistory(report, author, "agregó un comentario");
  const followers = report.followers.filter(f => f !== author);
  followers.forEach(f => addNotification("new_comment", `${author} comentó en ${id}`, id, f));
  if (!followers.includes(report.author) && report.author !== author) addNotification("new_comment", `${author} comentó en ${id}`, id, report.author);
  return resJson(comment, 201);
}

function handleFollow(id: string, body: Record<string, unknown>): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  const { username } = body as { username: string };
  if (!report.followers) report.followers = [];
  const idx = report.followers.indexOf(username);
  if (idx >= 0) report.followers.splice(idx, 1);
  else report.followers.push(username);
  return resJson(report);
}

function handleAddAttachment(id: string, body: Record<string, unknown>): Response {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound();
  const { url, name, added_by } = body as { url: string; name: string; added_by: string };
  if (!url) return resJson({ error: "URL requerida" }, 400);
  if (!report.attachments) report.attachments = [];
  const att: Attachment = { id: nextAttachmentId++, url, name: name || "Adjunto", added_by: added_by || "Desconocido", created_at: new Date().toISOString() };
  report.attachments.push(att);
  if (added_by) addHistory(report, added_by, "agregó un adjunto");
  return resJson(att, 201);
}

function handleDeleteAttachment(reportId: string, attId: number): Response {
  const report = reports.find(r => r.id === reportId);
  if (!report || !report.attachments) return notFound();
  const idx = report.attachments.findIndex(a => a.id === attId);
  if (idx === -1) return notFound();
  report.attachments.splice(idx, 1);
  return resJson({ ok: true });
}

function handleCreatePatch(body: Record<string, unknown>): Response {
  const { version, date, notes, bugIds } = body as { version: string; date: string; notes?: string; bugIds?: string[] };
  if (!version) return resJson({ error: "Versión requerida" }, 400);
  const id = generatePatchId();
  const patch: Patch = { id, version, date: date || new Date().toISOString().slice(0, 10), notes: notes || "", bugIds: bugIds || [], createdAt: new Date().toISOString() };
  patches.push(patch);
  (bugIds || []).forEach(bid => {
    const r = reports.find(r => r.id === bid);
    if (r && r.status === "Solucionado") { r.status = "Cerrado"; addHistory(r, "Sistema", "cambió el estado", "Solucionado", "Cerrado"); }
  });
  return resJson(patch, 201);
}

function handleStats(): Response {
  const total = reports.length;
  return resJson({
    total,
    pending: reports.filter(r => r.status === "Pendiente").length,
    inRevision: reports.filter(r => r.status === "En revisión").length,
    inDev: reports.filter(r => r.status === "En desarrollo").length,
    testing: reports.filter(r => r.status === "Esperando pruebas").length,
    solved: reports.filter(r => r.status === "Solucionado").length,
    critical: reports.filter(r => r.priority === "Crítica").length,
    priorities: ["Crítica", "Alta", "Media", "Baja"].map(p => ({ priority: p, count: reports.filter(r => r.priority === p).length })),
    types: ["Bug", "Exploit", "Sugerencia", "Optimización", "Mejora"].map(t => ({ type: t, count: reports.filter(r => r.type === t).length })),
  });
}

function handleMetrics(): Response {
  const now = new Date();
  const days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); days.push({ date: ds, total: reports.filter(r => r.createdAt.slice(0, 10) === ds).length }); }
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const solved7 = reports.filter(r => r.status === "Solucionado" && r.updatedAt >= weekAgo.toISOString()).length;
  const statuses = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"];
  const byStatus = statuses.map(s => ({ status: s, count: reports.filter(r => r.status === s).length }));
  const byPriority = ["Crítica", "Alta", "Media", "Baja"].map(p => ({ priority: p, count: reports.filter(r => r.priority === p).length }));
  const devMap: Record<string, { assignee: string; open: number; closed: number; total: number }> = {};
  reports.forEach(r => { if (!r.assignee) return; if (!devMap[r.assignee]) devMap[r.assignee] = { assignee: r.assignee, open: 0, closed: 0, total: 0 }; devMap[r.assignee].total++; if (r.status === "Solucionado" || r.status === "Cerrado") devMap[r.assignee].closed++; else devMap[r.assignee].open++; });
  const byDev = Object.values(devMap).sort((a, b) => b.total - a.total);
  return resJson({ solved7, avgResolutionDays: "—", days, byStatus, byPriority, byDev });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────

async function handleAll(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = req.method;
  let body: Record<string, unknown> = {};

  if (method === "POST" || method === "PUT" || method === "PATCH") {
    try { body = await req.json(); } catch { /* keep empty */ }
  }

  try {
    if (path[0] === "register" && method === "POST") return handleRegister(body);
    if (path[0] === "login" && method === "POST") return handleLogin(body);
    if (path[0] === "users" && path.length === 1 && method === "GET") return resJson(users.map(({ password, ...u }) => u));
    if (path[0] === "users" && path.length === 2 && method === "PUT") return handleUpdateUser(parseInt(path[1]), body);
    if (path[0] === "settings" && method === "GET") return resJson(settings);
    if (path[0] === "settings" && method === "POST") { const { key, value } = body as { key: string; value: string }; if (key) settings[key] = value || ""; return resJson({ ok: true }); }
    if (path[0] === "tags" && path.length === 1 && method === "GET") return resJson(tags);
    if (path[0] === "tags" && path.length === 1 && method === "POST") { const { name, color } = body as { name: string; color: string }; if (!name) return resJson({ error: "Nombre requerido" }, 400); const tag: Tag = { id: nextTagId++, name, color: color || "#7c3aed" }; tags.push(tag); return resJson(tag, 201); }
    if (path[0] === "tags" && path.length === 2 && method === "DELETE") { const tid = parseInt(path[1]); const tIdx = tags.findIndex(t => t.id === tid); if (tIdx === -1) return notFound(); tags.splice(tIdx, 1); return resJson({ ok: true }); }
    if (path[0] === "reports" && path.length === 1 && method === "GET") return handleListReports(url);
    if (path[0] === "reports" && path.length === 1 && method === "POST") return handleCreateReport(body);
    if (path[0] === "reports" && path.length === 2 && method === "GET") return handleGetReport(path[1]);
    if (path[0] === "reports" && path.length === 2 && method === "DELETE") return handleDeleteReport(path[1]);
    if (path[0] === "reports" && path.length === 3 && path[2] === "status" && method === "PUT") return handleUpdateStatus(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "POST") return handleAssign(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "DELETE") return handleUnassign(path[1]);
    if (path[0] === "reports" && path.length === 3 && path[2] === "comments" && method === "POST") return handleAddComment(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "follow" && method === "POST") return handleFollow(path[1], body);
    if (path[0] === "reports" && path.length === 3 && path[2] === "attachments" && method === "POST") return handleAddAttachment(path[1], body);
    if (path[0] === "reports" && path.length === 4 && path[2] === "attachments" && method === "DELETE") return handleDeleteAttachment(path[1], parseInt(path[3]));
    if (path[0] === "patches" && path.length === 1 && method === "GET") return resJson(patches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (path[0] === "patches" && path.length === 1 && method === "POST") return handleCreatePatch(body);
    if (path[0] === "stats" && method === "GET") return handleStats();
    if (path[0] === "metrics" && method === "GET") return handleMetrics();
    if (path[0] === "notifications" && path.length === 1 && method === "GET") {
      const username = url.searchParams.get("username") || "";
      return resJson(notifications.filter(n => n.username === username).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
    if (path[0] === "notifications" && path.length === 3 && path[2] === "read" && method === "PUT") { const nid = parseInt(path[1]); const n = notifications.find(n => n.id === nid); if (n) n.read = 1; return resJson({ ok: true }); }
    if (path[0] === "notifications" && path.length === 2 && path[1] === "read-all" && method === "PUT") { const { username } = body as { username: string }; notifications.forEach(n => { if (n.username === username) n.read = 1; }); return resJson({ ok: true }); }
    return notFound();
  } catch (e: unknown) {
    return resJson({ error: e instanceof Error ? e.message : "Error del servidor" }, 500);
  }
}

export async function GET(req: Request) { return handleAll(req); }
export async function POST(req: Request) { return handleAll(req); }
export async function PUT(req: Request) { return handleAll(req); }
export async function DELETE(req: Request) { return handleAll(req); }
export async function PATCH(req: Request) { return handleAll(req); }
