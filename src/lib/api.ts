import type { Session } from "../types";

const API_BASE = "/api";
const SESSION_KEY = "legacy-roleplay-session-v2";

export function loadSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T>(path: string, token?: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? data.error : undefined;
    throw new Error(message || "No se pudo completar la solicitud.");
  }
  return data as T;
}
