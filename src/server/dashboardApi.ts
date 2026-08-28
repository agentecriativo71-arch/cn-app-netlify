import { createServerFn } from "@tanstack/react-start";
import { operationalAnalytics } from "./analyticsRuntime";
import { getExecutionAssetStore } from "./executionAssetsRuntime";
import type {
  ExecutionArtifactRecord,
  ExecutionDetail,
  ExecutionStepRecord,
} from "./operationalAnalytics";

const SPECIFICATION_LABELS: Record<string, string> = {
  ocasiao: "Ocasião",
  tipoCerimonia: "Tipo de cerimônia",
  rendaDecisao: "Renda selecionada",
  biotipo: "Biotipo",
  peca: "Peça",
  comprimento: "Comprimento",
  decote: "Decote",
  possuiManga: "Possui manga",
  manga: "Manga",
  saia: "Saia",
  renda: "Renda",
  cor: "Cor",
  tecidoSku: "SKU do tecido",
  modo: "Modo",
};

export type DashboardSpecificationEntry = {
  key: string;
  label: string;
  value: string;
};

export type DashboardVisionEvaluation = {
  technicalScore: number | null;
  averageConfidence: number | null;
  rank: number | null;
  eligible: boolean | null;
  disqualifiers: string[];
  qualityWarnings: string[];
  criteria: Record<
    string,
    {
      expected: string | boolean | null;
      observed: string | boolean | null;
      applicable: boolean;
      matched: boolean;
      confidence: number;
      evidence: string | null;
    }
  >;
  focus: Array<{
    role: string;
    status: string;
    targetDescription: string | null;
    candidateCount: number;
    confidence: number;
    evidence: string | null;
  }>;
  providerExtras: Array<{
    path: string;
    value: string | boolean | null;
    confidence: number | null;
    evidence: string | null;
    sourceRole: string | null;
  }>;
  visionAnalysis: Record<string, unknown> | null;
  legacy: boolean;
};

export type DashboardStepDiagnostic = {
  code: string;
  message: string;
  provider: string | null;
  model: string | null;
  httpStatus: number | null;
  providerField: string | null;
  candidateIndex: number | null;
  providerAttempt: number | null;
  retryable: boolean | null;
  referenceRole: string | null;
  referenceValue: string | null;
  assetName: string | null;
  referenceSummary: Array<{
    role: string;
    selectedValue: string | null;
    assetName: string | null;
  }>;
  detailed: boolean;
};

export type DashboardStepPresentation = {
  label: string;
  description: string;
  statusLabel: string;
  technicalCode: string;
};

export type DashboardProviderReference = {
  position: number;
  role: string;
  source: string;
  selectedValue: string | null;
  assetName: string | null;
  transport: string;
  providerHost: string | null;
  providerPath: string | null;
  referenceDigest: string | null;
};

export type DashboardProviderCall = {
  phase: string | null;
  operation: string | null;
  referenceCount: number | null;
  templateVersion: string | null;
  templateDigest: string | null;
  templateChars: number | null;
  requestSummary: Record<string, string | number | boolean | null>;
  responseSummary: Record<string, string | number | boolean | null>;
  references: DashboardProviderReference[];
};

export type DashboardGenerationSummary = {
  plannedCandidateCount: number | null;
  generatedCandidateCount: number | null;
  evaluatedCandidateCount: number | null;
  eligibleCandidateCount: number | null;
  failedCandidateCount: number | null;
  selectedSeed: number | null;
};

const STEP_ERROR_MESSAGES: Record<string, string> = {
  invalid_catalog_reference_url:
    "A referência do catálogo não possui URL pública válida.",
  invalid_customer_reference_url:
    "O recorte do cliente não possui formato aceito para geração.",
  fal_reference_download_failed:
    "Fal.ai não conseguiu baixar uma imagem de referência.",
  fal_input_validation_failed: "Fal.ai recusou os parâmetros de entrada.",
  fal_authentication_failed: "Fal.ai recusou a autenticação do servidor.",
  fal_rate_limited: "Fal.ai limitou temporariamente as requisições.",
  fal_provider_unavailable: "Fal.ai esteve indisponível durante a geração.",
  fal_network_error: "Não foi possível comunicar com Fal.ai.",
  fal_generation_failed: "Fal.ai falhou durante a geração do croqui.",
  generation_failed: "A geração do croqui falhou.",
  vision_evaluation_failed: "A análise Vision falhou para este candidato.",
  provider_request_failed: "O provedor externo falhou durante a chamada.",
  realistic_provider_request_failed:
    "A chamada de geração da foto realista falhou.",
};

