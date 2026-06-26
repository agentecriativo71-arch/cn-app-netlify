import { create } from "zustand";

export type LookState = {
  nome: string | null;
  ocasiao: string | null;
  biotipo: string | null;
  peca: string | null;
  comprimento: string | null;
  decote: string | null;
  manga: string | null;
  saia: string | null;
  renda: string | null;
  cor: string | null;
  comentario: string | null;
  modo: "manequim" | "foto" | null;
  fotoUrl: string | null;
  croquiUrl: string | null;
  realistaUrl: string | null;
  dbId: string | null;
  set: (patch: Partial<Omit<LookState, "set" | "reset">>) => void;
  reset: () => void;
};

const initial = {
  nome: null,
  ocasiao: null, biotipo: null, peca: null, comprimento: null,
  decote: null, manga: null, saia: null, renda: null, cor: null,
  comentario: null, modo: null, fotoUrl: null, croquiUrl: null,
  realistaUrl: null, dbId: null,
};

export const useLook = create<LookState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set(initial),
}));
