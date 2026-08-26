import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getExecutionDetailFn } from "@/server/dashboardApi";
import type { ExecutionDetailLoadResult } from "@/server/dashboardApi";

export const Route = createFileRoute("/dashboard/execucoes/$executionId")({
  loader: async ({ params }) => {
    const result = await getExecutionDetailFn({ data: { executionId: params.executionId } }) as ExecutionDetailLoadResult;
    if (result.status === "unauthorized") {
      throw redirect({ to: "/dashboard/login" });
    }
    return result;
  },
  component: ExecutionDetailPage,
});

function ExecutionDetailPage() {
  const result = Route.useLoaderData() as Exclude<ExecutionDetailLoadResult, { status: "unauthorized" }>;
  if (result.status !== "ready") {
    return (
      <section className="card-soft p-6" role="alert">
        <h2 className="text-lg font-semibold text-white">{result.status === "not_found" ? "Execução não encontrada" : "Rastreabilidade indisponível"}</h2>
        <p className="text-sm text-white/65 mt-2">{result.status === "not_found" ? "O identificador informado não possui execução registrada." : "Não foi possível consultar o banco operacional. Tente novamente."}</p>
        <Link to="/dashboard" className="inline-block text-sm text-[#E5D3A2] underline mt-4">← Voltar</Link>
      </section>
    );
  }

  const detail = result.data;
  return (
    <section>
      <Link to="/dashboard" className="text-sm text-[#E5D3A2] underline">← Voltar</Link>
      <div className="card-soft p-5 mt-4 mb-5">
        <h2 className="text-xl font-semibold text-white">Execução {detail.id}</h2>
        <p className="text-sm text-white/65 mt-1">{detail.source} · {detail.status} · início {new Date(detail.startedAt).toLocaleString("pt-BR")}</p>
        {detail.trackingStatus === "degraded" && <p className="text-sm text-amber-200 mt-2">O rastreio apresentou falhas; a geração principal não foi interrompida.</p>}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5"><h3 className="font-semibold text-white mb-3">Etapas</h3><ol className="space-y-3">{detail.steps.map((step) => <li key={step.id} className="border-l-2 border-white/20 pl-3"><p className="text-sm text-white">{step.stage} · tentativa {step.attempt}</p><p className="text-xs text-white/55">{step.status}{step.durationMs == null ? "" : ` · ${step.durationMs} ms`}{step.seed == null ? "" : ` · seed ${step.seed}`}</p>{step.errorCode && <p className="text-xs text-red-200">{step.errorCode}</p>}</li>)}</ol></div>
        <div className="card-soft p-5"><h3 className="font-semibold text-white mb-3">Artefatos e avaliações</h3><div className="grid sm:grid-cols-2 gap-3">{detail.artifacts.map((artifact) => <article key={artifact.id} className="rounded-lg border border-white/10 p-3"><p className="text-sm text-white">{artifact.kind}{artifact.selected ? " · aprovado" : ""}</p><p className="text-xs text-white/55">{artifact.status} · retenção até {new Date(artifact.retentionUntil).toLocaleDateString("pt-BR")}</p><p className="text-xs text-white/75 mt-1">Nota: {artifact.rating == null ? "não avaliado" : `${artifact.rating}/5`}</p>{typeof artifact.metadata.score === "number" && <p className="text-xs text-white/55">Score Vision: {artifact.metadata.score}</p>}{Array.isArray(artifact.metadata.rejectionReasons) && artifact.metadata.rejectionReasons.length > 0 && <p className="text-xs text-red-200 mt-1">Reprovação: {artifact.metadata.rejectionReasons.join(", ")}</p>}{artifact.signedUrl && <img className="mt-3 rounded-md max-h-56 w-full object-contain bg-black/20" src={artifact.signedUrl} alt={`Artefato ${artifact.kind}`} />}</article>)}</div>{detail.notifications.length > 0 && <p className="text-xs text-white/65 mt-4">Telegram: {detail.notifications.map((notification) => `${notification.status} (${notification.attempts} tentativa${notification.attempts === 1 ? "" : "s"})`).join(" · ")}</p>}</div>
      </div>
    </section>
  );
}
