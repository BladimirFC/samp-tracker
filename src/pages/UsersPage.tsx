import { useMemo } from "react";
import { useData } from "../hooks/useData";
import { api } from "../lib/api";
import type { Role, User } from "../types";
import { PageError, PageLoading } from "./DashboardPage";

const roles: Role[] = ["CEO", "Developer", "Tester"];

export function UsersPage({ token, currentUser }: { token: string; currentUser: User }) {
  const loader = useMemo(() => () => api<User[]>("/users", token), [token]);
  const { data, loading, error, reload, setData } = useData(loader, [loader]);
  async function changeRole(user: User, role: Role) { const updated = await api<User>(`/users/${user.id}`, token, { method: "PUT", body: { role } }); setData((data || []).map((item) => item.id === user.id ? updated : item)); }
  if (loading) return <PageLoading />;
  if (error || !data) return <PageError message={error} retry={reload} />;
  return <><div className="page-heading"><div><p className="eyebrow">Personas y permisos</p><h1>Usuarios</h1></div></div><div className="user-grid">{data.map((user) => <article className="user-card" key={user.id}><div className="avatar avatar-large">{user.avatar ? <img src={user.avatar} alt="" /> : user.name.slice(0, 1).toUpperCase()}</div><h2>{user.name}</h2><span>@{user.username}</span>{currentUser.role === "CEO" && user.id !== currentUser.id ? <select value={user.role} onChange={(event) => void changeRole(user, event.target.value as Role)} aria-label={`Rol de ${user.name}`}>{roles.map((role) => <option key={role}>{role}</option>)}</select> : <strong>{user.role}</strong>}</article>)}</div></>;
}
