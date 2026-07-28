import { create } from "zustand";

export type TransitionPhase = "idle" | "exit" | "enter";

export type VideoStore = {
  /** Se uma transição entre telas/steps está em andamento */
  isTransitioning: boolean;
  /** Se o carregamento inicial no mobile está ativo */
  isInitialLoading: boolean;
  /** Fase atual da transição */
  transitionPhase: TransitionPhase;
  /** Dispara a transição de 3 segundos com callback no meio (para troca de tela) */
  triggerTransition: (onMidpoint?: () => void, durationMs?: number) => void;
  /** Define se o carregamento inicial está ativo */
  setInitialLoading: (loading: boolean) => void;
  /** Reseta o estado do store */
  reset: () => void;
};

let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let midpointTimer: ReturnType<typeof setTimeout> | null = null;

export const useVideoStore = create<VideoStore>((set) => ({
  isTransitioning: false,
  isInitialLoading: false,
  transitionPhase: "idle",

  triggerTransition: (onMidpoint, durationMs = 4000) => {
    // Limpa timers anteriores se houver
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);

    // Início: ativa vídeo e inicia fade out dos elementos atuais
    set({ isTransitioning: true, transitionPhase: "exit" });

    const midpointMs = Math.floor(durationMs * 0.45); // ~1.8s para troca suave do conteúdo

    midpointTimer = setTimeout(() => {
      if (onMidpoint) onMidpoint();
      set({ transitionPhase: "enter" });
    }, midpointMs);

    transitionTimer = setTimeout(() => {
      set({ isTransitioning: false, transitionPhase: "idle" });
    }, durationMs);
  },

  setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),

  reset: () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);
    set({ isTransitioning: false, isInitialLoading: false, transitionPhase: "idle" });
  },
}));
