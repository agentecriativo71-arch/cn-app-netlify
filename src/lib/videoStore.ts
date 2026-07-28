import { create } from "zustand";
import { TransitionMessage } from "./transitionMessages";

export type TransitionPhase = "idle" | "exit" | "enter";

export type VideoStore = {
  /** Se uma transição entre telas/steps está em andamento */
  isTransitioning: boolean;
  /** Se o carregamento inicial no mobile está ativo */
  isInitialLoading: boolean;
  /** Se está na tela inicial aguardando interação (vídeo sempre visível, sem véu) */
  isHomeIdle: boolean;
  /** Fase atual da transição */
  transitionPhase: TransitionPhase;
  /** Mensagem exibida durante a transição */
  transitionMessage: TransitionMessage | null;
  /** Se a mensagem de transição deve estar visível (pode persistir além da troca de tela) */
  messageVisible: boolean;
  /** Dispara a transição com callback no meio (para troca de tela). messageHoldMs mantém a
   *  mensagem visível por cima da nova tela por mais tempo, sem atrasar a navegação em si. */
  triggerTransition: (onMidpoint?: () => void, durationMs?: number, customMidpointMs?: number, message?: TransitionMessage, messageHoldMs?: number) => void;
  /** Define se o carregamento inicial está ativo */
  setInitialLoading: (loading: boolean) => void;
  /** Define se está na tela inicial aguardando interação */
  setHomeIdle: (idle: boolean) => void;
  /** Reseta o estado do store */
  reset: () => void;
};

let transitionTimer: ReturnType<typeof setTimeout> | null = null;
let midpointTimer: ReturnType<typeof setTimeout> | null = null;
let messageHoldTimer: ReturnType<typeof setTimeout> | null = null;

export const useVideoStore = create<VideoStore>((set) => ({
  isTransitioning: false,
  isInitialLoading: false,
  isHomeIdle: false,
  transitionPhase: "idle",
  transitionMessage: null,
  messageVisible: false,

  triggerTransition: (onMidpoint, durationMs = 4000, customMidpointMs, message, messageHoldMs = 0) => {
    // Limpa timers anteriores se houver
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);
    if (messageHoldTimer) clearTimeout(messageHoldTimer);

    // Início: ativa vídeo e inicia fade out dos elementos atuais
    set({ isTransitioning: true, transitionPhase: "exit", transitionMessage: message || null, messageVisible: !!message });

    const midpointMs = customMidpointMs ?? Math.floor(durationMs * 0.45);

    midpointTimer = setTimeout(() => {
      if (onMidpoint) onMidpoint();
      set({ transitionPhase: "enter" });
    }, midpointMs);

    transitionTimer = setTimeout(() => {
      set({ isTransitioning: false, transitionPhase: "idle" });
    }, durationMs);

    // A mensagem pode persistir além do fim da transição da tela em si,
    // dando tempo de leitura sem atrasar a navegação.
    const messageEndMs = durationMs + messageHoldMs;
    messageHoldTimer = setTimeout(() => {
      set({ messageVisible: false, transitionMessage: null });
    }, messageEndMs);
  },

  setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),

  setHomeIdle: (idle: boolean) => set({ isHomeIdle: idle }),

  reset: () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    if (midpointTimer) clearTimeout(midpointTimer);
    if (messageHoldTimer) clearTimeout(messageHoldTimer);
    set({ isTransitioning: false, isInitialLoading: false, isHomeIdle: false, transitionPhase: "idle", transitionMessage: null, messageVisible: false });
  },
}));
