export const runtime = "nodejs";
import { Redis } from "@upstash/redis";
import { createHmac, timingSafeEqual } from "node:crypto";

let redis: Redis | null = null;
try {
  redis = Redis.fromEnv();
} catch {
  // Upstash Redis not configured — will use in-memory fallback
}

const STATE_KEY = "samp-tracker-state";

// ─── INTERFACES ────────────────────────────────────────────────────

interface User { id: number; name: string; username: string; password: string; role: string; color: string; bg: string; avatar: string; discordWebhook: string; createdAt: string; }
interface Comment { id: number; text: string; author: string; createdAt: string; }
interface Attachment { id: number; url: string; name: string; added_by: string; created_at: string; }
interface HistoryEntry { user: string; action: string; from: string; to: string; date: string; }
interface Report { id: string; title: string; type: string; priority: string; status: string; description: string; evidence: string; author: string; assignee: string | null; followers: string[]; tags: number[]; comments: Comment[]; attachments: Attachment[]; history: HistoryEntry[]; createdAt: string; updatedAt: string; }
interface Patch { id: string; version: string; date: string; notes: string; bugIds: string[]; createdAt: string; }
interface Tag { id: number; name: string; color: string; }
interface NotificationItem { id: number; type: string; message: string; report_id: string; username: string; read: number; created_at: string; }

interface AppState {
  nextUserId: number; nextCommentId: number; nextAttachmentId: number; nextTagId: number; nextNotifId: number;
  reportCounter: number; patchCounter: number;
  users: User[];
  reports: Report[];
  patches: Patch[];
  tags: Tag[];
  notifications: NotificationItem[];
  kvSettings: Record<string, string>;
}

// ─── DEFAULTS ──────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  CEO: { color: "#e8c547", bg: "rgba(232,197,71,0.15)" },
  Developer: { color: "#bc8cff", bg: "rgba(188,140,255,0.15)" },
  Tester: { color: "#58a6ff", bg: "rgba(88,166,255,0.15)" },
};

const STATUSES = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"] as const;
const PRIORITIES = ["Crítica", "Alta", "Media", "Baja"] as const;
const REPORT_TYPES = ["Bug", "Exploit", "Sugerencia", "Optimización", "Mejora"] as const;

function canonicalStatus(value: unknown) {
  const aliases: Record<string, string> = {
    "En revision": "En revisión",
    "En revisión": "En revisión",
  };
  return aliases[String(value || "")] || String(value || "");
}

function canonicalPriority(value: unknown) {
  const aliases: Record<string, string> = {
    Critica: "Crítica",
    "Crítica": "Crítica",
  };
  return aliases[String(value || "")] || String(value || "");
}

function canonicalType(value: unknown) {
  const aliases: Record<string, string> = {
    Optimizacion: "Optimización",
    "Optimización": "Optimización",
  };
  return aliases[String(value || "")] || String(value || "");
}

const DEFAULT_STATE: AppState = {
  nextUserId: 2, nextCommentId: 1, nextAttachmentId: 1, nextTagId: 1, nextNotifId: 1,
  reportCounter: 1, patchCounter: 1,
  users: [{
    id: 1, name: "Admin", username: "admin", password: "admin123", role: "CEO",
    color: ROLE_COLORS.CEO.color, bg: ROLE_COLORS.CEO.bg, avatar: "", discordWebhook: "", createdAt: new Date().toISOString(),
  }],
  reports: [],
  patches: [],
  tags: [
    { id: 1, name: "urgente", color: "#dc2626" },
    { id: 2, name: "UI", color: "#2563eb" },
    { id: 3, name: "backend", color: "#16a34a" },
  ],
  notifications: [],
  kvSettings: {},
};

// ─── IN-MEMORY STATE ───────────────────────────────────────────────

let state: AppState = JSON.parse(JSON.stringify(DEFAULT_STATE));

// ─── KV PERSISTENCE ────────────────────────────────────────────────

async function loadState() {
  if (!redis) return;
  try {
    const saved = await redis.get<AppState>(STATE_KEY);
    if (saved && typeof saved === "object") {
      state = saved;
      const changed = safeInit(state);
      if (changed) await saveState();
    }
  } catch {
    // KV not available — use defaults
  }
}

