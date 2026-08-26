import { create } from "zustand";

export type LookState = {
  nome: string | null;
  ocasiao: string | null;
  tipoCerimonia: string | null;
  rendaDecisao: boolean | null;
  biotipo: string | null;
  peca: string | null;
  comprimento: string | null;
  decote: string | null;
  manga: string | null;
  possuiManga: boolean | null;
  saia: string | null;
  renda: string | null;
  cor: string | null;
  tecidoSku: string | null;
  tecidoNome: string | null;
  tecidoImageUrl: string | null;
  tecidoPantone: string | null;
  comentario: string | null;
  modo: "manequim" | "foto" | null;
  fotoUrl: string | null;
  croquiUrl: string | null;
  realistaUrl: string | null;
  croquiUploadSessionId: string | null;
  executionId: string | null;
  croquiArtifactId: string | null;
  realistaArtifactId: string | null;
  trackingStatus: "healthy" | "degraded" | null;
  costasProposta: boolean;
  dbId: string | null;
  set: (patch: Partial<Omit<LookState, "set" | "reset">>) => void;
  reset: () => void;
};

const initial = {
  nome: null,
  ocasiao: null, tipoCerimonia: null, rendaDecisao: null, biotipo: null, peca: null, comprimento: null,
  decote: null, manga: null, possuiManga: null, saia: null, renda: null, cor: null,
  tecidoSku: null, tecidoNome: null, tecidoImageUrl: null, tecidoPantone: null,
  comentario: null, modo: null, fotoUrl: null, croquiUrl: null,
  realistaUrl: null, croquiUploadSessionId: null, costasProposta: false, dbId: null,
  executionId: null, croquiArtifactId: null, realistaArtifactId: null, trackingStatus: null,
};

export const useLook = create<LookState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));
