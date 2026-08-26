import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredExecutionAssets } from "../server/executionCleanup";
import { InMemoryAnalyticsRepository, OperationalAnalytics } from "../server/operationalAnalytics";

describe("limpeza dos artefatos de execução", () => {
  it("remove artefato expirado pela Storage API e mantém o registro analítico", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const analytics = new OperationalAnalytics(repository);
    const now = new Date("2026-08-26T12:00:00Z");
    const execution = await analytics.startExecution({ source: "reference" });
    const artifact = await execution.recordArtifact({ kind: "reference_crop", storageBucket: "execution-assets", storagePath: "reference/x.jpg", retentionDays: -1 });
    const remove = vi.fn(async () => undefined);

    const result = await cleanupExpiredExecutionAssets({ repository, storage: { remove }, now: () => now });

    expect(result).toMatchObject({ scanned: 1, deleted: 1, failed: 0 });
    expect(remove).toHaveBeenCalledWith(["reference/x.jpg"]);
    expect((await analytics.getExecutionDetail(execution.executionId))?.artifacts[0]).toMatchObject({ id: artifact.artifactId, status: "deleted" });
  });

  it("registra a falha e incrementa tentativa quando Storage falha", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const analytics = new OperationalAnalytics(repository);
    const execution = await analytics.startExecution({ source: "reference" });
    await execution.recordArtifact({ kind: "reference_crop", storageBucket: "execution-assets", storagePath: "reference/fail.jpg", retentionDays: -1 });
    const result = await cleanupExpiredExecutionAssets({ repository, storage: { remove: async () => { throw new Error("offline"); } } });
    expect(result).toMatchObject({ scanned: 1, deleted: 0, failed: 1 });
    expect((await analytics.getExecutionDetail(execution.executionId))?.artifacts[0]).toMatchObject({ status: "deletion_failed", deletionAttempts: 1, deletionErrorCode: "storage_delete_failed" });
  });

  it("só remove metadados de execução após 12 meses e sem objetos pendentes", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const old = new Date("2025-01-01T00:00:00Z");
    const analytics = new OperationalAnalytics(repository, () => old);
    const execution = await analytics.startExecution({ source: "manual" });
    await execution.complete();
    const result = await cleanupExpiredExecutionAssets({ repository, storage: { remove: async () => undefined }, now: () => new Date("2026-08-26T00:00:00Z") });
    expect(result.executionsPurged).toBe(1);
    expect(await analytics.getExecutionDetail(execution.executionId)).toBeNull();
  });
});
