import { createServerFn } from "@tanstack/react-start";
import { operationalAnalytics } from "./analyticsRuntime";
import { getExecutionAssetStore } from "./executionAssetsRuntime";
import type {
  ExecutionArtifactRecord,
  ExecutionDetail,
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
  visionAnalysis: Record<string, unknown> | null;
  legacy: boolean;
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  return {
    technicalScore,
    averageConfidence,
    rank,
    eligible,
    disqualifiers,
    qualityWarnings,
    criteria: normalizedCriteria,
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
    signArtifacts: async (detail) => {
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
    },
  });
});
