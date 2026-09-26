import { BarChart3, Bug, Command, Kanban, LogOut, Menu, PackageCheck, Search, Settings, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Page, Report, User } from "../types";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationCenter } from "./NotificationCenter";

const navigation: Array<{ id: Page; label: string; icon: typeof BarChart3; admin?: boolean }> = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "reports", label: "Reportes", icon: Bug },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "patches", label: "Parches", icon: PackageCheck },
  { id: "users", label: "Usuarios", icon: Users, admin: true },
  { id: "settings", label: "Ajustes", icon: Settings, admin: true },
];

interface AppShellProps {
  token: string;
  user: User;
  page: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onOpenReport: (report: Report) => void;
  onOpenReportById: (id: string) => void;
  children: ReactNode;
}

export function AppShell({ token, user, page, onNavigate, onLogout, onOpenReport, onOpenReportById, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => !item.admin || user.role === "CEO");
  const navigate = (next: Page) => { onNavigate(next); setMobileOpen(false); };
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); } if (event.key === "Escape") setSearchOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);

  return (
    <div className="app-shell">
      {mobileOpen ? <button className="sidebar-scrim" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} /> : null}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><img src="/logo.png" alt="" /></div><div><strong>Legacy Roleplay</strong><span>Operations hub</span></div><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={18} /></button></div>
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
        <header className="topbar"><div className="topbar-path"><button className="mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button><div><span>Workspace / </span><strong>{navigation.find((item) => item.id === page)?.label}</strong></div></div><div className="topbar-actions"><button className="global-search-trigger" type="button" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Buscar en el tracker</span><kbd><Command size={12}/> K</kbd></button><NotificationCenter token={token} user={user} onOpenReport={onOpenReportById}/></div></header>
        <div className="page-content">{children}</div>
      </main>
      <GlobalSearch token={token} open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={onNavigate} onOpenReport={onOpenReport}/>
    </div>
  );
}
