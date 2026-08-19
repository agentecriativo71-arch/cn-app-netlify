import { describe, expect, it } from "vitest";
import { CATALOG_ELEMENTS, CATALOG_VALUES } from "../lib/referenceUtils";
import { buildCatalogElementPromptFragment, getCatalogGenerationSpec } from "../lib/garmentPrompt";

describe("prompt de geração dos elementos do catálogo", () => {
  it("mantém regra de geração para cada tipo de manga catalogado", () => {
    for (const nome of CATALOG_VALUES.manga) {
      expect(getCatalogGenerationSpec(nome), nome).toMatchObject({
        catalogName: nome,
        category: "manga",
      });
      expect(getCatalogGenerationSpec(nome)?.generationPromptEn, nome).toBeTruthy();
    }
  });

  it("envia instrução específica para manga longa sem transformar o punho em elástico", () => {
    const prompt = buildCatalogElementPromptFragment({ manga: "Longa (Long Sleeve)" });

    expect(prompt).toContain('catalog name "Longa (Long Sleeve)"');
    expect(prompt).toContain("continuous sleeve from shoulder to wrist");
    expect(prompt).toContain("clean, straight wrist hem");
    expect(prompt).toContain("elasticized");
    expect(prompt).toContain("gathered");
    expect(prompt).not.toContain("rounded balloon volume");
  });

  it("preserva regra própria da manga balão, sem reutilizar a regra da manga longa", () => {
    const prompt = buildCatalogElementPromptFragment({ manga: "Balão (Balloon)" });

    expect(prompt).toContain('catalog name "Balão (Balloon)"');
    expect(prompt).toContain("rounded balloon volume");
    expect(prompt).toContain("close-fitting cuff");
    expect(prompt).not.toContain("Do not use a clean, straight wrist hem");
  });

  it("usa nome e descrição do catálogo para elementos não-manga", () => {
    const neckline = CATALOG_ELEMENTS.find((element) => element.nome === "V (V-Neck)");
    expect(buildCatalogElementPromptFragment({ decote: neckline?.nome })).toContain(neckline?.description_en);
  });
});
