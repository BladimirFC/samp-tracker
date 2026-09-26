import { Bug, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Session, User } from "../types";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const username = String(fields.get("username") || "").trim();
    const password = String(fields.get("password") || "");
    try {
      if (mode === "register") {
        const name = String(fields.get("name") || "").trim();
        await api<User>("/register", undefined, { method: "POST", body: { name, username, password } });
        setMode("login");
        return;
      }
      onAuthenticated(await api<Session>("/login", undefined, { method: "POST", body: { username, password } }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-hero">
        <img className="auth-logo" src="/logo.png" alt="Legacy Roleplay" />
        <p className="eyebrow">Development control center</p>
        <h1>Los problemas claros se convierten en <em>mejores versiones.</em></h1>
        <p>Centralizá reportes, responsables y entregas del servidor en un solo lugar.</p>
        <div className="auth-benefits"><span><Bug size={17} /> Seguimiento preciso</span><span><CheckCircle2 size={17} /> Flujo verificable</span><span><ShieldCheck size={17} /> Roles definidos</span></div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Acceso al tracker</p>
          <h2>{mode === "login" ? "Bienvenido de vuelta" : "Crear una cuenta"}</h2>
          <p className="muted">{mode === "login" ? "Ingresá para continuar con tu equipo." : "Tu cuenta comenzará con el rol Tester."}</p>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          {mode === "register" ? <label>Nombre visible<input name="name" autoComplete="name" required /></label> : null}
          <label>Usuario<input name="username" autoComplete="username" required /></label>
          <label>Contraseña<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required /></label>
          <button className="button button-primary" disabled={busy}>{busy ? "Procesando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}</button>
          <button className="button button-discord" type="button" onClick={() => { window.location.href = "/api/auth/discord"; }}>Continuar con Discord</button>
          <button className="text-button" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "¿No tenés cuenta? Registrate" : "Ya tengo una cuenta"}</button>
        </form>
      </section>
    </main>
  );
}
