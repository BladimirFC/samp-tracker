import { BarChart3, Bug, Kanban, LogOut, Menu, PackageCheck, Settings, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Page, User } from "../types";

const navigation: Array<{ id: Page; label: string; icon: typeof BarChart3; admin?: boolean }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "reports", label: "Reportes", icon: Bug },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "patches", label: "Parches", icon: PackageCheck },
  { id: "users", label: "Usuarios", icon: Users, admin: true },
  { id: "settings", label: "Ajustes", icon: Settings, admin: true },
];

interface AppShellProps {
  user: User;
  page: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ user, page, onNavigate, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => !item.admin || user.role === "CEO");
  const navigate = (next: Page) => { onNavigate(next); setMobileOpen(false); };

  return (
    <div className="app-shell">
      {mobileOpen ? <button className="sidebar-scrim" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><img src="/logo.png" alt="" /><div><strong>Legacy Roleplay</strong><span>Dev tracker</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
        <nav aria-label="Navegación principal">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={page === item.id ? "nav-active" : ""} type="button" onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.name.slice(0, 1).toUpperCase()}</div>
          <div><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="icon-button" type="button" onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button><div><span>App / </span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div></header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
