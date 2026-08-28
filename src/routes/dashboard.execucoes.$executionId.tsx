import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  getDashboardSpecificationEntries,
  getDashboardGenerationSummary,
  getDashboardProviderCall,
  getDashboardStepPresentation,
  getDashboardStepDiagnostic,
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
  const generationSummary = getDashboardGenerationSummary(detail.steps);
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
        {detail.errorCode && (
          <p className="text-sm text-red-200 mt-2">
            Código da execução: {detail.errorCode}
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
            {generationSummary && (
              <p className="text-xs text-white/65 mb-3">
                Croquis: {formatCount(generationSummary.generatedCandidateCount)}
                /{formatCount(generationSummary.plannedCandidateCount)} gerados ·{" "}
                {formatCount(generationSummary.evaluatedCandidateCount)} avaliados ·{" "}
                {formatCount(generationSummary.eligibleCandidateCount)} elegíveis
              </p>
            )}
            <ol className="space-y-3">
              {detail.steps.map((step) => {
                const presentation = getDashboardStepPresentation(step);
                const providerCall = getDashboardProviderCall(step);
                const diagnostic = getDashboardStepDiagnostic(step);
                return (
                <li key={step.id} className="border-l-2 border-white/20 pl-3">
                  <p className="text-sm text-white">
                    {presentation.label} · tentativa {step.attempt}
                  </p>
                  <p className="text-xs text-white/55">
                    {presentation.statusLabel}
                    {step.durationMs == null ? "" : ` · ${formatDuration(step.durationMs)}`}
                    {step.seed == null ? "" : ` · seed ${step.seed}`}
                    {step.provider ? ` · ${step.provider}` : ""}
                    {step.model ? ` · ${step.model}` : ""}
                  </p>
                  <p className="text-xs text-white/45 mt-1">
                    {presentation.description}
                  </p>
                  {providerCall && (
                    <details className="mt-2 rounded border border-[#E5D3A2]/20 bg-black/10 p-2">
                      <summary className="cursor-pointer text-xs text-[#E5D3A2]">
                        Chamada de API
                        {providerCall.operation ? ` · ${providerCall.operation}` : ""}
                      </summary>
                      <dl className="mt-2 space-y-1 text-xs text-white/65">
                        {providerCall.phase && (
                          <div><dt className="inline text-white/45">Fase: </dt><dd className="inline">{providerCall.phase}</dd></div>
                        )}
                        {providerCall.operation && (
                          <div><dt className="inline text-white/45">Operação: </dt><dd className="inline break-all">{providerCall.operation}</dd></div>
                        )}
                        {providerCall.referenceCount != null && (
                          <div><dt className="inline text-white/45">Referências enviadas: </dt><dd className="inline">{providerCall.referenceCount}</dd></div>
                        )}
                        {providerCall.templateVersion && (
                          <div><dt className="inline text-white/45">Versão do template: </dt><dd className="inline">{providerCall.templateVersion}</dd></div>
                        )}
                        {providerCall.templateChars != null && (
                          <div><dt className="inline text-white/45">Tamanho do prompt: </dt><dd className="inline">{providerCall.templateChars} caracteres (conteúdo não persistido)</dd></div>
                        )}
                      </dl>
                      {providerCall.references.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-white/80">Referências enviadas ao provedor</p>
                          <ol className="mt-1 space-y-1">
                            {providerCall.references.map((reference) => (
                              <li key={`${reference.position}-${reference.referenceDigest || reference.role}`} className="flex gap-2 rounded border border-white/10 p-2 text-xs text-white/60">
                                {reference.imageUrl ? (
                                  <a
                                    href={reference.imageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Abrir referência em tamanho maior"
                                  >
                                    <img
                                      src={reference.imageUrl}
                                      alt={`Referência ${referenceRoleLabel(reference.role)}`}
                                      className="h-16 w-16 shrink-0 rounded object-cover bg-black/20"
                                    />
                                  </a>
                                ) : (
                                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-black/20 px-1 text-center text-[10px] text-white/35">
                                    Miniatura não retida
                                  </div>
                                )}
                                <div>
                                  <span className="text-white/80">{reference.position}. {referenceRoleLabel(reference.role)}</span>
                                  {reference.selectedValue ? ` — ${reference.selectedValue}` : ""}
                                  {reference.assetName ? ` (${reference.assetName})` : ""}
                                  <span className="block text-white/40">
                                    {referenceSourceLabel(reference.source)} · {referenceTransportLabel(reference.transport)}
                                  </span>
                                  {referenceLocationLabel(reference) ? (
                                    <span className="block break-all text-white/40">
                                      {referenceLocationLabel(reference)}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {Object.keys(providerCall.requestSummary).length > 0 && (
                        <p className="mt-2 text-xs text-white/50">
                          Parâmetros: {formatSummary(providerCall.requestSummary)}
                        </p>
                      )}
                      {Object.keys(providerCall.responseSummary).length > 0 && (
                        <p className="mt-2 text-xs text-white/50">
                          Resposta registrada: {formatSummary(providerCall.responseSummary)}
                        </p>
                      )}
                    </details>
                  )}
                  {diagnostic && (
                      <div className="mt-1 rounded border border-red-200/20 bg-red-950/20 p-2 text-xs">
                        <p className="text-red-100">{diagnostic.message}</p>
                        <p className="text-red-100/70 mt-1">
                          Código: {diagnostic.code}
                          {diagnostic.httpStatus == null
                            ? ""
                            : ` · HTTP ${diagnostic.httpStatus}`}
                          {diagnostic.providerField == null
                            ? ""
                            : ` · campo ${diagnostic.providerField}`}
                        </p>
                        {diagnostic.referenceRole && (
                          <p className="text-red-100/70 mt-1">
                            Referência: {diagnostic.referenceRole}
                            {diagnostic.referenceValue
                              ? ` — ${diagnostic.referenceValue}`
                              : ""}
                            {diagnostic.assetName
                              ? ` (${diagnostic.assetName})`
                              : ""}
                          </p>
                        )}
                        {diagnostic.referenceSummary.length > 0 && (
                          <p className="text-red-100/70 mt-1">
                            Referências enviadas: {diagnostic.referenceSummary
                              .map((reference) =>
                                `${reference.role}${reference.assetName ? ` (${reference.assetName})` : ""}`,
                              )
                              .join(", ")}
                          </p>
                        )}
                        {diagnostic.retryable !== null && (
                          <p className="text-red-100/70 mt-1">
                            {diagnostic.retryable
                              ? "Falha repetível"
                              : "Falha não repetível"}
                            {diagnostic.providerAttempt == null
                              ? ""
                              : ` · tentativa do provedor ${diagnostic.providerAttempt}`}
                          </p>
                        )}
                      </div>
                  )}
                  <details className="mt-2 text-[11px] text-white/35">
                    <summary className="cursor-pointer">Código técnico</summary>
                    <p className="mt-1 break-all">{presentation.technicalCode}</p>
                  </details>
                </li>
                );
              })}
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
        <>
          {Object.keys(evaluation.criteria).length > 0 && (
            <details className="mt-3" open>
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
          )}
          {evaluation.focus.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs text-[#E5D3A2]">
                Foco das imagens Vision
              </summary>
              <dl className="mt-2 space-y-2">
                {evaluation.focus.map((focus, index) => (
                  <div
                    key={`${focus.role}-${index}`}
                    className="rounded border border-white/10 p-2"
                  >
                    <dt className="text-xs text-white/80">
                      {focus.role} · {focus.status} · {focus.candidateCount} candidato(s)
                    </dt>
                    <dd className="text-xs text-white/60">
                      confiança {Math.round(focus.confidence * 100)}%
                      {focus.targetDescription
                        ? ` · ${focus.targetDescription}`
                        : ""}
                    </dd>
                    {focus.evidence && (
                      <dd className="text-xs text-white/50">
                        Evidência: {focus.evidence}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </details>
          )}
          {evaluation.providerExtras.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-xs text-[#E5D3A2]">
                Campos adicionais retornados pelo Vision
              </summary>
              <dl className="mt-2 space-y-2">
                {evaluation.providerExtras.map((extra) => (
                  <div key={`${extra.path}-${extra.sourceRole || "none"}`} className="rounded border border-white/10 p-2">
                    <dt className="text-xs text-white/80">
                      {extra.path}
                      {extra.sourceRole ? ` · ${extra.sourceRole}` : ""}
                    </dt>
                    <dd className="text-xs text-white/60">
                      Valor: {formatVisionValue(extra.value)} · confiança{" "}
                      {extra.confidence == null
                        ? "não informada"
                        : `${Math.round(extra.confidence * 100)}%`}
                    </dd>
                    {extra.evidence && (
                      <dd className="text-xs text-white/50">
                        Evidência: {extra.evidence}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
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

function formatCount(value: number | null): string {
  return value == null ? "?" : String(value);
}

function formatDuration(value: number): string {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

const REFERENCE_ROLE_LABELS: Record<string, string> = {
  biotipo: "Modelo de biotipo",
  decote: "Referência de decote",
  manga: "Referência de manga",
  saia: "Referência de saia",
  renda: "Referência de renda",
  customer_crop: "Recorte do cliente",
  customer_photo: "Foto do cliente",
  croqui: "Croqui selecionado",
  croqui_candidate: "Candidato de croqui",
  mannequin: "Modelo de manequim",
  fabric: "Imagem do tecido",
  intermediate_garment: "Referência intermediária da peça",
};

const REFERENCE_SOURCE_LABELS: Record<string, string> = {
  catalog: "catálogo",
  customer_crop: "recorte anonimizado",
  customer_photo: "foto do cliente",
  generated_artifact: "artefato gerado",
  mannequin: "template de manequim",
  fabric: "tecido",
  unknown: "origem não informada",
};

function referenceRoleLabel(role: string): string {
  return REFERENCE_ROLE_LABELS[role] || role;
}

function referenceSourceLabel(source: string): string {
  return REFERENCE_SOURCE_LABELS[source] || source;
}

const REFERENCE_TRANSPORT_LABELS: Record<string, string> = {
  https_url: "HTTPS público",
  data_url: "imagem privada",
  other_url: "URL externa",
  unknown: "transporte não informado",
};

function referenceTransportLabel(transport: string): string {
  return REFERENCE_TRANSPORT_LABELS[transport] || transport;
}

function referenceLocationLabel(reference: {
  providerHost: string | null;
  providerPath: string | null;
}): string | null {
  if (!reference.providerHost) return null;
  return `https://${reference.providerHost}${reference.providerPath || ""}`;
}

function formatSummary(summary: Record<string, string | number | boolean | null>): string {
  return Object.entries(summary)
    .map(([key, value]) => `${key}=${value === null ? "não informado" : String(value)}`)
    .join(" · ");
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
  const topLevelEntries = ["rendaDecisao"].flatMap((key) => {
    const observation = analysis[key];
    if (!observation || typeof observation !== "object" || Array.isArray(observation)) return [];
    const value = observation as Record<string, unknown>;
    if (typeof value.confidence !== "number") return [];
    return [{
      key,
      label: "Decisão sobre renda",
      value:
        ["string", "boolean"].includes(typeof value.value) || value.value === null
          ? (value.value as string | boolean | null)
          : null,
      confidence: value.confidence,
      evidence: typeof value.evidence === "string" ? value.evidence : null,
    }];
  });
  const details =
    analysis.detalhesTecnicos &&
    typeof analysis.detalhesTecnicos === "object" &&
    !Array.isArray(analysis.detalhesTecnicos)
      ? (analysis.detalhesTecnicos as Record<string, unknown>)
      : {};
  const detailEntries = Object.entries(details).flatMap(([key, value]) => {
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
  return [...topLevelEntries, ...detailEntries];
}