async function saveState() {
  if (!redis) return;
  try {
    await redis.set(STATE_KEY, state);
  } catch {
    // ignore write errors
  }
}

function safeInit(s: AppState) {
  let changed = false;
  if (!Array.isArray(s.reports)) { s.reports = []; changed = true; }
  if (!Array.isArray(s.patches)) { s.patches = []; changed = true; }
  if (!Array.isArray(s.users)) { s.users = DEFAULT_STATE.users; changed = true; }
  if (!Array.isArray(s.tags)) { s.tags = DEFAULT_STATE.tags; changed = true; }
  if (!Array.isArray(s.notifications)) { s.notifications = []; changed = true; }
  if (typeof s.kvSettings !== "object") { s.kvSettings = {}; changed = true; }
  if (!Number.isInteger(s.nextUserId) || s.nextUserId < 1) { s.nextUserId = Math.max(1, ...s.users.map(u => u.id + 1)); changed = true; }
  if (!Number.isInteger(s.nextCommentId) || s.nextCommentId < 1) { s.nextCommentId = Math.max(1, ...s.reports.flatMap(r => (r.comments || []).map(c => c.id + 1))); changed = true; }
  if (!Number.isInteger(s.nextAttachmentId) || s.nextAttachmentId < 1) { s.nextAttachmentId = Math.max(1, ...s.reports.flatMap(r => (r.attachments || []).map(a => a.id + 1))); changed = true; }
  if (!Number.isInteger(s.nextTagId) || s.nextTagId < 1) { s.nextTagId = Math.max(1, ...s.tags.map(t => t.id + 1)); changed = true; }
  if (!Number.isInteger(s.nextNotifId) || s.nextNotifId < 1) { s.nextNotifId = Math.max(1, ...s.notifications.map(n => n.id + 1)); changed = true; }
  if (!Number.isInteger(s.reportCounter) || s.reportCounter < 1) { s.reportCounter = Math.max(1, ...s.reports.map(r => Number(r.id.replace(/^BUG-/, "")) + 1).filter(Number.isFinite)); changed = true; }
  if (!Number.isInteger(s.patchCounter) || s.patchCounter < 1) { s.patchCounter = Math.max(1, ...s.patches.map(p => Number(p.id.replace(/^PATCH-/, "")) + 1).filter(Number.isFinite)); changed = true; }
  s.reports.forEach(report => {
    const status = canonicalStatus(report.status);
    const priority = canonicalPriority(report.priority);
    const type = canonicalType(report.type);
    if (report.status !== status) { report.status = status; changed = true; }
    if (report.priority !== priority) { report.priority = priority; changed = true; }
    if (report.type !== type) { report.type = type; changed = true; }
    if (!Array.isArray(report.followers)) { report.followers = []; changed = true; }
    if (!Array.isArray(report.tags)) { report.tags = []; changed = true; }
    if (!Array.isArray(report.comments)) { report.comments = []; changed = true; }
    if (!Array.isArray(report.attachments)) { report.attachments = []; changed = true; }
    if (!Array.isArray(report.history)) { report.history = []; changed = true; }
  });
  return changed;
}

// ─── CONVENIENCE ACCESSORS ─────────────────────────────────────────

function getUsers() { return state.users; }
function getReports() { return state.reports; }
function getPatches() { return state.patches; }
function getTags() { return state.tags; }
function getNotifications() { return state.notifications; }
function getKvSettings() { return state.kvSettings; }

// ─── HELPERS ──────────────────────────────────────────────────────

function r(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function nf() { return r({ error: "Not found" }, 404); }
function unauthorized() { return r({ error: "Sesión requerida." }, 401); }
function forbidden() { return r({ error: "No tenés permisos para realizar esta acción." }, 403); }

function publicUser(user: User) {
  const { password: _, discordWebhook: __, ...safe } = user;
  return safe;
}

function sessionKey(user: User) {
  return `${process.env.SESSION_SECRET || "legacy-roleplay"}:${user.password}`;
}

function createSessionToken(user: User) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, issuedAt: Date.now() })).toString("base64url");
  const signature = createHmac("sha256", sessionKey(user)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function getAuthUser(req: Request) {
  const header = req.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const [payload, signature] = header.slice(7).split(".");
  if (!payload || !signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id?: number; issuedAt?: number };
    if (!parsed.id || !parsed.issuedAt || Date.now() - parsed.issuedAt > 7 * 24 * 60 * 60 * 1000) return null;
    const user = getUsers().find(u => u.id === parsed.id);
    if (!user) return null;
    const expected = createHmac("sha256", sessionKey(user)).update(payload).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
    return user;
  } catch {
    return null;
  }
}