const STEP_LABELS: Record<string, { label: string; description: string }> = {
  form_submission: {
    label: "Formulário recebido",
    description: "As escolhas do usuário foram recebidas e registradas.",
  },
  reference_upload: {
    label: "Referências recebidas",
    description: "Os recortes foram validados para o fluxo de referência.",
  },
  reference_crop_storage: {
    label: "Recortes retidos",
    description: "Os recortes principais foram guardados conforme a retenção.",
  },
  reference_vision: {
    label: "Análise Vision da referência",
    description: "A referência foi interpretada para extrair as especificações.",
  },
  reference_vision_request: {
    label: "Chamada Vision da referência",
    description: "Uma imagem ou composição foi enviada ao modelo Vision.",
  },
  reference_vision_part: {
    label: "Análise Vision de uma parte",
    description: "Uma parte da referência foi analisada separadamente.",
  },
  croqui_reference_validation: {
    label: "Referências do croqui validadas",
    description: "As imagens que serão usadas no croqui foram conferidas.",
  },
  croqui_generation: {
    label: "Geração dos croquis",
    description: "A execução coordenou candidatos, avaliações e seleção.",
  },
  croqui_candidate_generation: {
    label: "Candidato de croqui gerado",
    description: "Um candidato de croqui foi produzido para comparação.",
  },
  croqui_provider_request: {
    label: "Chamada Fal.ai para croqui",
    description: "O candidato foi solicitado ao provedor de geração.",
  },
  croqui_candidate_evaluation: {
    label: "Candidato de croqui analisado",
    description: "O candidato foi comparado com os critérios pelo Vision.",
  },
  generated_artifact_storage: {
    label: "Imagem armazenada",
    description: "O resultado foi copiado para o armazenamento privado.",
  },
  realistic_generation: {
    label: "Geração da foto realista",
    description: "A execução coordenou a produção da foto realista.",
  },
  realistic_provider_request: {
    label: "Chamada Fal.ai para foto realista",
    description: "Uma imagem realista foi solicitada ao provedor.",
  },
  realistic_vision_evaluation: {
    label: "Avaliação Vision da foto realista",
    description: "As variantes realistas foram comparadas pelo Vision.",
  },
  persistence: {
    label: "Resultado persistido",
    description: "Os dados finais da execução foram salvos.",
  },
};

const STEP_STATUS_LABELS: Record<ExecutionStepRecord["status"], string> = {
  running: "Em andamento",
  success: "Concluída",
  error: "Falhou",
};

function candidateDescription(step: ExecutionStepRecord): string | null {
  const metadata = metadataRecord(step.metadata);
  const candidate = optionalNumber(metadata.candidateIndex);
  if (candidate != null) return `Candidato ${Math.max(1, Math.floor(candidate))}`;
  const variant = optionalNumber(metadata.variantIndex);
  if (variant != null) return `Variante ${Math.max(1, Math.floor(variant) + 1)}`;
  return null;
}

export function getDashboardStepPresentation(
  step: ExecutionStepRecord,
): DashboardStepPresentation {
  const configured = STEP_LABELS[step.stage] || {
    label: "Etapa da execução",
    description: "Uma etapa técnica do fluxo foi registrada.",
  };
  const candidate = candidateDescription(step);
  return {
    label: candidate ? `${configured.label} · ${candidate}` : configured.label,
    description: configured.description,
    statusLabel: STEP_STATUS_LABELS[step.status],
    technicalCode: step.stage,
  };
}

