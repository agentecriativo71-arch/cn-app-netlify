import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { signInAdminFn } from "@/server/dashboardAuth";

export const Route = createFileRoute("/dashboard/login")({ component: DashboardLogin });

function DashboardLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInAdminFn({ data: { email, password } });
      await navigate({ to: "/dashboard" });
    } catch {
      setError("Não foi possível autenticar este usuário administrativo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-md mx-auto card-soft p-6">
      <h2 className="text-xl font-semibold text-white mb-1">Acesso restrito</h2>
      <p className="text-sm text-white/65 mb-6">Entre com uma conta administrativa.</p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm text-white/80">E-mail<input className="w-full mt-1 rounded-lg p-3 text-black" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="block text-sm text-white/80">Senha<input className="w-full mt-1 rounded-lg p-3 text-black" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}</button>
      </form>
    </section>
  );
}