function requireUser(req: Request) {
  return getAuthUser(req);
}

function hasRole(user: User | null, ...roles: string[]) {
  return !!user && roles.includes(user.role);
}

function isSafeHttpUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeAvatar(value: unknown) {
  if (value === "") return true;
  if (isSafeHttpUrl(value)) return true;
  return typeof value === "string" &&
    value.length <= 700_000 &&
    /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

function genRptId() { return `BUG-${String(state.reportCounter++).padStart(3, "0")}`; }
function genPatchId() { return `PATCH-${String(state.patchCounter++).padStart(3, "0")}`; }

function addHist(report: Report, user: string, action: string, from?: string, to?: string) {
  if (!report.history) report.history = [];
  report.history.push({ user, action, from: from || "", to: to || "", date: new Date().toISOString() });
}
function addNotif(type: string, msg: string, reportId: string, username: string) {
  const notifications = getNotifications();
  notifications.push({ id: state.nextNotifId++, type, message: msg, report_id: reportId, username, read: 0, created_at: new Date().toISOString() });
}

// ─── HANDLERS ─────────────────────────────────────────────────────

function hRegister(b: Record<string, unknown>) {
  const users = getUsers();
  const { name, username, password, role } = b as { name: string; username: string; password: string; role: string };
  if (typeof name !== "string" || typeof username !== "string" || typeof password !== "string" || !name.trim() || !username.trim() || password.length < 6) {
    return r({ error: "Todos los campos son requeridos." }, 400);
  }
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return r({ error: "Ese usuario ya existe." }, 409);
  const rc = ROLE_COLORS.Tester;
  const user: User = { id: state.nextUserId++, name: name.trim(), username: username.trim(), password, role: "Tester", color: rc.color, bg: rc.bg, avatar: "", discordWebhook: "", createdAt: new Date().toISOString() };
  users.push(user);
  return r(publicUser(user), 201);
}

function hLogin(b: Record<string, unknown>) {
  const users = getUsers();
  const { username, password } = b as { username: string; password: string };
  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password) {
    return r({ error: "Usuario y contraseña son requeridos." }, 400);
  }
  const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
  if (!user) return r({ error: "Usuario o contraseña incorrectos." }, 401);
  return r({ user: publicUser(user), token: createSessionToken(user) });
}

function hUpdateUser(id: number, b: Record<string, unknown>, sessionUserId?: number, canManageRole = false) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return nf();
  const user = users[idx];
  const { name, currentPassword, newPassword, avatar, discordWebhook, role } = b as { name?: string; currentPassword?: string; newPassword?: string; avatar?: string; discordWebhook?: string; role?: string };
  if (role !== undefined) {
    if (!canManageRole) return forbidden();
    if (!Object.prototype.hasOwnProperty.call(ROLE_COLORS, role)) return r({ error: "Rol no válido." }, 400);
    if (user.role === "CEO" && role !== "CEO" && users.filter(u => u.role === "CEO").length <= 1) {
      return r({ error: "No se puede quitar el último CEO." }, 400);
    }
    user.role = role;
    user.color = ROLE_COLORS[role].color;
    user.bg = ROLE_COLORS[role].bg;
  }
  if (newPassword && !currentPassword) return r({ error: "Ingresá tu contraseña actual para cambiarla." }, 400);
  if (newPassword && newPassword.length < 6) return r({ error: "La nueva contraseña debe tener al menos 6 caracteres." }, 400);
  if (avatar !== undefined && !isSafeAvatar(avatar)) return r({ error: "Avatar no válido." }, 400);
  if (currentPassword) { if (currentPassword !== user.password) return r({ error: "Contraseña actual incorrecta." }, 400); if (newPassword) user.password = newPassword; }
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  if (discordWebhook !== undefined) user.discordWebhook = discordWebhook;
  return r({
    ...publicUser(user),
    ...(sessionUserId === id ? { token: createSessionToken(user) } : {}),
  });
}

