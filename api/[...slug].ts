import type { VercelRequest, VercelResponse } from "@vercel/node";

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

// Global in-memory state (persists across warm invocations)
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

// ─── HELPERS ──────────────────────────────────────────────────────

function generateReportId(): string {
  const num = String(reportCounter++).padStart(3, "0");
  return `BUG-${num}`;
}

function generatePatchId(): string {
  const num = String(patchCounter++).padStart(3, "0");
  return `PATCH-${num}`;
}

function json(res: VercelResponse, data: unknown, status = 200) {
  res.status(status).json(data);
}

function notFound(res: VercelResponse) {
  res.status(404).json({ error: "Not found" });
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

// ─── ROUTER ───────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = req.method || "GET";
  let body: Record<string, unknown> = {};

  if (method === "POST" || method === "PUT") {
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch {
      body = {};
    }
  }

  try {
    // ─── AUTH ───
    if (path[0] === "register" && method === "POST") {
      return handleRegister(res, body);
    }
    if (path[0] === "login" && method === "POST") {
      return handleLogin(res, body);
    }

    // ─── USERS ───
    if (path[0] === "users" && path.length === 1 && method === "GET") {
      return json(res, users.map(({ password, ...u }) => u));
    }
    if (path[0] === "users" && path.length === 2 && method === "PUT") {
      return handleUpdateUser(res, parseInt(path[1]), body);
    }

    // ─── SETTINGS ───
    if (path[0] === "settings" && method === "GET") {
      return json(res, settings);
    }
    if (path[0] === "settings" && method === "POST") {
      const { key, value } = body as { key: string; value: string };
      if (key) settings[key] = value || "";
      return json(res, { ok: true });
    }

    // ─── TAGS ───
    if (path[0] === "tags" && path.length === 1 && method === "GET") {
      return json(res, tags);
    }
    if (path[0] === "tags" && path.length === 1 && method === "POST") {
      const { name, color } = body as { name: string; color: string };
      if (!name) return json(res, { error: "Nombre requerido" }, 400);
      const tag: Tag = { id: nextTagId++, name, color: color || "#7c3aed" };
      tags.push(tag);
      return json(res, tag, 201);
    }
    if (path[0] === "tags" && path.length === 2 && method === "DELETE") {
      const id = parseInt(path[1]);
      const idx = tags.findIndex(t => t.id === id);
      if (idx === -1) return notFound(res);
      tags.splice(idx, 1);
      return json(res, { ok: true });
    }

    // ─── REPORTS ───
    if (path[0] === "reports" && path.length === 1 && method === "GET") {
      return handleListReports(res, url);
    }
    if (path[0] === "reports" && path.length === 1 && method === "POST") {
      return handleCreateReport(res, body);
    }
    if (path[0] === "reports" && path.length === 2 && method === "GET") {
      return handleGetReport(res, path[1]);
    }
    if (path[0] === "reports" && path.length === 2 && method === "DELETE") {
      return handleDeleteReport(res, path[1]);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "status" && method === "PUT") {
      return handleUpdateStatus(res, path[1], body);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "POST") {
      return handleAssign(res, path[1], body);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "assign" && method === "DELETE") {
      return handleUnassign(res, path[1]);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "comments" && method === "POST") {
      return handleAddComment(res, path[1], body);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "follow" && method === "POST") {
      return handleFollow(res, path[1], body);
    }
    if (path[0] === "reports" && path.length === 3 && path[2] === "attachments" && method === "POST") {
      return handleAddAttachment(res, path[1], body);
    }
    if (path[0] === "reports" && path.length === 4 && path[2] === "attachments" && method === "DELETE") {
      return handleDeleteAttachment(res, path[1], parseInt(path[3]));
    }

    // ─── PATCHES ───
    if (path[0] === "patches" && path.length === 1 && method === "GET") {
      return json(res, patches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    if (path[0] === "patches" && path.length === 1 && method === "POST") {
      return handleCreatePatch(res, body);
    }

    // ─── STATS ───
    if (path[0] === "stats" && method === "GET") {
      return handleStats(res);
    }

    // ─── METRICS ───
    if (path[0] === "metrics" && method === "GET") {
      return handleMetrics(res);
    }

    // ─── NOTIFICATIONS ───
    if (path[0] === "notifications" && path.length === 1 && method === "GET") {
      const username = url.searchParams.get("username") || "";
      const userNotifs = notifications
        .filter(n => n.username === username)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return json(res, userNotifs);
    }
    if (path[0] === "notifications" && path.length === 3 && path[2] === "read" && method === "PUT") {
      const nid = parseInt(path[1]);
      const n = notifications.find(n => n.id === nid);
      if (n) n.read = 1;
      return json(res, { ok: true });
    }
    if (path[0] === "notifications" && path.length === 2 && path[1] === "read-all" && method === "PUT") {
      const { username } = body as { username: string };
      notifications.forEach(n => { if (n.username === username) n.read = 1; });
      return json(res, { ok: true });
    }

    return notFound(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error del servidor";
    return json(res, { error: message }, 500);
  }
}

// ─── AUTH HANDLERS ────────────────────────────────────────────────

function handleRegister(res: VercelResponse, body: Record<string, unknown>) {
  const { name, username, password, role } = body as {
    name: string;
    username: string;
    password: string;
    role: string;
  };
  if (!name || !username || !password) {
    return json(res, { error: "Todos los campos son requeridos." }, 400);
  }
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return json(res, { error: "Ese usuario ya existe." }, 409);
  }
  const rc = ROLE_COLORS[role] || ROLE_COLORS.Tester;
  const user: User = {
    id: nextUserId++,
    name,
    username,
    password,
    role: role || "Tester",
    color: rc.color,
    bg: rc.bg,
    avatar: "",
    discordWebhook: "",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  const { password: _, ...safe } = user;
  return json(res, safe, 201);
}

function handleLogin(res: VercelResponse, body: Record<string, unknown>) {
  const { username, password } = body as { username: string; password: string };
  const user = users.find(
    u => u.username.toLowerCase() === (username || "").toLowerCase() && u.password === password
  );
  if (!user) {
    return json(res, { error: "Usuario o contraseña incorrectos." }, 401);
  }
  const { password: _, ...safe } = user;
  return json(res, safe);
}

// ─── USER HANDLERS ────────────────────────────────────────────────

function handleUpdateUser(res: VercelResponse, id: number, body: Record<string, unknown>) {
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return notFound(res);
  const user = users[idx];
  const { name, currentPassword, newPassword, avatar, discordWebhook } = body as {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
    avatar?: string;
    discordWebhook?: string;
  };

  if (currentPassword) {
    if (currentPassword !== user.password) {
      return json(res, { error: "Contraseña actual incorrecta." }, 400);
    }
    if (newPassword) user.password = newPassword;
  }
  if (name) user.name = name;
  if (avatar !== undefined) user.avatar = avatar;
  if (discordWebhook !== undefined) user.discordWebhook = discordWebhook;
  const { password: _, ...safe } = user;
  return json(res, safe);
}

// ─── REPORT HANDLERS ──────────────────────────────────────────────

function handleListReports(res: VercelResponse, url: URL) {
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
  return json(res, filtered);
}

function handleCreateReport(res: VercelResponse, body: Record<string, unknown>) {
  const { title, type, priority, description, evidence, author } = body as {
    title: string;
    type: string;
    priority: string;
    description: string;
    evidence?: string;
    author: string;
  };
  if (!title || !description || !author) {
    return json(res, { error: "Título, descripción y autor son requeridos." }, 400);
  }
  const id = generateReportId();
  const now = new Date().toISOString();
  const report: Report = {
    id,
    title,
    type: type || "Bug",
    priority: priority || "Media",
    status: "Pendiente",
    description,
    evidence: evidence || "",
    author,
    assignee: null,
    followers: [author],
    tags: [],
    comments: [],
    attachments: [],
    history: [{ user: author, action: "creó el reporte", from: "", to: "", date: now }],
    createdAt: now,
    updatedAt: now,
  };
  reports.push(report);
  addNotification("new_report", `Nuevo reporte ${id}: ${title}`, id, author);

  // Notify admin/ceo
  users.filter(u => u.role === "CEO").forEach(u => {
    addNotification("new_report", `Nuevo reporte ${id}: ${title} por ${author}`, id, u.username);
  });

  return json(res, report, 201);
}

function handleGetReport(res: VercelResponse, id: string) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  return json(res, report);
}

function handleDeleteReport(res: VercelResponse, id: string) {
  const idx = reports.findIndex(r => r.id === id);
  if (idx === -1) return notFound(res);
  reports.splice(idx, 1);
  return json(res, { ok: true });
}

function handleUpdateStatus(res: VercelResponse, id: string, body: Record<string, unknown>) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  const { status, username } = body as { status: string; username: string };
  if (!status) return json(res, { error: "Estado requerido" }, 400);
  const oldStatus = report.status;
  report.status = status;
  report.updatedAt = new Date().toISOString();
  if (username) {
    addHistory(report, username, "cambió el estado", oldStatus, status);
  }

  // Notify followers
  if (username) {
    const followers = report.followers.filter(f => f !== username);
    followers.forEach(f => {
      addNotification("status_change", `${report.id}: ${username} cambió estado a "${status}"`, id, f);
    });
    // Notify author separately if not already a follower
    if (!followers.includes(report.author) && report.author !== username) {
      addNotification("status_change", `${report.id}: ${username} cambió estado a "${status}"`, id, report.author);
    }
  }

  return json(res, report);
}

function handleAssign(res: VercelResponse, id: string, body: Record<string, unknown>) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  const { username } = body as { username: string };
  const oldAssignee = report.assignee;
  report.assignee = username;
  report.updatedAt = new Date().toISOString();
  if (username) {
    addHistory(report, username, username !== oldAssignee ? "se asignó el reporte" : "re-asignó el reporte", oldAssignee || "nadie", username);
  }
  addNotification("assigned", `Te asignaron el reporte ${id}`, id, username);
  return json(res, report);
}

