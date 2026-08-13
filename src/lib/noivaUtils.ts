const SUPABASE_ELEMENTOS_URL = 'https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos';

export const MANNEQUIN_URLS: Record<string, string> = {
  "Ampulheta":           `${SUPABASE_ELEMENTOS_URL}/manequins/ampulheta.jpg`,
  "Triângulo":           `${SUPABASE_ELEMENTOS_URL}/manequins/triangulo.jpg`,
  "Triângulo Invertido": `${SUPABASE_ELEMENTOS_URL}/manequins/triangulo_invertido.jpg`,
  "Retângulo":           `${SUPABASE_ELEMENTOS_URL}/manequins/retangulo.jpg`,
};

export function getMannequinUrl(biotipo?: string | null): string | null {
  if (!biotipo) return null;
  return MANNEQUIN_URLS[biotipo] || null;
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
      state.comentario?.trim()
    );
  }

  return !!(state.peca && state.biotipo);
}
