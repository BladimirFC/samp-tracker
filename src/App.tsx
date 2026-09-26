import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { api, loadSession, saveSession } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KanbanPage } from "./pages/KanbanPage";
import { PatchesPage } from "./pages/PatchesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import type { Page, Report, ReportFilters, Session } from "./types";

const paths: Record<Page, string> = { dashboard: "/", reports: "/reports", kanban: "/kanban", patches: "/patches", users: "/users", settings: "/settings" };
function pageFromPath(): Page { return (Object.entries(paths).find(([, path]) => path === window.location.pathname)?.[0] as Page | undefined) || "dashboard"; }

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
  const [page, setPage] = useState<Page>(() => pageFromPath());
  const [openReport, setOpenReport] = useState<Report | null>(null);
  const [reportFilters, setReportFilters] = useState<ReportFilters>({});

  useEffect(() => { saveSession(session); }, [session]);
  useEffect(() => { const onPopState = () => setPage(pageFromPath()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  if (!session) return <AuthPage onAuthenticated={setSession} />;
  const activeSession = session;

  function navigate(next: Page) { setPage(next); if (window.location.pathname !== paths[next]) window.history.pushState({}, "", paths[next]); }
  function showReport(report: Report) { setOpenReport(report); navigate("reports"); }
  async function showReportById(id: string) { try { showReport(await api<Report>(`/reports/${id}`, activeSession.token)); } catch { navigate("reports"); } }
  function openFilteredReports(filters: ReportFilters) { setReportFilters(filters); setOpenReport(null); navigate("reports"); }
  const content = (() => {
    if (page === "dashboard") return <DashboardPage token={activeSession.token} onOpenReport={showReport} onFilterReports={openFilteredReports} />;
    if (page === "reports") return <ReportsPage token={activeSession.token} user={activeSession.user} initialReport={openReport} initialFilters={reportFilters} onInitialReportHandled={() => { setOpenReport(null); setReportFilters({}); }} />;
    if (page === "kanban") return <KanbanPage token={activeSession.token} user={activeSession.user} onOpenReport={showReport} />;
    if (page === "patches") return <PatchesPage token={activeSession.token} user={activeSession.user} />;
    if (page === "users") return <UsersPage token={activeSession.token} currentUser={activeSession.user} />;
    return <SettingsPage token={activeSession.token} />;
  })();

  return <AppShell token={activeSession.token} user={activeSession.user} page={page} onNavigate={(next) => { setOpenReport(null); setReportFilters({}); navigate(next); }} onOpenReport={showReport} onOpenReportById={(id) => void showReportById(id)} onLogout={() => setSession(null)}>{content}</AppShell>;
}
