import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type ScreenTutorial,
  TUTORIAL_DATA,
  isTutorialCompleted,
  markTutorialCompleted,
  resetTutorialCompleted,
} from "@/lib/tutorialData";

// ── Types ────────────────────────────────────────────────────────

export type TutorialState = {
  /** Tela ativa no momento */
  activeScreen: string | null;
  /** Spotlight ativo? */
  spotlightActive: boolean;
  /** Index do step atual do spotlight */
  spotlightStepIndex: number;
  /** Coach Bubble expandida? */
  bubbleOpen: boolean;
  /** Dados do tutorial da tela ativa */
  currentTutorial: ScreenTutorial | null;
};

export type TutorialActions = {
  /** Registra uma tela — dispara spotlight se primeiro acesso */
  registerScreen: (screenKey: string) => void;
  /** Desregistra a tela ativa */
  unregisterScreen: () => void;
  /** Avança pro próximo step do spotlight */
  nextStep: () => void;
  /** Pula/fecha o spotlight */
  skipSpotlight: () => void;
  /** Toggle da coach bubble */
  toggleBubble: () => void;
  /** Fecha a bubble */
  closeBubble: () => void;
  /** Revê o tutorial (reseta flag e abre spotlight) */
  reviewTutorial: () => void;
};

export type TutorialContextValue = TutorialState & TutorialActions;

// ── Context ──────────────────────────────────────────────────────

const TutorialContext = createContext<TutorialContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TutorialState>({
    activeScreen: null,
    spotlightActive: false,
    spotlightStepIndex: 0,
    bubbleOpen: false,
    currentTutorial: null,
  });

  // Evita disparo duplo em StrictMode
  const registeredRef = useRef<string | null>(null);

  const registerScreen = useCallback((screenKey: string) => {
    const tutorial = TUTORIAL_DATA[screenKey];
    if (!tutorial) return;

    registeredRef.current = screenKey;

    const completed = isTutorialCompleted(screenKey);

    setState({
      activeScreen: screenKey,
      currentTutorial: tutorial,
      spotlightActive: !completed,
      spotlightStepIndex: 0,
      bubbleOpen: false,
    });
  }, []);

  const unregisterScreen = useCallback(() => {
    registeredRef.current = null;
    setState({
      activeScreen: null,
      spotlightActive: false,
      spotlightStepIndex: 0,
      bubbleOpen: false,
      currentTutorial: null,
    });
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (!prev.currentTutorial || !prev.spotlightActive) return prev;
      const maxIndex = prev.currentTutorial.steps.length - 1;
      if (prev.spotlightStepIndex >= maxIndex) {
        // Último step — fechar spotlight e marcar como completo
        if (prev.activeScreen) {
          markTutorialCompleted(prev.activeScreen);
        }
        return { ...prev, spotlightActive: false, spotlightStepIndex: 0 };
      }
      return { ...prev, spotlightStepIndex: prev.spotlightStepIndex + 1 };
    });
  }, []);

  const skipSpotlight = useCallback(() => {
    setState((prev) => {
      if (prev.activeScreen) {
        markTutorialCompleted(prev.activeScreen);
      }
      return { ...prev, spotlightActive: false, spotlightStepIndex: 0 };
    });
  }, []);

  const toggleBubble = useCallback(() => {
    setState((prev) => ({ ...prev, bubbleOpen: !prev.bubbleOpen }));
  }, []);

  const closeBubble = useCallback(() => {
    setState((prev) => ({ ...prev, bubbleOpen: false }));
  }, []);

  const reviewTutorial = useCallback(() => {
    setState((prev) => {
      if (prev.activeScreen) {
        resetTutorialCompleted(prev.activeScreen);
      }
      return {
        ...prev,
        spotlightActive: true,
        spotlightStepIndex: 0,
        bubbleOpen: false,
      };
    });
  }, []);

  const value: TutorialContextValue = {
    ...state,
    registerScreen,
    unregisterScreen,
    nextStep,
    skipSpotlight,
    toggleBubble,
    closeBubble,
    reviewTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return ctx;
}

/**
 * Hook para registrar uma tela no sistema de tutorial.
 * Dispara spotlight automaticamente no primeiro acesso.
 */
export function useTutorialScreen(screenKey: string) {
  const tutorial = useTutorial();

  useEffect(() => {
    // Delay pra garantir que elementos com data-tutorial já montaram
    const timer = setTimeout(() => {
      tutorial.registerScreen(screenKey);
    }, 500);

    return () => {
      clearTimeout(timer);
      tutorial.unregisterScreen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  return tutorial;
}
