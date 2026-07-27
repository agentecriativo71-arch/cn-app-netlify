import { create } from "zustand";

// ── Checkpoint de tempo por rota/step ─────────────────────────────
// Mapa que define em qual segundo do vídeo cada tela "para"
export const VIDEO_CHECKPOINTS = {
  home: 0,
  "criar-1": 1.5,
  "criar-2": 2.5,
  "criar-3": 3.5,
  "criar-4": 4.2,
  "criar-5": 4.8,
  "criar-6": 5.3,
  "criar-7": 5.8,
  "criar-8": 6.2,
  "criar-9": 6.5,
  croqui: 7.2,
  realista: 8.0,
  resultado: 9.0,
} as const;

export type VideoCheckpointKey = keyof typeof VIDEO_CHECKPOINTS;

export type VideoStore = {
  /** Posição atual pausada do vídeo (em segundos) */
  currentTime: number;
  /** Posição alvo para avançar até (em segundos) */
  targetTime: number;
  /** Se o vídeo está em movimento */
  isPlaying: boolean;
  /** Avança o vídeo até um novo checkpoint */
  advance: (target: number) => void;
  /** Pausa no tempo atual */
  pause: () => void;
  /** Reseta para o início */
  reset: () => void;
};

export const useVideoStore = create<VideoStore>((set) => ({
  currentTime: 0,
  targetTime: 0,
  isPlaying: false,

  advance: (target: number) =>
    set({ targetTime: target, isPlaying: true }),

  pause: () =>
    set((state) => ({ isPlaying: false, currentTime: state.targetTime })),

  reset: () =>
    set({ currentTime: 0, targetTime: 0, isPlaying: false }),
}));
