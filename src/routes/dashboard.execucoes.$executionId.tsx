import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  getDashboardSpecificationEntries,
  getDashboardVisionEvaluation,
  getExecutionDetailFn,
} from "@/server/dashboardApi";
import type {
  DashboardExecutionDetail,
  ExecutionDetailLoadResult,
} from "@/server/dashboardApi";

export const Route = createFileRoute("/dashboard/execucoes/$executionId")({
  loader: async ({ params }) => {
    const result = (await getExecutionDetailFn({
      data: { executionId: params.executionId },
    })) as ExecutionDetailLoadResult;
    if (result.status === "unauthorized") {
      throw redirect({ to: "/dashboard/login" });
    }
    return result;
  },
  component: ExecutionDetailPage,
});

function ExecutionDetailPage() {
  const result = Route.useLoaderData() as Exclude<
    ExecutionDetailLoadResult,
    { status: "unauthorized" }
  >;
  if (result.status !== "ready") {
    return (
      <section className="card-soft p-6" role="alert">
        <h2 className="text-lg font-semibold text-white">
          {result.status === "not_found"
            ? "Execução não encontrada"
            : "Rastreabilidade indisponível"}
        </h2>
        <p className="text-sm text-white/65 mt-2">
          {result.status === "not_found"
            ? "O identificador informado não possui execução registrada."
            : "Não foi possível consultar o banco operacional. Tente novamente."}
        </p>
        <Link
          to="/dashboard"
          className="inline-block text-sm text-[#E5D3A2] underline mt-4"
        >
          ← Voltar
        </Link>
      </section>
    );
  }

  const detail = result.data;
  const specificationEntries = getDashboardSpecificationEntries(
    detail.specification,
  );
  return (
    <section>
      <Link to="/dashboard" className="text-sm text-[#E5D3A2] underline">
        ← Voltar
      </Link>
      <div className="card-soft p-5 mt-4 mb-5">
        <h2 className="text-xl font-semibold text-white">
          Execução {detail.id}
        </h2>
        <p className="text-sm text-white/65 mt-1">
          {detail.source} · {detail.status} · início{" "}
          {new Date(detail.startedAt).toLocaleString("pt-BR")}
        </p>
        {detail.trackingStatus === "degraded" && (
          <p className="text-sm text-amber-200 mt-2">
            O rastreio apresentou falhas; a geração principal não foi
            interrompida.
          </p>
        )}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <div className="card-soft p-5">
            <h3 className="font-semibold text-white mb-3">
              Seleção do usuário
            </h3>
            {specificationEntries.length === 0 ? (
              <p className="text-sm text-white/55">
                Nenhuma seleção foi registrada nesta execução.
              </p>
            ) : (
              <dl className="divide-y divide-white/10">
                {specificationEntries.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex justify-between gap-4 py-2 text-sm"
                  >
                    <dt className="text-white/60">{entry.label}</dt>
                    <dd className="text-white text-right break-words">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="card-soft p-5">
            <h3 className="font-semibold text-white mb-3">Etapas</h3>
            <ol className="space-y-3">
              {detail.steps.map((step) => (
                <li key={step.id} className="border-l-2 border-white/20 pl-3">
                  <p className="text-sm text-white">
                    {step.stage} · tentativa {step.attempt}
                  </p>
                  <p className="text-xs text-white/55">
                    {step.status}
                    {step.durationMs == null ? "" : ` · ${step.durationMs} ms`}
                    {step.seed == null ? "" : ` · seed ${step.seed}`}
                  </p>
                  {step.errorCode && (
                    <p className="text-xs text-red-200">{step.errorCode}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-semibold text-white mb-3">
            Artefatos e avaliações
          </h3>
          {detail.artifacts.length === 0 ? (
            <p className="text-sm text-white/55">
              Nenhum artefato foi persistido nesta execução.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {detail.artifacts.map((artifact) => (
                <DashboardArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          )}
          {detail.notifications.length > 0 && (
            <p className="text-xs text-white/65 mt-4">
              Telegram:{" "}
              {detail.notifications
                .map(
                  (notification) =>
                    `${notification.status} (${notification.attempts} tentativa${notification.attempts === 1 ? "" : "s"})`,
                )
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

const CRITERION_LABELS: Record<string, string> = {
  peca: "Tipo da peça",
  comprimento: "Comprimento",
  decote: "Decote",
  possuiManga: "Presença de manga",
  manga: "Tipo de manga",
  saia: "Modelagem da saia",
  renda: "Renda",
  frontAndBackVisible: "Vistas frontal e traseira",
  handDrawnStyle: "Desenho manual",
  blackAndWhite: "Preto e branco",
  photographicOr3d: "Fotografia ou 3D",
  adultFemale: "Figura feminina adulta",
};

function DashboardArtifactCard({
  artifact,
}: {
  artifact: DashboardExecutionDetail["artifacts"][number];
}) {
  const evaluation = getDashboardVisionEvaluation(artifact);
  const isCandidate =
    artifact.kind === "croqui_candidate" || artifact.kind === "croqui";
  const isCustomerResult =
    artifact.selected && (artifact.kind === "croqui" || artifact.kind === "realistic");
  return (
    <article className="rounded-lg border border-white/10 p-3">
      <p className="text-sm text-white">
        {artifact.kind}
        {artifact.selected
          ? " · selecionado"
          : isCandidate
            ? " · candidato"
            : ""}
      </p>
      <p className="text-xs text-white/55">
        {artifact.status} · retenção até{" "}
        {new Date(artifact.retentionUntil).toLocaleDateString("pt-BR")}
      </p>
      {isCustomerResult && artifact.rating == null ? (
        <p className="text-xs text-white/55 mt-1">
          Avaliação do cliente: não enviada
        </p>
      ) : isCustomerResult ? (
        <p className="text-xs text-white/75 mt-1">
          Avaliação do cliente: {artifact.rating}/5
        </p>
      ) : null}
      {isCandidate && evaluation.technicalScore != null && (
        <p className="text-xs text-white/75 mt-1">
          Nota técnica do croqui: {evaluation.technicalScore.toFixed(2)}/5
        </p>
      )}
      {isCandidate && evaluation.rank != null && (
        <p className="text-xs text-white/55">
          Classificação: {evaluation.rank}º
        </p>
      )}
      {isCandidate && evaluation.eligible !== null && (
        <p
          className={`text-xs mt-1 ${evaluation.eligible ? "text-emerald-200" : "text-red-200"}`}
        >
          {evaluation.eligible ? "Elegível" : "Desclassificado"}
        </p>
      )}
      {typeof artifact.metadata.seed === "number" && (
        <p className="text-xs text-white/55">Seed: {artifact.metadata.seed}</p>
      )}
      {evaluation.disqualifiers.length > 0 && (
        <p className="text-xs text-red-200 mt-1">
          Motivos: {evaluation.disqualifiers.join(", ")}
        </p>
      )}
      {evaluation.qualityWarnings.length > 0 && (
        <p className="text-xs text-amber-100/80 mt-1">
          Alertas de fidelidade: {evaluation.qualityWarnings.join(", ")}
        </p>
      )}
      {evaluation.legacy ? (
        <p className="text-xs text-amber-100/80 mt-2">
          Análise Vision detalhada não foi registrada nesta versão.
        </p>
      ) : (
        Object.keys(evaluation.criteria).length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[#E5D3A2]">
              Análise Vision
            </summary>
            <dl className="mt-2 space-y-2">
              {Object.entries(evaluation.criteria).map(([key, criterion]) => (
                <div key={key} className="rounded border border-white/10 p-2">
                  <dt className="text-xs text-white/80">
                    {CRITERION_LABELS[key] || key}
                  </dt>
                  <dd className="text-xs text-white/60">
                    Esperado: {formatVisionValue(criterion.expected)} ·
                    Observado: {formatVisionValue(criterion.observed)}
                  </dd>
                  <dd className="text-xs text-white/60">
                    {criterion.matched ? "Compatível" : "Não compatível"} ·
                    confiança {Math.round(criterion.confidence * 100)}%
                  </dd>
                  {criterion.evidence && (
                    <dd className="text-xs text-white/50">
                      Evidência: {criterion.evidence}
                    </dd>
                  )}
                </div>
              ))}
              {getAdditionalVisionEntries(evaluation.visionAnalysis).map(
                (entry) => (
                  <div
                    key={entry.key}
                    className="rounded border border-white/10 p-2"
                  >
                    <dt className="text-xs text-white/80">{entry.label}</dt>
                    <dd className="text-xs text-white/60">
                      Observado: {formatVisionValue(entry.value)} · confiança{" "}
                      {Math.round(entry.confidence * 100)}%
                    </dd>
                    {entry.evidence && (
                      <dd className="text-xs text-white/50">
                        Evidência: {entry.evidence}
                      </dd>
                    )}
                  </div>
                ),
              )}
            </dl>
          </details>
        )
      )}
      {artifact.signedUrl ? (
        <>
          <img
            className="mt-3 rounded-md max-h-56 w-full object-contain bg-black/20"
            src={artifact.signedUrl}
            alt={`Artefato ${artifact.kind}`}
          />
          <a
            className="inline-block mt-2 text-xs text-[#E5D3A2] underline break-all"
            href={artifact.signedUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir URL assinada da imagem
          </a>
        </>
      ) : (
        <p className="text-xs text-amber-200 mt-2">
          URL indisponível: o arquivo não está disponível no Storage privado.
        </p>
      )}
    </article>
  );
}

function formatVisionValue(value: string | boolean | null): string {
  if (value === null) return "não identificado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return value;
}

function getAdditionalVisionEntries(
  analysis: Record<string, unknown> | null,
): Array<{
  key: string;
  label: string;
  value: string | boolean | null;
  confidence: number;
  evidence: string | null;
}> {
  if (!analysis) return [];
  const details =
    analysis.detalhesTecnicos &&
    typeof analysis.detalhesTecnicos === "object" &&
    !Array.isArray(analysis.detalhesTecnicos)
      ? (analysis.detalhesTecnicos as Record<string, unknown>)
      : {};
  return Object.entries(details).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const observation = value as Record<string, unknown>;
    if (typeof observation.confidence !== "number") return [];
    return [
      {
        key: `detail-${key}`,
        label: `Detalhe técnico: ${key}`,
        value:
          ["string", "boolean"].includes(typeof observation.value) ||
          observation.value === null
            ? (observation.value as string | boolean | null)
            : null,
        confidence: observation.confidence,
        evidence:
          typeof observation.evidence === "string"
            ? observation.evidence
            : null,
      },
    ];
  });
}
