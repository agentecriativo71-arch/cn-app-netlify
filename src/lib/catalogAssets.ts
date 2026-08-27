export const CATALOG_ASSET_BUCKET = "elementos" as const;
export const CATALOG_ASSET_PUBLIC_BASE_URL =
  "https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos" as const;

export type CatalogAssetManifestEntry = {
  localFile: string;
  objectPath: string;
};

/**
 * Fontes locais usadas somente pelo seeder; o servidor usa os objetos públicos
 * correspondentes no bucket de elementos do projeto operacional.
 */
export const LACE_ASSET_MANIFEST: readonly CatalogAssetManifestEntry[] = [
  {
    localFile: "src/assets/renda-aplicacoes-localizadas.png",
    objectPath: "renda-aplicacoes-localizadas.png",
  },
  {
    localFile: "src/assets/renda-sobreposicao.png",
    objectPath: "renda-sobreposicao.png",
  },
  {
    localFile: "src/assets/renda-inteira.png",
    objectPath: "renda-inteira.png",
  },
  {
    localFile: "src/assets/renda-barrados.png",
    objectPath: "renda-barrados.png",
  },
  {
    localFile: "src/assets/renda-recortes.png",
    objectPath: "renda-recortes.png",
  },
  {
    localFile: "src/assets/renda-mangas.png",
    objectPath: "renda-mangas.png",
  },
  {
    localFile: "src/assets/renda-costas.png",
    objectPath: "renda-costas.png",
  },
  {
    localFile: "src/assets/renda-bordado.png",
    objectPath: "renda-bordado.png",
  },
  {
    localFile: "src/assets/renda-camadas.png",
    objectPath: "renda-camadas.png",
  },
  {
    localFile: "src/assets/renda-florais-3d.png",
    objectPath: "renda-florais-3d.png",
  },
  {
    localFile: "src/assets/renda-mistura-tecidos.png",
    objectPath: "renda-mistura-tecidos.png",
  },
] as const;

function isSafeObjectPath(objectPath: string): boolean {
  return Boolean(
    objectPath &&
    !objectPath.startsWith("/") &&
    !objectPath.includes("..") &&
    !objectPath.includes("\\"),
  );
}

export function buildCatalogAssetUrl(objectPath: string): string {
  if (!isSafeObjectPath(objectPath)) {
    throw new Error("Caminho de asset do catálogo inválido.");
  }
  return `${CATALOG_ASSET_PUBLIC_BASE_URL}/${objectPath}`;
}

export function isCatalogPublicAssetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const base = new URL(`${CATALOG_ASSET_PUBLIC_BASE_URL}/`);
    return (
      url.protocol === "https:" &&
      url.origin === base.origin &&
      url.pathname.startsWith(base.pathname) &&
      url.pathname.length > base.pathname.length &&
      !url.search &&
      !url.hash &&
      isSafeObjectPath(url.pathname.slice(base.pathname.length))
    );
  } catch {
    return false;
  }
}