function safeScalarMap(value: unknown): Record<string, string | number | boolean | null> {
  const record = metadataRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, item]) =>
      typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null
        ? [[key, item]]
        : [],
    ),
  );
}

export function getDashboardProviderCall(
  step: ExecutionStepRecord,
): DashboardProviderCall | null {
  const metadata = metadataRecord(step.metadata);
  const manifest = Array.isArray(metadata.referenceManifest)
    ? metadata.referenceManifest.flatMap((value) => {
        const reference = metadataRecord(value);
        if (typeof reference.role !== "string") return [];
        return [{
          position: optionalNumber(reference.position) || 0,
          role: reference.role,
          source: optionalString(reference.source) || "unknown",
          selectedValue: optionalString(reference.selectedValue),
          assetName: optionalString(reference.assetName),
          transport: optionalString(reference.transport) || "unknown",
          providerHost: optionalString(reference.providerHost),
          providerPath: optionalString(reference.providerPath),
          referenceDigest: optionalString(reference.referenceDigest),
        }];
      })
    : [];
  const isTrace = metadata.schemaVersion === "provider-call-v1" || manifest.length > 0;
  if (!isTrace) return null;
  return {
    phase: optionalString(metadata.phase),
    operation: optionalString(metadata.operation),
    referenceCount: optionalNumber(metadata.referenceCount),
    templateVersion: optionalString(metadata.templateVersion),
    templateDigest: optionalString(metadata.templateDigest),
    templateChars: optionalNumber(metadata.templateChars),
    requestSummary: safeScalarMap(metadata.requestSummary),
    responseSummary: safeScalarMap(metadata.responseSummary),
    references: manifest,
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length <= 500 ? value : null;
}

function confidenceOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

function scalarValue(value: unknown): string | boolean | null {
  return typeof value === "string" || typeof value === "boolean" || value === null
    ? value
    : null;
}

export function getDashboardStepDiagnostic(
  step: ExecutionStepRecord,
): DashboardStepDiagnostic | null {
  if (!step.errorCode) return null;
  const metadata = metadataRecord(step.metadata);
  const referenceSummary = Array.isArray(metadata.referenceSummary)
    ? metadata.referenceSummary.flatMap((value) => {
        const item = metadataRecord(value);
        if (typeof item.role !== "string") return [];
        return [{
          role: item.role,
          selectedValue: optionalString(item.selectedValue),
          assetName: optionalString(item.assetName),
        }];
      })
    : [];
  return {
    code: step.errorCode,
    message:
      STEP_ERROR_MESSAGES[step.errorCode] ||
      "A etapa falhou; consulte o código técnico para investigação.",
    provider: step.provider,
    model: step.model,
    httpStatus: optionalNumber(metadata.httpStatus),
    providerField: optionalString(metadata.providerField),
    candidateIndex: optionalNumber(metadata.candidateIndex),
    providerAttempt: optionalNumber(metadata.providerAttempt),
    retryable:
      typeof metadata.retryable === "boolean" ? metadata.retryable : null,
    referenceRole: optionalString(metadata.referenceRole),
    referenceValue: optionalString(metadata.referenceValue),
    assetName: optionalString(metadata.assetName),
    referenceSummary,
    detailed:
      typeof metadata.category === "string" ||
      typeof metadata.httpStatus === "number" ||
      typeof metadata.providerField === "string",
  };
}

export function getDashboardGenerationSummary(
  steps: ExecutionStepRecord[],
): DashboardGenerationSummary | null {
  const overall = steps.find((step) => step.stage === "croqui_generation");
  if (!overall) return null;
  const metadata = metadataRecord(overall.metadata);
  const plannedCandidateCount =
    optionalNumber(metadata.plannedCandidateCount) ??
    optionalNumber(metadata.candidateCountExpected);
  const summary = {
    plannedCandidateCount,
    generatedCandidateCount: optionalNumber(metadata.generatedCandidateCount),
    evaluatedCandidateCount: optionalNumber(metadata.evaluatedCandidateCount),
    eligibleCandidateCount: optionalNumber(metadata.eligibleCandidateCount),
    failedCandidateCount: optionalNumber(metadata.failedCandidateCount),
    selectedSeed: optionalNumber(metadata.selectedSeed),
  };
  return Object.values(summary).some((value) => value !== null) ? summary : null;
}

export function getDashboardVisionEvaluation(
  artifact: ExecutionArtifactRecord,
): DashboardVisionEvaluation {
  const metadata = metadataRecord(artifact.metadata);
  const assessment = metadataRecord(metadata.assessment);
  const criteria = metadataRecord(assessment.criteria);
  const normalizedCriteria = Object.fromEntries(
    Object.entries(criteria).flatMap(([key, value]) => {
      const criterion = metadataRecord(value);
      if (
        typeof criterion.confidence !== "number" ||
        typeof criterion.applicable !== "boolean" ||
        typeof criterion.matched !== "boolean"
      )
        return [];
      return [
        [
          key,
          {
            expected:
              ["string", "boolean"].includes(typeof criterion.expected) ||
              criterion.expected === null
                ? (criterion.expected as string | boolean | null)
                : null,
            observed:
              ["string", "boolean"].includes(typeof criterion.observed) ||
              criterion.observed === null
                ? (criterion.observed as string | boolean | null)
                : null,
            applicable: criterion.applicable,
            matched: criterion.matched,
            confidence: Math.max(0, Math.min(1, criterion.confidence)),
            evidence:
              typeof criterion.evidence === "string"
                ? criterion.evidence
                : null,
          },
        ],
      ];
    }),
  );
  const disqualifiers = Array.isArray(metadata.rejectionReasons)
    ? metadata.rejectionReasons.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const qualityWarnings = Array.isArray(metadata.qualityWarnings)
    ? metadata.qualityWarnings.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const technicalScore =
    typeof metadata.technicalScore === "number"
      ? metadata.technicalScore
      : typeof metadata.score === "number"
        ? metadata.score
        : null;
  const averageConfidence =
    typeof metadata.averageConfidence === "number"
      ? metadata.averageConfidence
      : null;
  const rank = typeof metadata.rank === "number" ? metadata.rank : null;
  const eligible =
    typeof metadata.eligible === "boolean"
      ? metadata.eligible
      : typeof metadata.rejected === "boolean"
        ? !metadata.rejected
        : null;
  const visionAnalysis =
    metadata.visionAnalysis &&
    typeof metadata.visionAnalysis === "object" &&
    !Array.isArray(metadata.visionAnalysis)
      ? (metadata.visionAnalysis as Record<string, unknown>)
      : null;
  const focus = visionAnalysis && Array.isArray(visionAnalysis.focus)
    ? visionAnalysis.focus.flatMap((value) => {
        const item = metadataRecord(value);
        const confidence = confidenceOf(item.confidence);
        if (
          typeof item.role !== "string" ||
          typeof item.status !== "string" ||
          typeof item.candidateCount !== "number" ||
          confidence === null
        ) {
          return [];
        }
        return [{
          role: item.role,
          status: item.status,
          targetDescription: optionalString(item.targetDescription),
          candidateCount: Math.max(0, Math.floor(item.candidateCount)),
          confidence,
          evidence: optionalString(item.evidence),
        }];
      })
    : [];
  const providerExtras = visionAnalysis && Array.isArray(visionAnalysis.providerExtras)
    ? visionAnalysis.providerExtras.flatMap((value) => {
        const item = metadataRecord(value);
        if (typeof item.path !== "string" || item.path.length > 500) return [];
        return [{
          path: item.path,
          value: scalarValue(item.value),
          confidence: confidenceOf(item.confidence),
          evidence: optionalString(item.evidence),
          sourceRole: optionalString(item.sourceRole),
        }];
      })
    : [];
  return {
    technicalScore,
    averageConfidence,
    rank,
    eligible,
    disqualifiers,
    qualityWarnings,
    criteria: normalizedCriteria,
    focus,
    providerExtras,
    visionAnalysis,
    legacy: !assessment.schemaVersion && !visionAnalysis,
  };
}

export function getDashboardSpecificationEntries(
  specification: ExecutionDetail["specification"],
): DashboardSpecificationEntry[] {
  return Object.entries(specification)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => ({
      key,
      label: SPECIFICATION_LABELS[key] || key,
      value:
        typeof value === "boolean"
          ? value
            ? "Sim"
            : "Não"
          : typeof value === "string" || typeof value === "number"
            ? String(value)
            : JSON.stringify(value),
    }));
}