function handleUnassign(res: VercelResponse, id: string) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  report.assignee = null;
  report.updatedAt = new Date().toISOString();
  return json(res, report);
}

function handleAddComment(res: VercelResponse, id: string, body: Record<string, unknown>) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  const { text, author } = body as { text: string; author: string };
  if (!text || !author) return json(res, { error: "Texto y autor requeridos" }, 400);
  if (!report.comments) report.comments = [];
  const comment: Comment = {
    id: nextCommentId++,
    text,
    author,
    createdAt: new Date().toISOString(),
  };
  report.comments.push(comment);
  report.updatedAt = new Date().toISOString();
  addHistory(report, author, "agregó un comentario");

  // Notify followers except commenter
  const followers = report.followers.filter(f => f !== author);
  followers.forEach(f => {
    addNotification("new_comment", `${author} comentó en ${id}`, id, f);
  });
  if (!followers.includes(report.author) && report.author !== author) {
    addNotification("new_comment", `${author} comentó en ${id}`, id, report.author);
  }

  return json(res, comment, 201);
}

function handleFollow(res: VercelResponse, id: string, body: Record<string, unknown>) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  const { username } = body as { username: string };
  if (!report.followers) report.followers = [];
  const idx = report.followers.indexOf(username);
  if (idx >= 0) {
    report.followers.splice(idx, 1);
  } else {
    report.followers.push(username);
  }
  return json(res, report);
}

