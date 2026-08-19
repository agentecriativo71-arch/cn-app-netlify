import elementosRaw from "./elementos_vestuario.json";

export type CatalogGenerationSpec = {
  catalogName: string;
  category: string;
  nameEn: string;
  descriptionEn: string;
  generationPromptEn: string | null;
};

type CatalogElement = {
  categoria: string;
  nome: string;
  nome_en: string;
  description_en: string;
  generation_prompt_en?: string;
};

const ELEMENT_MAP = new Map<string, CatalogElement>(
  (elementosRaw as CatalogElement[]).map((element) => [element.nome, element]),
);

export function getCatalogGenerationSpec(nome: string | null | undefined): CatalogGenerationSpec | null {
  if (!nome) return null;
  const element = ELEMENT_MAP.get(nome);
  if (!element) return { catalogName: nome, category: "unknown", nameEn: nome, descriptionEn: "", generationPromptEn: null };
  return {
    catalogName: element.nome,
    category: element.categoria,
    nameEn: element.nome_en || element.nome,
    descriptionEn: element.description_en || "",
    generationPromptEn: element.generation_prompt_en || null,
  };
}

export function buildCatalogElementPromptFragment(specs: {
  decote?: string | null;
  manga?: string | null;
  saia?: string | null;
  renda?: string | null;
  peca?: string | null;
  possuiManga?: boolean | null;
}): string {
  const parts: string[] = [];

  const addCatalogElement = (label: string, nome: string | null | undefined) => {
    const element = getCatalogGenerationSpec(nome);
    if (!element) return;
    const description = element.descriptionEn ? ` Catalog description: ${element.descriptionEn}.` : "";
    const generationRules = element.generationPromptEn ? ` Generation constraints: ${element.generationPromptEn}.` : "";
    parts.push(`${label} — catalog name "${element.catalogName}" (${element.nameEn}):${description}${generationRules}`);
  };

  addCatalogElement("NECKLINE STYLE", specs.decote);

  if (specs.manga) {
    addCatalogElement("SLEEVE STYLE", specs.manga);
  } else if (specs.possuiManga === false) {
    parts.push("SLEEVE STYLE — Sleeveless: The garment is completely sleeveless with no sleeves, leaving the arms fully bare");
  } else if (specs.possuiManga === true) {
    parts.push("SLEEVE STYLE — A sleeve is visibly present in the reference, but no exact catalog category was confirmed. Preserve only the visible sleeve construction described in the technical notes; do not invent a catalog name.");
  } else if (specs.possuiManga === undefined && (specs.peca === "Vestido" || specs.peca === "Blusa" || specs.peca === "Macacão")) {
    parts.push("SLEEVE STYLE — Sleeveless: The garment is completely sleeveless with no sleeves, leaving the arms fully bare");
  }

  addCatalogElement("SKIRT/BOTTOM STYLE", specs.saia);
  addCatalogElement("LACE DETAIL", specs.renda);

  return parts.length ? ` GARMENT ELEMENT SPECIFICATIONS (follow these catalog descriptions and generation constraints precisely): ${parts.join(". ")}.` : "";
}
