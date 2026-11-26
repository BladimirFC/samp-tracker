import { ArrowLeft, Download, ExternalLink, Monitor, RefreshCw, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface ReleaseAsset { name: string; url: string; size: number }
interface LauncherRelease {
  version: string;
  publishedAt: string | null;
  notes: string;
  releaseUrl: string;
  installer: ReleaseAsset;
  portable: ReleaseAsset | null;
}

function formatSize(bytes: number) {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(bytes / 1_000_000) + " MB";
}

function formatDate(date: string | null) {
  if (!date || !Number.isFinite(Date.parse(date))) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(date));
}

function ReleaseNotes({ notes, releaseUrl }: { notes: string; releaseUrl: string }) {
  const lines = notes.split(/\r?\n/).map(line => line.trim()).filter(line => line && !/^\*\*Full Changelog\*\*:/i.test(line));
  return <section className="launcher-release-notes" aria-labelledby="release-notes-heading">
    <h3 id="release-notes-heading">¿Qué hay de nuevo?</h3>
    {lines.length ? <ul>{lines.map((line, index) => <li key={index}>{line.replace(/^[-*]\s+|^\d+\.\s+/, "").replace(/^#{1,6}\s+/, "")}</li>)}</ul> : <p className="muted">Las novedades de esta versión todavía no se han publicado. Consulta la <a href={releaseUrl} target="_blank" rel="noopener noreferrer">publicación oficial</a>.</p>}
  </section>;
}

export function LauncherPage() {
  const [release, setRelease] = useState<LauncherRelease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRelease(null);
    api<LauncherRelease>("/launcher/latest", undefined, { signal: controller.signal, cache: "no-store" })
      .then(data => { if (!controller.signal.aborted) setRelease(data); })
      .catch(() => { if (!controller.signal.aborted) setError("No se pudo consultar la última versión. Vuelve a intentarlo."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="launcher-download-page">
      <header className="launcher-download-header">
        <div className="launcher-download-brand"><img src="/logo.png" alt="" /><strong>Legacy Roleplay</strong></div>
        <a className="button button-inline" href="/"><ArrowLeft size={16} /> Volver al tracker</a>
      </header>
      <section className="launcher-download-layout">
        <div className="launcher-intro">
          <span className="launcher-test-label"><FlaskConical size={15} /> TESTER EDITION</span>
          <p className="eyebrow">Programa de pruebas</p>
          <h1>Legacy<br /><em>Launcher.</em></h1>
          <p className="launcher-lead">Descarga el cliente oficial de Legacy Roleplay para Windows. Prueba las nuevas versiones y reporta los errores desde el tracker.</p>
          <div className="launcher-requirements"><Monitor size={19} /><div><strong>Windows 10 / 11 · 64 bits</strong><span>Requiere una instalación compatible de GTA San Andreas y SA-MP.</span></div></div>
          <p className="muted launcher-test-warning">Versión de pruebas: puede contener errores. El launcher conserva tus ajustes y comprueba nuevas actualizaciones al iniciar.</p>
        </div>
        <article className="launcher-release-card" aria-busy={loading}>
          <p className="eyebrow">Última versión publicada</p>
          {loading ? <p role="status" className="muted">Consultando GitHub Releases…</p> : error || !release ? <div role="alert"><p className="form-error">{error || "No hay una versión disponible."}</p><button className="button button-inline" type="button" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16} /> Reintentar</button></div> : <>
            <h2>v{release.version}</h2>
            <p className="muted">Publicada el {formatDate(release.publishedAt)}</p>
            <a className="button button-primary launcher-download-button" href={release.installer.url}><Download size={20} /><span><strong>Descargar para Windows</strong><small>Instalador recomendado · {formatSize(release.installer.size)}</small></span></a>
            <p className="muted launcher-install-note">Instala una sola vez. Las próximas versiones se descargarán desde el launcher y se aplicarán tras confirmar el reinicio.</p>
            {release.portable && <a className="launcher-secondary-link" href={release.portable.url}>Versión ZIP · {formatSize(release.portable.size)}</a>}
            <ReleaseNotes notes={release.notes} releaseUrl={release.releaseUrl} />
            <a className="launcher-secondary-link" href={release.releaseUrl} target="_blank" rel="noopener noreferrer">Ver publicación oficial <ExternalLink size={14} /></a>
            <button className="text-button launcher-refresh" type="button" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={14} /> Comprobar versión</button>
          </>}
          <p className="launcher-security-note">El instalador aún no dispone de firma digital de Windows. Descárgalo únicamente desde esta fuente oficial.</p>
        </article>
      </section>
      <footer className="launcher-download-footer">Legacy Roleplay · Canal de pruebas</footer>
    </main>
  );
}
