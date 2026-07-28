import { create } from "zustand";
import { TransitionMessage } from "./transitionMessages";

export type TransitionPhase = "idle" | "exit" | "enter";

export type VideoStore = {
  /** Se uma transição entre telas/steps está em andamento */
  isTransitioning: boolean;
  /** Se o carregamento inicial no mobile está ativo */
  isInitialLoading: boolean;
  /** Fase atual da transição */
  transitionPhase: TransitionPhase;
  /** Mensagem exibida durante a transição */
  transitionMessage: TransitionMessage | null;
  /** Dispara a transição com callback no meio (para troca de tela) */
  triggerTransition: (onMidpoint?: () => void, durationMs?: number, customMidpointMs?: number, message?: TransitionMessage) => void;
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
  transitionMessage: null,

  triggerTransition: (onMidpoint, durationMs = 4000, customMidpointMs, message) => {
    // Limpa timers anteriores se houver
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);

    // Início: ativa vídeo e inicia fade out dos elementos atuais
    set({ isTransitioning: true, transitionPhase: "exit", transitionMessage: message || null });

    const midpointMs = customMidpointMs ?? Math.floor(durationMs * 0.45);

    midpointTimer = setTimeout(() => {
      if (onMidpoint) onMidpoint();
      set({ transitionPhase: "enter" });
    }, midpointMs);

    transitionTimer = setTimeout(() => {
      set({ isTransitioning: false, transitionPhase: "idle", transitionMessage: null });
    }, durationMs);
  },

  setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),

  reset: () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);
    set({ isTransitioning: false, isInitialLoading: false, transitionPhase: "idle", transitionMessage: null });
  },
}));