function hDeleteUser(id: number, sessionUserId: number) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return nf();
  const target = users[idx];
  if (target.id === sessionUserId && !(target.role === "CEO" && users.some(u => u.id !== target.id && u.role === "CEO"))) {
    return r({ error: "No podés eliminar tu propia cuenta." }, 400);
  }
  if (target.role === "CEO" && users.filter(u => u.role === "CEO").length <= 1) {
    return r({ error: "No se puede eliminar el último CEO." }, 400);
  }
  users.splice(idx, 1);
  return r({ ok: true });
}

function hListReports(url: URL) {
  const reports = getReports();
  const search = (url.searchParams.get("search") || "").toLowerCase();
  const status = url.searchParams.get("status") || "";
  const priority = url.searchParams.get("priority") || "";
  const type = url.searchParams.get("type") || "";
  let filtered = [...reports];
  if (search) filtered = filtered.filter(r => r.title.toLowerCase().includes(search) || r.id.toLowerCase().includes(search));
  if (status) filtered = filtered.filter(r => canonicalStatus(r.status) === canonicalStatus(status));
  if (priority) filtered = filtered.filter(r => canonicalPriority(r.priority) === canonicalPriority(priority));
  if (type) filtered = filtered.filter(r => canonicalType(r.type) === canonicalType(type));
  filtered.forEach(report => {
    report.status = canonicalStatus(report.status);
    report.priority = canonicalPriority(report.priority);
    report.type = canonicalType(report.type);
  });
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return r(filtered);
}

function hCreateReport(b: Record<string, unknown>) {
  const reports = getReports();
  const users = getUsers();
  const { title, type, priority, description, evidence, author } = b as { title: string; type: string; priority: string; description: string; evidence?: string; author: string };
  if (typeof title !== "string" || typeof description !== "string" || typeof author !== "string" || !title.trim() || !description.trim() || !author.trim()) {
    return r({ error: "Título, descripción y autor son requeridos." }, 400);
  }
  if (type && !REPORT_TYPES.includes(canonicalType(type) as typeof REPORT_TYPES[number])) return r({ error: "Tipo no válido." }, 400);
  if (priority && !PRIORITIES.includes(canonicalPriority(priority) as typeof PRIORITIES[number])) return r({ error: "Prioridad no válida." }, 400);
  if (evidence && !isSafeHttpUrl(evidence)) return r({ error: "La evidencia debe ser una URL http o https válida." }, 400);
  const id = genRptId(), now = new Date().toISOString();
  const report: Report = { id, title: title.trim(), type: canonicalType(type || "Bug"), priority: canonicalPriority(priority || "Media"), status: "Pendiente", description: description.trim(), evidence: typeof evidence === "string" ? evidence : "", author: author.trim(), assignee: null, followers: [author.trim()], tags: [], comments: [], attachments: [], history: [{ user: author.trim(), action: "creó el reporte", from: "", to: "", date: now }], createdAt: now, updatedAt: now };
  reports.push(report);
  addNotif("new_report", `Nuevo reporte ${id}: ${title}`, id, author);
  users.filter(u => u.role === "CEO").forEach(u => addNotif("new_report", `Nuevo reporte ${id}: ${title} por ${author}`, id, u.username));
  saveState();
  return r(report, 201);
}

function hGetReport(id: string) { const x = getReports().find(r => r.id === id); return x ? r(x) : nf(); }
function hDeleteReport(id: string) { const i = getReports().findIndex(r => r.id === id); if (i === -1) return nf(); getReports().splice(i, 1); return r({ ok: true }); }

