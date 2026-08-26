import { createServerFn } from "@tanstack/react-start";
import { operationalAnalytics } from "./analyticsRuntime";
import { getExecutionAssetStore } from "./executionAssetsRuntime";
import { requireAdministrativeUser } from "./dashboardAuth";

export const getDashboardOverviewFn: any = createServerFn({ method: "GET" })
  .handler(async () => {
    await requireAdministrativeUser();
    return operationalAnalytics.getDashboardOverview(100);
  });

export const getExecutionDetailFn: any = createServerFn({ method: "POST" })
  .handler(async ({ data }: any) => {
    await requireAdministrativeUser();
    const executionId = typeof data?.executionId === "string" ? data.executionId : "";
    if (!executionId) throw new Error("Execução inválida.");
    const detail = await operationalAnalytics.getExecutionDetail(executionId);
    if (!detail) throw new Error("Execução não encontrada.");
    const assets = getExecutionAssetStore();
    const artifacts = await Promise.all(detail.artifacts.map(async (artifact) => ({
      ...artifact,
      sourceUrl: null,
      signedUrl: assets && artifact.storagePath && artifact.status === "available"
        ? await assets.createSignedUrl(artifact.storagePath, 300).catch(() => null)
        : null,
    })));
    return { ...detail, artifacts };
  });
