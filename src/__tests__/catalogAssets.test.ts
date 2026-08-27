import { describe, expect, it } from "vitest";
import elementosRaw from "../lib/elementos_vestuario.json";
import {
  CATALOG_ASSET_BUCKET,
  CATALOG_ASSET_PUBLIC_BASE_URL,
  LACE_ASSET_MANIFEST,
  buildCatalogAssetUrl,
  isCatalogPublicAssetUrl,
} from "../lib/catalogAssets";

describe("assets públicos do catálogo", () => {
  it("mantém manifesto dos onze assets de renda sem apagar elementos existentes", () => {
    expect(LACE_ASSET_MANIFEST).toHaveLength(11);
    expect(LACE_ASSET_MANIFEST.map((asset) => asset.objectPath)).toEqual(
      expect.arrayContaining([
        "renda-aplicacoes-localizadas.png",
        "renda-sobreposicao.png",
        "renda-inteira.png",
        "renda-barrados.png",
        "renda-recortes.png",
        "renda-mangas.png",
        "renda-costas.png",
        "renda-bordado.png",
        "renda-camadas.png",
        "renda-florais-3d.png",
        "renda-mistura-tecidos.png",
      ]),
    );
    expect(CATALOG_ASSET_BUCKET).toBe("elementos");
  });

  it("gera somente URLs HTTPS públicas do bucket elementos", () => {
    for (const asset of LACE_ASSET_MANIFEST) {
      const url = buildCatalogAssetUrl(asset.objectPath);
      expect(url).toBe(`${CATALOG_ASSET_PUBLIC_BASE_URL}/${asset.objectPath}`);
      expect(isCatalogPublicAssetUrl(url)).toBe(true);
      expect(url).not.toContain("/src/assets/");
    }
  });

  it("mantém referências públicas para todas as rendas catalogadas", () => {
    const laceElements = (
      elementosRaw as Array<{ categoria: string; image_url?: string | null }>
    ).filter((element) => element.categoria === "renda" && element.image_url);
    expect(laceElements).toHaveLength(11);
    expect(
      laceElements.every((element) =>
        isCatalogPublicAssetUrl(element.image_url!),
      ),
    ).toBe(true);
  });

  it("rejeita caminho local ou bucket diferente como referência do provedor", () => {
    expect(isCatalogPublicAssetUrl("/src/assets/renda-inteira.png")).toBe(
      false,
    );
    expect(
      isCatalogPublicAssetUrl(
        "https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/outro/renda-inteira.png",
      ),
    ).toBe(false);
  });
});
