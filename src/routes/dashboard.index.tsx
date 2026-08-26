import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getDashboardOverviewFn } from "@/server/dashboardApi";
import type { DashboardOverview } from "@/server/operationalAnalytics";

export const Route = createFileRoute("/dashboard/")({
  loader: async () => {
    try {
      return await getDashboardOverviewFn();
    } catch {
      throw redirect({ to: "/dashboard/login" });
    }
  },
  component: DashboardHome,
});

function DashboardHome() {
  const data = Route.useLoaderData() as DashboardOverview;
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
          <tbody>{data.executions.map((execution) => <tr key={execution.id} className="border-t border-white/10"><td className="py-3 font-mono text-xs">{execution.id.slice(0, 8)}…</td><td>{execution.source}</td><td>{execution.status}{execution.trackingStatus === "degraded" ? " · rastreio degradado" : ""}</td><td>{execution.durationMs == null ? "—" : `${Math.round(execution.durationMs)} ms`}</td><td>{execution.averageRating == null ? "—" : execution.averageRating.toFixed(1)}</td><td><Link className="text-[#E5D3A2] underline" to="/dashboard/execucoes/$executionId" params={{ executionId: execution.id }}>Detalhes</Link></td></tr>)}</tbody>
        </table>
      </section>
    </>
  );
}
