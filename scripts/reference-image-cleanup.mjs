import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

export const REFERENCE_BUCKET = "croqui-uploads";
export const REFERENCE_PREFIX = "references";
export const REFERENCE_RETENTION_MS = 24 * 60 * 60 * 1000;
let cleanupInProgress = false;

function getStorageApi(client) {
  return client.storage || client;
}

function getStorageClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios para limpar referências.");
  return createClient(url, key);
}

async function listFiles(storage, prefix, offset = 0) {
  const { data, error } = await storage.from(REFERENCE_BUCKET).list(prefix, { limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw error;
  return data || [];
}

export async function findExpiredReferenceImages({ storage, now = new Date(), retentionMs = REFERENCE_RETENTION_MS } = {}) {
  const client = storage || getStorageClient();
  const storageApi = getStorageApi(client);
  const cutoff = now.getTime() - retentionMs;
  const expired = [];
  const scanPrefix = async (prefix) => {
    let offset = 0;
    while (true) {
      const entries = await listFiles(storageApi, prefix, offset);
      if (!entries.length) break;
      for (const entry of entries) {
        if (!entry?.name) continue;
        const objectPath = `${prefix}/${entry.name}`;
        if (!entry.id) {
          // Pastas continuam dentro do prefixo explicitamente permitido. Nunca
          // removemos um caminho que não comece por references/.
          await scanPrefix(objectPath);
          continue;
        }
        if (entry.created_at && new Date(entry.created_at).getTime() <= cutoff) expired.push(objectPath);
      }
      if (entries.length < 1000) break;
      offset += entries.length;
    }
  };

  await scanPrefix(REFERENCE_PREFIX);
  return expired;
}

export async function cleanupExpiredReferenceImages({ storage, now = new Date(), retentionMs = REFERENCE_RETENTION_MS, dryRun = true, logger = console } = {}) {
  if (cleanupInProgress) {
    logger.log("[REFERENCE CLEANUP] execução ignorada: já existe uma limpeza em andamento.");
    return { dryRun, paths: [], removed: [], skipped: true };
  }
  cleanupInProgress = true;
  const startedAt = Date.now();
  try {
    const client = storage || getStorageClient();
    const paths = await findExpiredReferenceImages({ storage: client, now, retentionMs });
    if (dryRun || paths.length === 0) {
      logger.log(`[REFERENCE CLEANUP] ${dryRun ? "dry-run" : "nenhum arquivo"}: ${paths.length} arquivo(s), ${Date.now() - startedAt}ms.`);
      return { dryRun, paths, removed: [], durationMs: Date.now() - startedAt };
    }

    const removed = [];
    for (let index = 0; index < paths.length; index += 1000) {
      const batch = paths.slice(index, index + 1000);
      const { data, error } = await getStorageApi(client).from(REFERENCE_BUCKET).remove(batch);
      if (error) throw error;
      removed.push(...(data || batch));
    }
    logger.log(`[REFERENCE CLEANUP] removidos ${removed.length} arquivo(s), ${Date.now() - startedAt}ms.`);
    return { dryRun: false, paths, removed, durationMs: Date.now() - startedAt };
  } finally {
    cleanupInProgress = false;
  }
}

async function main() {
  const execute = process.argv.includes("--execute");
  await cleanupExpiredReferenceImages({ dryRun: !execute });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[REFERENCE CLEANUP] falhou:", error);
    process.exitCode = 1;
  });
}