function hUpdateStatus(id: string, b: Record<string, unknown>) {
  const reports = getReports();
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { status, username } = b as { status: string; username: string };
  const nextStatus = canonicalStatus(status);
  if (!STATUSES.includes(nextStatus as typeof STATUSES[number])) return r({ error: "Estado no válido" }, 400);
  const old = canonicalStatus(rep.status); rep.status = nextStatus; rep.updatedAt = new Date().toISOString();
  if (username) addHist(rep, username, "cambió el estado", old, nextStatus);
  if (username) { const f = rep.followers.filter(f => f !== username); f.forEach(f => addNotif("status_change", `${rep.id}: ${username} cambió estado a "${nextStatus}"`, id, f)); if (!f.includes(rep.author) && rep.author !== username) addNotif("status_change", `${rep.id}: ${username} cambió estado a "${nextStatus}"`, id, rep.author); }
  return r(rep);
}

function hAssign(id: string, b: Record<string, unknown>) {
  const reports = getReports();
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { username } = b as { username: string };
  const old = rep.assignee; rep.assignee = username; rep.updatedAt = new Date().toISOString();
  if (username) addHist(rep, username, "se asignó el reporte", old || "nadie", username);
  addNotif("assigned", `Te asignaron el reporte ${id}`, id, username);
  return r(rep);
}

function hUnassign(id: string) { const rep = getReports().find(r => r.id === id); if (!rep) return nf(); rep.assignee = null; rep.updatedAt = new Date().toISOString(); return r(rep); }

function hAddComment(id: string, b: Record<string, unknown>) {
  const reports = getReports();
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { text, author } = b as { text: string; author: string };
  if (!text || !author) return r({ error: "Texto y autor requeridos" }, 400);
  if (!rep.comments) rep.comments = [];
  const c: Comment = { id: state.nextCommentId++, text, author, createdAt: new Date().toISOString() };
  rep.comments.push(c); rep.updatedAt = new Date().toISOString();
  addHist(rep, author, "agregó un comentario");
  const f = rep.followers.filter(f => f !== author); f.forEach(f => addNotif("new_comment", `${author} comentó en ${id}`, id, f));
  if (!f.includes(rep.author) && rep.author !== author) addNotif("new_comment", `${author} comentó en ${id}`, id, rep.author);
  return r(c, 201);
}

function hFollow(id: string, b: Record<string, unknown>) {
  const reports = getReports();
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { username } = b as { username: string };
  if (!rep.followers) rep.followers = [];
  const i = rep.followers.indexOf(username);
  if (i >= 0) rep.followers.splice(i, 1); else rep.followers.push(username);
  return r(rep);
}

function hAddAttachment(id: string, b: Record<string, unknown>) {
  const reports = getReports();
  const rep = reports.find(r => r.id === id); if (!rep) return nf();
  const { url, name, added_by } = b as { url: string; name: string; added_by: string };
  if (!isSafeHttpUrl(url)) return r({ error: "La URL debe ser http o https válida." }, 400);
  if (!rep.attachments) rep.attachments = [];
  const a: Attachment = { id: state.nextAttachmentId++, url, name: name || "Adjunto", added_by: added_by || "Desconocido", created_at: new Date().toISOString() };
  rep.attachments.push(a); if (added_by) addHist(rep, added_by, "agregó un adjunto");
  return r(a, 201);
}

function hDeleteAttachment(rid: string, aid: number) {
  const reports = getReports();
  const rep = reports.find(r => r.id === rid); if (!rep || !rep.attachments) return nf();
  const i = rep.attachments.findIndex(a => a.id === aid); if (i === -1) return nf();
  rep.attachments.splice(i, 1); return r({ ok: true });
}

function hCreatePatch(b: Record<string, unknown>) {
  const reports = getReports();
  const patches = getPatches();
  const { version, date, notes, bugIds } = b as { version: string; date: string; notes?: string; bugIds?: string[] };
  if (!version) return r({ error: "Versión requerida" }, 400);
  const id = genPatchId();
  const patch: Patch = { id, version, date: date || new Date().toISOString().slice(0, 10), notes: notes || "", bugIds: bugIds || [], createdAt: new Date().toISOString() };
  patches.push(patch);
  (bugIds || []).forEach(bid => { const rp = reports.find(r => r.id === bid); if (rp && rp.status === "Solucionado") { rp.status = "Cerrado"; addHist(rp, "Sistema", "cambió el estado", "Solucionado", "Cerrado"); } });
  return r(patch, 201);
}

