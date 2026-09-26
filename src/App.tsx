import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { loadSession, saveSession } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KanbanPage } from "./pages/KanbanPage";
import { PatchesPage } from "./pages/PatchesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import type { Page, Report, Session } from "./types";

function readDiscordSession(): Session | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const user = params.get("user");
  if (!token || !user) return null;
  try {
    const session = { token, user: JSON.parse(user) } as Session;
    window.history.replaceState({}, document.title, window.location.pathname);
    return session;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readDiscordSession() || loadSession());
  const [page, setPage] = useState<Page>("dashboard");
  const [openReport, setOpenReport] = useState<Report | null>(null);

  useEffect(() => { saveSession(session); }, [session]);
  if (!session) return <AuthPage onAuthenticated={setSession} />;

  function showReport(report: Report) { setOpenReport(report); setPage("reports"); }
  const content = (() => {
    if (page === "dashboard") return <DashboardPage token={session.token} onOpenReport={showReport} />;
    if (page === "reports") return <ReportsPage token={session.token} user={session.user} initialReport={openReport} onInitialReportHandled={() => setOpenReport(null)} />;
    if (page === "kanban") return <KanbanPage token={session.token} onOpenReport={showReport} />;
    if (page === "patches") return <PatchesPage token={session.token} user={session.user} />;
    if (page === "users") return <UsersPage token={session.token} currentUser={session.user} />;
    return <SettingsPage token={session.token} />;
  })();

  return <AppShell user={session.user} page={page} onNavigate={(next) => { setOpenReport(null); setPage(next); }} onLogout={() => setSession(null)}>{content}</AppShell>;
}
