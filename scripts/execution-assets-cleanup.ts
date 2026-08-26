import { operationalAnalytics } from "../src/server/analyticsRuntime.ts";
import { getExecutionAssetStore } from "../src/server/executionAssetsRuntime.ts";
import { cleanupExpiredExecutionAssets } from "../src/server/executionCleanup.ts";

const storage = getExecutionAssetStore();
if (!storage) {
  console.warn("[EXECUTION CLEANUP] Storage privado não configurado; limpeza ignorada.");
  process.exit(0);
}

const result = await cleanupExpiredExecutionAssets({ repository: operationalAnalytics.getRepository(), storage });
console.info("[EXECUTION CLEANUP] processamento concluído", result);