function hStats() {
  const reports = getReports();
  const total = reports.length;
  return r({
    total, pending: reports.filter(r => canonicalStatus(r.status) === "Pendiente").length,
     inRevision: reports.filter(r => canonicalStatus(r.status) === "En revisión").length,
     inDev: reports.filter(r => canonicalStatus(r.status) === "En desarrollo").length,
     testing: reports.filter(r => canonicalStatus(r.status) === "Esperando pruebas").length,
     solved: reports.filter(r => canonicalStatus(r.status) === "Solucionado").length,
     critical: reports.filter(r => canonicalPriority(r.priority) === "Crítica").length,
     priorities: PRIORITIES.map(p => ({ priority: p, count: reports.filter(r => canonicalPriority(r.priority) === p).length })),
     types: REPORT_TYPES.map(t => ({ type: t, count: reports.filter(r => canonicalType(r.type) === t).length })),
  });
}

function hMetrics() {
  const reports = getReports();
  const now = new Date(), days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); const ds = d.toISOString().slice(0, 10); days.push({ date: ds, total: reports.filter(r => r.createdAt.slice(0, 10) === ds).length }); }
  const wa = new Date(now); wa.setDate(wa.getDate() - 7);
  const solved7 = reports.filter(r => canonicalStatus(r.status) === "Solucionado" && r.updatedAt >= wa.toISOString()).length;
  const byStatus = STATUSES.map(s => ({ status: s, count: reports.filter(r => canonicalStatus(r.status) === s).length }));
  const byPriority = PRIORITIES.map(p => ({ priority: p, count: reports.filter(r => canonicalPriority(r.priority) === p).length }));
  const dm: Record<string, { assignee: string; open: number; closed: number; total: number }> = {};
  reports.forEach(r => { if (!r.assignee) return; if (!dm[r.assignee]) dm[r.assignee] = { assignee: r.assignee, open: 0, closed: 0, total: 0 }; dm[r.assignee].total++; if (canonicalStatus(r.status) === "Solucionado" || canonicalStatus(r.status) === "Cerrado") dm[r.assignee].closed++; else dm[r.assignee].open++; });
  return r({ solved7, avgResolutionDays: "—", days, byStatus, byPriority, byDev: Object.values(dm).sort((a, b) => b.total - a.total) });
}

// ─── MAIN ROUTER ──────────────────────────────────────────────────