export type DashboardOverviewLoadResult =
  | {
      status: "ready";
      data: Awaited<
        ReturnType<typeof operationalAnalytics.getDashboardOverview>
      >;
    }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export async function loadDashboardOverview(dependencies: {
  requireAdmin: () => Promise<unknown>;
  getOverview: () => ReturnType<
    typeof operationalAnalytics.getDashboardOverview
  >;
}): Promise<DashboardOverviewLoadResult> {
  try {
    await dependencies.requireAdmin();
  } catch {
    return { status: "unauthorized" };
  }

  try {
    return { status: "ready", data: await dependencies.getOverview() };
  } catch {
    return { status: "unavailable" };
  }
}

export type DashboardExecutionDetail = Omit<ExecutionDetail, "artifacts"> & {
  artifacts: Array<ExecutionArtifactRecord & { signedUrl?: string | null }>;
};

/**
 * Sanitiza as URLs dos artefatos para qualquer consumidor administrativo.
 * O analytics guarda somente o caminho privado; a URL assinada é curta e
 * criada no momento da consulta, evitando exposição de credenciais ou links
 * persistentes no dashboard e na integração externa.
 */
export async function signDashboardArtifacts(
  detail: ExecutionDetail,
): Promise<DashboardExecutionDetail> {
  const assets = getExecutionAssetStore();
  const artifacts = await Promise.all(
    detail.artifacts.map(async (artifact) => ({
      ...artifact,
      sourceUrl: null,
      signedUrl:
        assets && artifact.storagePath && artifact.status === "available"
          ? await assets
              .createSignedUrl(artifact.storagePath, 300)
              .catch(() => null)
          : null,
    })),
  );
  return { ...detail, artifacts };
}

