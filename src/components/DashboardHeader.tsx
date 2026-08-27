import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signOutAdminFn } from "@/server/dashboardAuth";

export function DashboardHeader() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      await signOutAdminFn();
      await navigate({ to: "/dashboard/login" });
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-white/60">C&N Tecidos</p>
        <h1 className="text-2xl sm:text-3xl leading-tight font-bold text-white">Dashboard operacional</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/" className="shrink-0 text-sm text-white/70 hover:text-white">Voltar ao gerador</Link>
        <button type="button" onClick={signOut} disabled={signingOut} className="shrink-0 text-sm text-white/70 hover:text-white disabled:opacity-50">
          {signingOut ? "Saindo…" : "Sair"}
        </button>
        {error && <p className="basis-full text-xs text-red-300" role="alert">{error}</p>}
      </div>
    </header>
  );
}
