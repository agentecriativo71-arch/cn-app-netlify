import type { AnalyticsRepository } from "./operationalAnalytics";
import type { PrivateStorageBoundary } from "./executionAssets";

export async function cleanupExpiredExecutionAssets(input: {
  repository: AnalyticsRepository;
  storage: Pick<PrivateStorageBoundary, "remove">;
  now?: () => Date;
  limit?: number;
}): Promise<{ scanned: number; deleted: number; failed: number; executionsPurged: number }> {
  const now = input.now || (() => new Date());
  const nowIso = now().toISOString();
  const expired = await input.repository.listExpiredArtifacts(nowIso, input.limit || 100);
  let deleted = 0;
  let failed = 0;
  for (const artifact of expired) {
    try {
      if (!artifact.storagePath) throw new Error("missing_storage_path");
      await input.storage.remove([artifact.storagePath]);
      await input.repository.markArtifactDeleted(artifact.id, now().toISOString());
      deleted += 1;
    } catch {
      failed += 1;
      await input.repository.markArtifactDeletionFailed(artifact.id, "storage_delete_failed");
    }
  }
  const executionsPurged = await input.repository.purgeExpiredExecutions(nowIso);
  return { scanned: expired.length, deleted, failed, executionsPurged };
}
