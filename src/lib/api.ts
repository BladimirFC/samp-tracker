import type { Session } from "../types";

const API_BASE = "/api";
const SESSION_KEY = "legacy-roleplay-session-v2";

export function loadSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as Session;
    return typeof session?.token === "string" && session.token.length > 0 && !!session.user && Number.isInteger(session.user.id) ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* Keep the active session in memory if browser storage is unavailable. */ }
}

export const SESSION_EXPIRED_EVENT = "legacy:session-expired";
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
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
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: token }));
    }
    throw new ApiError(message || "No se pudo completar la solicitud.", response.status);
  }
  return data as T;
}
