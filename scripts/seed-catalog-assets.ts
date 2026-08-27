import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildCatalogAssetUrl,
  CATALOG_ASSET_BUCKET,
  LACE_ASSET_MANIFEST,
} from "../src/lib/catalogAssets";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error(
    "VITE_SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórias para publicar assets do catálogo.",
  );
}

const supabase = createClient(supabaseUrl, serviceKey);

async function objectAlreadyExists(objectPath: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(CATALOG_ASSET_BUCKET)
    .list("", { limit: 1000, search: objectPath });
  if (error)
    throw new Error(
      `Não foi possível consultar ${CATALOG_ASSET_BUCKET}: ${error.message}`,
    );
  return data.some((entry) => entry.name === objectPath);
}

async function main(): Promise<void> {
  for (const asset of LACE_ASSET_MANIFEST) {
    if (await objectAlreadyExists(asset.objectPath)) {
      console.log(`PRESERVADO ${asset.objectPath} (já existente)`);
      continue;
    }

    const file = await readFile(path.resolve(process.cwd(), asset.localFile));
    const { error } = await supabase.storage
      .from(CATALOG_ASSET_BUCKET)
      .upload(asset.objectPath, file, {
        contentType: "image/png",
        upsert: false,
      });
    if (error)
      throw new Error(
        `Falha ao publicar ${asset.objectPath}: ${error.message}`,
      );
    console.log(
      `CRIADO ${asset.objectPath} → ${buildCatalogAssetUrl(asset.objectPath)}`,
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Falha ao publicar assets do catálogo.",
  );
  process.exitCode = 1;
});