export type ExecutionDetailLoadResult =
  | { status: "ready"; data: DashboardExecutionDetail }
  | { status: "unauthorized" }
  | { status: "not_found" }
  | { status: "unavailable" };

export async function loadExecutionDetail(
  executionId: string,
  dependencies: {
    requireAdmin: () => Promise<unknown>;
    getDetail: (executionId: string) => Promise<ExecutionDetail | null>;
    signArtifacts: (
      detail: ExecutionDetail,
    ) => Promise<DashboardExecutionDetail>;
  },
): Promise<ExecutionDetailLoadResult> {
  try {
    await dependencies.requireAdmin();
  } catch {
    return { status: "unauthorized" };
  }

  if (!executionId) return { status: "not_found" };
  try {
    const detail = await dependencies.getDetail(executionId);
    if (!detail) return { status: "not_found" };
    return { status: "ready", data: await dependencies.signArtifacts(detail) };
  } catch {
    return { status: "unavailable" };
  }
}

export const getDashboardOverviewFn: any = createServerFn({
  method: "GET",
}).handler(async () => {
  const { requireAdministrativeUser } = await import("./dashboardAuth.server");
  return loadDashboardOverview({
    requireAdmin: requireAdministrativeUser,
    getOverview: () => operationalAnalytics.getDashboardOverview(100),
  });
});

export const getExecutionDetailFn: any = createServerFn({
  method: "POST",
}).handler(async ({ data }: any) => {
  const { requireAdministrativeUser } = await import("./dashboardAuth.server");
  const executionId =
    typeof data?.executionId === "string" ? data.executionId : "";
  return loadExecutionDetail(executionId, {
    requireAdmin: requireAdministrativeUser,
    getDetail: (id) => operationalAnalytics.getExecutionDetail(id),
    signArtifacts: signDashboardArtifacts,
  });
});