async function handleAll(req: Request): Promise<Response> {
  await loadState();

  const url = new URL(req.url);
  const apipath = url.searchParams.get("apipath") || "";
  const path = apipath.split("/").filter(Boolean);
  const method = req.method;
  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    try { body = await req.json(); } catch { /* ignore */ }
  }

  try {
    const user = requireUser(req);
    // Auth
    if (path[0] === "register" && method === "POST") return hRegister(body);
    if (path[0] === "login" && method === "POST") return hLogin(body);
    // Users
    if (path[0] === "users" && path.length === 1 && method === "GET") {
      if (!user) return unauthorized();
      return r(getUsers().map(publicUser));
    }
    if (path[0] === "users" && path.length === 2 && method === "PUT") {
      if (!user) return unauthorized();
      const id = Number(path[1]);
      if (!Number.isInteger(id) || (user.id !== id && !hasRole(user, "CEO"))) return forbidden();
      return hUpdateUser(id, body, user.id, hasRole(user, "CEO"));
    }
    if (path[0] === "users" && path.length === 2 && method === "DELETE") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      const id = Number(path[1]);
      if (!Number.isInteger(id)) return nf();
      return hDeleteUser(id, user.id);
    }
    // Settings
    if (path[0] === "settings" && method === "GET") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      return r(getKvSettings());
    }
    if (path[0] === "settings" && method === "POST") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      const { key, value } = body as { key: string; value: string };
      if (key) getKvSettings()[key] = value || "";
      return r({ ok: true });
    }
    // Tags
    if (path[0] === "tags" && path.length === 1 && method === "GET") {
      if (!user) return unauthorized();
      return r(getTags());
    }
    if (path[0] === "tags" && path.length === 1 && method === "POST") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      const { name, color } = body as { name: string; color: string };
      if (!name || !name.trim()) return r({ error: "Nombre requerido" }, 400);
      const tags = getTags();
      const t: Tag = { id: state.nextTagId++, name: name.trim(), color: color || "#7c3aed" };
      tags.push(t);
      return r(t, 201);
    }
    if (path[0] === "tags" && path.length === 2 && method === "DELETE") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      const tags = getTags();
      const tid = parseInt(path[1]);
      const ti = tags.findIndex(t => t.id === tid);
      if (ti === -1) return nf();
      tags.splice(ti, 1);
      return r({ ok: true });
    }
    // Reports
    if (path[0] === "reports" && path.length === 1 && method === "GET") {
      if (!user) return unauthorized();
      return hListReports(url);
    }
    if (path[0] === "reports" && path.length === 1 && method === "POST") {
      if (!user) return unauthorized();
      return hCreateReport({ ...body, author: user.name });
    }
    if (path[0] === "reports" && path.length === 2 && method === "GET") {
      if (!user) return unauthorized();
      return hGetReport(path[1]);
    }
    if (path[0] === "reports" && path.length === 2 && method === "DELETE") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      return hDeleteReport(path[1]);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "status" && method === "PUT") {
      if (!user || !hasRole(user, "CEO", "Developer")) return user ? forbidden() : unauthorized();
      return hUpdateStatus(path[1], { ...body, username: user.name });
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "POST") {
      if (!user || !hasRole(user, "Developer")) return user ? forbidden() : unauthorized();
      return hAssign(path[1], { username: user.name });
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "DELETE") {
      if (!user || !hasRole(user, "CEO")) return user ? forbidden() : unauthorized();
      return hUnassign(path[1]);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "comments" && method === "POST") {
      if (!user) return unauthorized();
      return hAddComment(path[1], { ...body, author: user.name });
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "follow" && method === "POST") {
      if (!user) return unauthorized();
      return hFollow(path[1], { username: user.name });
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "attachments" && method === "POST") {
      if (!user || !hasRole(user, "CEO", "Developer")) return user ? forbidden() : unauthorized();
      return hAddAttachment(path[1], { ...body, added_by: user.name });
    }
    if (path[0] === "reports" && path.length === 4 && path[2] === "attachments" && method === "DELETE") {
      if (!user || !hasRole(user, "CEO", "Developer")) return user ? forbidden() : unauthorized();
      return hDeleteAttachment(path[1], parseInt(path[3]));
    }
    // Patches
    if (path[0] === "patches" && path.length === 1 && method === "GET") return r(getPatches().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (path[0] === "patches" && path.length === 1 && method === "POST") {
      if (!user || !hasRole(user, "CEO", "Developer")) return user ? forbidden() : unauthorized();
      return hCreatePatch(body);
    }
    // Stats / Metrics
    if (path[0] === "stats" && method === "GET") return hStats();
    if (path[0] === "metrics" && method === "GET") return hMetrics();
    // Notifications
    if (path[0] === "notifications" && path.length === 1 && method === "GET") {
      if (!user) return unauthorized();
      const uname = url.searchParams.get("username") || "";
      if (uname !== user.name && uname !== user.username) return forbidden();
      return r(getNotifications().filter(n => n.username === user.name || n.username === user.username).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
    if (path[0] === "notifications" && path.length === 3 && path[2] === "read" && method === "PUT") {
      if (!user) return unauthorized();
      const nid = parseInt(path[1]);
      const n = getNotifications().find(n => n.id === nid);
      if (n && (n.username === user.name || n.username === user.username)) n.read = 1;
      return r({ ok: true });
    }
    if (path[0] === "notifications" && path.length === 2 && path[1] === "read-all" && method === "PUT") {
      if (!user) return unauthorized();
      getNotifications().forEach(n => { if (n.username === user.name || n.username === user.username) n.read = 1; });
      return r({ ok: true });
    }

    return nf();
  } catch (e: unknown) {
    return r({ error: e instanceof Error ? e.message : "Error del servidor" }, 500);
  } finally {
    if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") {
      await saveState();
    }
  }
}

export { handleAll as GET, handleAll as POST, handleAll as PUT, handleAll as DELETE, handleAll as PATCH };
