import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getDashboardOverviewFn } from "@/server/dashboardApi";
import type { DashboardOverviewLoadResult } from "@/server/dashboardApi";

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    const result = await getDashboardOverviewFn() as DashboardOverviewLoadResult;
    if (result.status === "unauthorized") {
      throw redirect({ to: "/dashboard/login" });
    }
    return result;
  },
  component: DashboardHome,
});

function DashboardHome() {
  const result = Route.useLoaderData() as Exclude<DashboardOverviewLoadResult, { status: "unauthorized" }>;
  if (result.status === "unavailable") {
    return (
      <section className="card-soft p-6" role="alert">
        <h2 className="text-lg font-semibold text-white">Rastreabilidade indisponível</h2>
        <p className="text-sm text-white/65 mt-2">Não foi possível consultar o banco operacional. Verifique `ANALYTICS_DATABASE_URL` e tente novamente.</p>
      </section>
    );
  }

  const data = result.data;
  const cards = [
    ["Execuções", data.totalExecutions],
    ["Concluídas", data.completedExecutions],
    ["Falhas", data.failedExecutions],
    ["Notas", data.averageRating == null ? "—" : data.averageRating.toFixed(2)],
    ["Críticas (1–2)", data.lowRatingCount],
  ];
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {cards.map(([label, value]) => <div className="card-soft p-4" key={label}><p className="text-xs text-white/60">{label}</p><p className="text-2xl font-bold text-white mt-1">{value}</p></div>)}
      </div>
      <section className="card-soft p-4 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Execuções recentes</h2>
        <table className="w-full text-sm text-left text-white/85">
          <thead className="text-white/55"><tr><th className="py-2">Execução</th><th>Origem</th><th>Estado</th><th>Duração</th><th>Nota</th><th /></tr></thead>
          <tbody>
            {data.executions.length === 0 ? (
              <tr className="border-t border-white/10"><td className="py-6 text-center text-white/55" colSpan={6}>Nenhuma execução registrada. Novas gerações aparecerão aqui.</td></tr>
            ) : data.executions.map((execution) => <tr key={execution.id} className="border-t border-white/10"><td className="py-3 font-mono text-xs">{execution.id.slice(0, 8)}…</td><td>{execution.source}</td><td>{execution.status}{execution.trackingStatus === "degraded" ? " · rastreio degradado" : ""}</td><td>{execution.durationMs == null ? "—" : `${Math.round(execution.durationMs)} ms`}</td><td>{execution.averageRating == null ? "—" : execution.averageRating.toFixed(1)}</td><td><Link className="text-[#E5D3A2] underline" to="/dashboard/execucoes/$executionId" params={{ executionId: execution.id }}>Detalhes</Link></td></tr>)}
          </tbody>
        </table>
      </section>
    </>
  );
}
