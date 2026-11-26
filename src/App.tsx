import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { api, loadSession, saveSession, SESSION_EXPIRED_EVENT } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { LauncherPage } from "./pages/LauncherPage";
import { DashboardPage, PageError, PageLoading } from "./pages/DashboardPage";
import { KanbanPage } from "./pages/KanbanPage";
import { PatchesPage } from "./pages/PatchesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import type { Page, Report, ReportFilters, Session, User } from "./types";

const paths: Record<Page, string> = { dashboard: "/", reports: "/reports", kanban: "/kanban", patches: "/patches", users: "/users", settings: "/settings" };
function pageFromPath(): Page { return (Object.entries(paths).find(([, path]) => path === window.location.pathname)?.[0] as Page | undefined) || "dashboard"; }

function readDiscordSession(): Session | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const user = params.get("user");
  if (!token || !user) return null;
  try {
    const session = { token, user: JSON.parse(user) } as Session;
    if (!session.user || !Number.isInteger(session.user.id)) return null;
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
  const [verifiedToken, setVerifiedToken] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [retry, setRetry] = useState(0);
  const token = session?.token;
  const isLauncher = window.location.pathname.replace(/\/$/, "") === "/launcher";

  useEffect(() => { saveSession(session); }, [session]);
  useEffect(() => { const onPopState = () => setPage(pageFromPath()); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);
  useEffect(() => {
    const expire = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== token) return;
      setSessionNotice("Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.");
      setSession(current => current?.token === token ? null : current);
      setVerifiedToken("");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, [token]);
  useEffect(() => {
    if (!token || isLauncher) return;
    const controller = new AbortController();
    setVerificationError("");
    setVerifiedToken("");
    api<User>("/auth/session", token, { signal: controller.signal, cache: "no-store" })
      .then(user => {
        if (controller.signal.aborted) return;
        setSession(current => current?.token === token ? { token, user } : current);
        setVerifiedToken(token);
      })
      .catch(error => {
        if (!controller.signal.aborted) setVerificationError(error instanceof Error ? error.message : "No se pudo comprobar la sesión.");
      });
    return () => controller.abort();
  }, [token, isLauncher, retry]);
  if (isLauncher) return <LauncherPage />;
  if (!session) return <AuthPage notice={sessionNotice} onAuthenticated={next => { setSessionNotice(""); setSession(next); }} />;
  if (verifiedToken !== token) return verificationError
    ? <PageError message={verificationError} retry={() => { setVerificationError(""); setRetry(n => n + 1); }} />
    : <PageLoading />;
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