function handleAddAttachment(res: VercelResponse, id: string, body: Record<string, unknown>) {
  const report = reports.find(r => r.id === id);
  if (!report) return notFound(res);
  const { url, name, added_by } = body as { url: string; name: string; added_by: string };
  if (!url) return json(res, { error: "URL requerida" }, 400);
  if (!report.attachments) report.attachments = [];
  const att: Attachment = {
    id: nextAttachmentId++,
    url,
    name: name || "Adjunto",
    added_by: added_by || "Desconocido",
    created_at: new Date().toISOString(),
  };
  report.attachments.push(att);
  if (added_by) addHistory(report, added_by, "agregó un adjunto");
  return json(res, att, 201);
}

function handleDeleteAttachment(res: VercelResponse, reportId: string, attId: number) {
  const report = reports.find(r => r.id === reportId);
  if (!report) return notFound(res);
  if (!report.attachments) return notFound(res);
  const idx = report.attachments.findIndex(a => a.id === attId);
  if (idx === -1) return notFound(res);
  report.attachments.splice(idx, 1);
  return json(res, { ok: true });
}

// ─── PATCH HANDLERS ───────────────────────────────────────────────

function handleCreatePatch(res: VercelResponse, body: Record<string, unknown>) {
  const { version, date, notes, bugIds } = body as {
    version: string;
    date: string;
    notes?: string;
    bugIds?: string[];
  };
  if (!version) return json(res, { error: "Versión requerida" }, 400);
  const id = generatePatchId();
  const patch: Patch = {
    id,
    version,
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes || "",
    bugIds: bugIds || [],
    createdAt: new Date().toISOString(),
  };
  patches.push(patch);

  // Mark bugs as solved
  (bugIds || []).forEach(bid => {
    const r = reports.find(r => r.id === bid);
    if (r && r.status === "Solucionado") {
      r.status = "Cerrado";
      addHistory(r, "Sistema", "cambió el estado", "Solucionado", "Cerrado");
    }
  });

  return json(res, patch, 201);
}

