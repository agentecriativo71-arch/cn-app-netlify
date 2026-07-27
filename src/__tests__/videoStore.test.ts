import { describe, it, expect, beforeEach, vi } from "vitest";
import { useVideoStore } from "@/lib/videoStore";

describe("useVideoStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useVideoStore.getState().reset();
  });

  it("inicia em repouso (isTransitioning=false, transitionPhase='idle')", () => {
    const state = useVideoStore.getState();
    expect(state.isTransitioning).toBe(false);
    expect(state.transitionPhase).toBe("idle");
  });

  it("triggerTransition ativa a fase 'exit' e isTransitioning=true", () => {
    useVideoStore.getState().triggerTransition();
    const state = useVideoStore.getState();
    expect(state.isTransitioning).toBe(true);
    expect(state.transitionPhase).toBe("exit");
  });

  it("executa onMidpoint e entra na fase 'enter' no meio do tempo", () => {
    const onMidpoint = vi.fn();
    useVideoStore.getState().triggerTransition(onMidpoint, 4000);

    vi.advanceTimersByTime(1800);

    expect(onMidpoint).toHaveBeenCalledTimes(1);
    expect(useVideoStore.getState().transitionPhase).toBe("enter");
    expect(useVideoStore.getState().isTransitioning).toBe(true);
  });

  it("finaliza a transição após os 4000ms", () => {
    useVideoStore.getState().triggerTransition(undefined, 4000);

    vi.advanceTimersByTime(4000);

    expect(useVideoStore.getState().isTransitioning).toBe(false);
    expect(useVideoStore.getState().transitionPhase).toBe("idle");
  });

  it("reset limpa qualquer transição ativa", () => {
    useVideoStore.getState().triggerTransition(undefined, 3000);
    useVideoStore.getState().reset();

    expect(useVideoStore.getState().isTransitioning).toBe(false);
    expect(useVideoStore.getState().transitionPhase).toBe("idle");
  });
});
