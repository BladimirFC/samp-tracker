export type Role = "CEO" | "Developer" | "Tester";
export type ReportStatus = "Pendiente" | "En revisión" | "En desarrollo" | "Esperando pruebas" | "Solucionado" | "Cerrado";

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  color: string;
  bg: string;
  avatar?: string;
  discordWebhook?: string;
}

export interface Comment { id: number; text: string; author: string; createdAt: string }
export interface HistoryEntry { user: string; action: string; from: string; to: string; date: string }
export interface Attachment { id: number; url: string; name: string; added_by: string; created_at: string }

export interface Report {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: ReportStatus;
  description: string;
  evidence?: string;
  author: string;
  assignee: string | null;
  followers: string[];
  tags: number[];
  comments: Comment[];
  history: HistoryEntry[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Patch { id: string; version: string; date: string; notes: string; bugIds: string[]; createdAt: string }
export interface Tag { id: number; name: string; color: string }
export interface Stats { total: number; pending: number; inRevision: number; inDev: number; testing: number; solved: number; critical: number }
export interface Session { user: User; token: string }
export type Page = "dashboard" | "reports" | "kanban" | "patches" | "users" | "settings";