// ─── STATS ────────────────────────────────────────────────────────

function handleStats(res: VercelResponse) {
  const total = reports.length;
  const pending = reports.filter(r => r.status === "Pendiente").length;
  const inRevision = reports.filter(r => r.status === "En revisión").length;
  const inDev = reports.filter(r => r.status === "En desarrollo").length;
  const testing = reports.filter(r => r.status === "Esperando pruebas").length;
  const solved = reports.filter(r => r.status === "Solucionado").length;
  const critical = reports.filter(r => r.priority === "Crítica").length;

  const priorities = ["Crítica", "Alta", "Media", "Baja"];
  const prioritiesStats = priorities.map(p => ({
    priority: p,
    count: reports.filter(r => r.priority === p).length,
  }));

  const types = ["Bug", "Exploit", "Sugerencia", "Optimización", "Mejora"];
  const typesStats = types.map(t => ({
    type: t,
    count: reports.filter(r => r.type === t).length,
  }));

  return json(res, {
    total,
    pending,
    inRevision,
    inDev,
    testing,
    solved,
    critical,
    priorities: prioritiesStats,
    types: typesStats,
  });
}

// ─── METRICS ──────────────────────────────────────────────────────

function handleMetrics(res: VercelResponse) {
  const now = new Date();
  const days: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = reports.filter(r => r.createdAt.slice(0, 10) === dateStr).length;
    days.push({ date: dateStr, total: count });
  }

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const solved7 = reports.filter(
    r => r.status === "Solucionado" && r.updatedAt >= weekAgo.toISOString()
  ).length;

  const avgResolutionDays = "—";

  const statuses = ["Pendiente", "En revisión", "En desarrollo", "Esperando pruebas", "Solucionado", "Cerrado"];
  const byStatus = statuses.map(s => ({
    status: s,
    count: reports.filter(r => r.status === s).length,
  }));

  const priorityList = ["Crítica", "Alta", "Media", "Baja"];
  const byPriority = priorityList.map(p => ({
    priority: p,
    count: reports.filter(r => r.priority === p).length,
  }));

  // Dev stats
  const devMap: Record<string, { assignee: string; open: number; closed: number; total: number }> = {};
  reports.forEach(r => {
    if (!r.assignee) return;
    if (!devMap[r.assignee]) devMap[r.assignee] = { assignee: r.assignee, open: 0, closed: 0, total: 0 };
    devMap[r.assignee].total++;
    if (r.status === "Solucionado" || r.status === "Cerrado") devMap[r.assignee].closed++;
    else devMap[r.assignee].open++;
  });
  const byDev = Object.values(devMap).sort((a, b) => b.total - a.total);

  return json(res, { solved7, avgResolutionDays, days, byStatus, byPriority, byDev });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
