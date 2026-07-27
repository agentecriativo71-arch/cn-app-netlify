import { describe, it, expect, beforeEach } from "vitest";
import { useVideoStore, VIDEO_CHECKPOINTS } from "@/lib/videoStore";

describe("useVideoStore", () => {
  beforeEach(() => {
    useVideoStore.getState().reset();
  });

  it("inicia com currentTime=0, targetTime=0 e isPlaying=false", () => {
    const state = useVideoStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.targetTime).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it("advance() define targetTime e isPlaying=true", () => {
    useVideoStore.getState().advance(1.5);
    const state = useVideoStore.getState();
    expect(state.targetTime).toBe(1.5);
    expect(state.isPlaying).toBe(true);
  });

  it("pause() define isPlaying=false e atualiza currentTime", () => {
    useVideoStore.getState().advance(2.5);
    useVideoStore.setState({ currentTime: 2.5 });
    useVideoStore.getState().pause();
    const state = useVideoStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(2.5);
  });

  it("reset() volta todos os valores ao estado inicial", () => {
    useVideoStore.getState().advance(5.0);
    useVideoStore.getState().reset();
    const state = useVideoStore.getState();
    expect(state.currentTime).toBe(0);
    expect(state.targetTime).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it("VIDEO_CHECKPOINTS contém todos os pontos de navegação", () => {
    expect(VIDEO_CHECKPOINTS.home).toBe(0);
    expect(VIDEO_CHECKPOINTS["criar-1"]).toBe(1.5);
    expect(VIDEO_CHECKPOINTS.resultado).toBe(9.0);
  });

  it("cada checkpoint avança em relação ao anterior", () => {
    const keys = Object.keys(VIDEO_CHECKPOINTS) as (keyof typeof VIDEO_CHECKPOINTS)[];
    for (let i = 1; i < keys.length; i++) {
      expect(VIDEO_CHECKPOINTS[keys[i]]).toBeGreaterThan(
        VIDEO_CHECKPOINTS[keys[i - 1]]
      );
    }
  });
});
