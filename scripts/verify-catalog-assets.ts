import {
  buildCatalogAssetUrl,
  LACE_ASSET_MANIFEST,
} from "../src/lib/catalogAssets";

async function verifyAsset(objectPath: string): Promise<void> {
  const response = await fetch(buildCatalogAssetUrl(objectPath), {
    headers: { Range: "bytes=0-0" },
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    throw new Error(
      `HTTP ${response.status}, content-type ${contentType || "ausente"}`,
    );
  }
  console.log(`OK ${objectPath}: HTTP ${response.status}, ${contentType}`);
  response.body?.cancel();
}

async function main(): Promise<void> {
  const results = await Promise.allSettled(
    LACE_ASSET_MANIFEST.map((asset) => verifyAsset(asset.objectPath)),
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          `${LACE_ASSET_MANIFEST[index].objectPath}: ${result.reason instanceof Error ? result.reason.message : "falha desconhecida"}`,
        ]
      : [],
  );
  if (failures.length) {
    throw new Error(
      `${failures.length} asset(s) inválido(s):\n${failures.join("\n")}`,
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Falha ao validar assets do catálogo.",
  );
  process.exitCode = 1;
});
