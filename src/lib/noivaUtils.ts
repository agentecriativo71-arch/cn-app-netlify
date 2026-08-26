const SUPABASE_ELEMENTOS_URL = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos';

export const MANNEQUIN_URLS: Record<string, string> = {
  "Ampulheta":           `${SUPABASE_ELEMENTOS_URL}/manequins/ampulheta.jpg`,
  "Triângulo":           `${SUPABASE_ELEMENTOS_URL}/manequins/triangulo.jpg`,
  "Triângulo Invertido": `${SUPABASE_ELEMENTOS_URL}/manequins/triangulo_invertido.jpg`,
  "Retângulo":           `${SUPABASE_ELEMENTOS_URL}/manequins/retangulo.jpg`,
};

export function getMannequinUrl(biotipo?: string | null): string {
  if (!biotipo) return MANNEQUIN_URLS["Ampulheta"];
  return MANNEQUIN_URLS[biotipo] || MANNEQUIN_URLS["Ampulheta"];
}

export const CORES_PADRAO = [
  { nome: "Verde C&N", hex: "#1A6B2F" },
  { nome: "Preto", hex: "#000000" },
  { nome: "Branco", hex: "#FFFFFF" },
  { nome: "Azul Marinho", hex: "#1E3A8A" },
  { nome: "Vermelho Rubi", hex: "#BE123C" },
  { nome: "Rosa Pastel", hex: "#FBCFE8" },
  { nome: "Roxo Imperial", hex: "#6D28D9" },
  { nome: "Terracota", hex: "#C2410C" },
  { nome: "Amarelo Mostarda", hex: "#D97706" },
  { nome: "Nude/Bege", hex: "#F5F5DC" },
  { nome: "Lilás", hex: "#C084FC" },
  { nome: "Verde Menta", hex: "#A7F3D0" }
];

export const CORES_NOIVA = [
  { nome: "Branco", hex: "#FFFFFF" },
  { nome: "Off-White", hex: "#F5F2EB" }
];

export function getAvailableColors(ocasiao?: string | null) {
  if (ocasiao === "Noiva") {
    return CORES_NOIVA;
  }
  return CORES_PADRAO;
}

export function getBackgroundInstruction(ocasiao?: string | null) {
  if (ocasiao === "Noiva") {
    return "a soft muted light beige studio background with delicate dim lighting to gently contrast with the white dress";
  }
  return "a clean white background";
}

export function isFormValidForNoiva(state: {
  nome?: string | null;
  ocasiao?: string | null;
  tipoCerimonia?: string | null;
  rendaDecisao?: boolean | null;
  decote?: string | null;
  manga?: string | null;
  possuiManga?: boolean | null;
  saia?: string | null;
  renda?: string | null;
  comprimento?: string | null;
  biotipo?: string | null;
  comentario?: string | null;
  peca?: string | null;
}) {
  if (!state.nome || !state.ocasiao) return false;

  if (state.ocasiao === "Noiva") {
    return !!(
      state.tipoCerimonia &&
      state.rendaDecisao !== null &&
      state.rendaDecisao !== undefined &&
      state.comprimento &&
      state.biotipo &&
      state.decote &&
      (state.possuiManga === false || !!state.manga) &&
      state.saia &&
      (state.rendaDecisao === false || !!state.renda) &&
      state.comentario?.trim()
    );
  }

  const hasNeckline = ["Vestido", "Blusa", "Macacão", "Top", "Blazer"].includes(state.peca || "");
  const hasSleeve = hasNeckline && !SLEEVELESS_DECOTES.includes(state.decote || "");
  const hasSkirt = ["Vestido", "Saia", "Macacão"].includes(state.peca || "");
  return !!(
    state.peca && state.biotipo &&
    (!hasNeckline || state.decote) &&
    (!hasSleeve || state.possuiManga === false || state.manga) &&
    (!hasSkirt || state.saia)
  );
}

export function clearIncompatibleLookFields(peca: string | null, ocasiao?: string | null) {
  const patch: Record<string, null | boolean | string> = {};
  const onePiece = ocasiao === "Noiva" || peca === "Vestido" || peca === "Macacão";
  const hasTop = ["Vestido", "Blusa", "Macacão", "Top", "Blazer"].includes(peca || "");
  const hasBottom = ["Vestido", "Saia", "Macacão"].includes(peca || "");
  if (!onePiece) patch.comprimento = null;
  if (!hasTop) {
    patch.decote = null;
    patch.manga = null;
    patch.possuiManga = null;
  }
  if (!hasBottom) patch.saia = null;
  if (ocasiao !== "Noiva") {
    patch.tipoCerimonia = null;
    patch.rendaDecisao = null;
    patch.renda = null;
  }
  return patch;
}

export const SLEEVELESS_DECOTES = ["Frente Única", "Coração (Sweetheart)", "Tomara que Caia"];

export function buildSleevelessInstruction(decote?: string | null, manga?: string | null): string {
  if (manga && manga !== "Sem Manga") return '';

  if (decote === "Tomara que Caia") {
    return `CRITICAL — STRAPLESS GARMENT (TOMARA QUE CAIA): The garment is completely and absolutely strapless. Absolutely NO shoulder straps, NO spaghetti straps, NO halter neck, and NO fabric over the shoulders or collarbones. The upper chest, shoulders, neck, and upper back must be 100% bare mannequin surface with a clean neckline cutoff. Adding straps is a critical error.\n`;
  }

  if (decote === "Frente Única") {
    return `CRITICAL — HALTER NECK GARMENT (FRENTE ÚNICA): The garment fastens behind the neck with completely bare shoulders, arms, and upper back. Do NOT add standard sleeves or shoulder straps.\n`;
  }

  if (decote === "Coração (Sweetheart)" && (!manga || manga === "Sem Manga")) {
    return `CRITICAL — SWEETHEART SLEEVELESS GARMENT: The neckline follows a sweetheart shape with completely bare arms and shoulders. Do NOT add sleeves or arm coverage.\n`;
  }

  if (manga === "Sem Manga" || (decote && SLEEVELESS_DECOTES.includes(decote))) {
    return `CRITICAL — SLEEVELESS GARMENT: This design is completely and absolutely sleeveless. Do NOT draw, render, or imply any sleeves, shoulder straps, arm coverage, or any fabric on the arms or shoulders (other than the neckline itself). The arms and shoulders must be completely bare.\n`;
  }

  return '';
}

export function buildMannequinSurfaceInstruction(): string {
  return `CRITICAL MANNEQUIN SURFACE & UNDERGARMENT REMOVAL: The mannequin must be dressed in the new garment. Any exposed mannequin skin/limbs (arms, legs, shoulders, neck, chest) must appear as clean, uniform, bare matte grey mannequin surface. Do NOT show, render, or bleed any grey bodysuit, collar, long sleeves, leggings, tights, or undergarments under or around the new garment — the new garment completely replaces any clothing from the reference image.
MANNEQUIN ANATOMY: Maintain natural, balanced proportions for the mannequin's arms, shoulders, and legs. When rendering sleeves, ensure clean, crisp hemlines where the sleeve fabric ends and the bare mannequin arm continues, without distortion.`;
}
