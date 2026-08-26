import elementosRaw from "./elementos_vestuario.json";

export type CatalogGenerationSpec = {
  catalogName: string;
  category: string;
  nameEn: string;
  descriptionEn: string;
  generationPromptEn: string | null;
  imageUrl: string | null;
};

type CatalogElement = {
  categoria: string;
  nome: string;
  nome_en: string;
  description_en: string;
  generation_prompt_en?: string;
  image_url?: string | null;
};

const ELEMENT_MAP = new Map<string, CatalogElement>(
  (elementosRaw as CatalogElement[]).map((element) => [element.nome, element]),
);

function defaultGenerationPrompt(category: string, name: string): string | null {
  if (category === "decote") return `Preserve ${name} exact neckline geometry, curve or angle and depth; do not substitute another neckline shape.`;
  if (category === "manga") return `Preserve ${name} exact attachment, length, volume and sleeve hem; do not invent another sleeve construction.`;
  if (category === "saia") return `Preserve ${name} exact silhouette from waist to hem; do not add mermaid, fishtail, peplum, overskirt, tiers or unrelated ruffles.`;
  if (category === "renda") return `Apply ${name} lace only as requested; do not replace it with embroidery, print or unrelated decoration.`;
  return null;
}

export function getCatalogGenerationSpec(nome: string | null | undefined): CatalogGenerationSpec | null {
  if (!nome) return null;
  const element = ELEMENT_MAP.get(nome);
  if (!element) return { catalogName: nome, category: "unknown", nameEn: nome, descriptionEn: "", generationPromptEn: null, imageUrl: null };
  return {
    catalogName: element.nome,
    category: element.categoria,
    nameEn: element.nome_en || element.nome,
    descriptionEn: element.description_en || "",
    generationPromptEn: element.generation_prompt_en || defaultGenerationPrompt(element.categoria, element.nome),
    imageUrl: element.image_url || null,
  };
}

const UNIVERSAL_ELEMENT_RULES: Record<string, string> = {
  decote: "Preserve the exact neckline geometry, curve/angle and depth shown by this catalog element; do not substitute another catalog shape such as V-neck, sweetheart, square, crew/round or boat neck.",
  manga: "Preserve the exact sleeve attachment, length, volume and hem; do not invent a different sleeve construction.",
  saia: "Preserve the selected skirt silhouette from waist to hem; do not add unrelated tiers, peplum, overskirt, ruffles or fishtail shaping.",
  renda: "Apply lace only where requested and keep its motif subordinate to the garment construction; do not replace lace with embroidery or print.",
};

const GODE_RULES = "Positive construction: continuous half-circle cut beginning at the waist, opening evenly from waist through hips, thighs and knees, with fluid circular drape and no concentrated godets at the hem. Negative construction: absolutely no mermaid, fishtail, trumpet, peplum, overskirt, ruffle, tier, flounce, tight hip/thigh/knee fit or hem-only godets.";

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
    const categoryRule = UNIVERSAL_ELEMENT_RULES[element.category] ? ` ${UNIVERSAL_ELEMENT_RULES[element.category]}` : "";
    const godeRule = element.catalogName === "Godê Simples" ? ` ${GODE_RULES}` : "";
    parts.push(`${label} — catalog name "${element.catalogName}" (${element.nameEn}):${description}${generationRules}${categoryRule}${godeRule}`);
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
