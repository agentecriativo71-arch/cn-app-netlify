import { describe, it, expect, beforeEach } from "vitest";
import {
  TUTORIAL_DATA,
  getTutorialStorageKey,
  isTutorialCompleted,
  markTutorialCompleted,
  resetTutorialCompleted,
} from "@/lib/tutorialData";

describe("tutorialData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("TUTORIAL_DATA", () => {
    it("contém dados para todas as telas principais", () => {
      expect(TUTORIAL_DATA.home).toBeDefined();
      expect(TUTORIAL_DATA.croqui).toBeDefined();
      expect(TUTORIAL_DATA.realista).toBeDefined();
      expect(TUTORIAL_DATA.resultado).toBeDefined();
    });

    it("contém dados para todos os steps da tela Criar", () => {
      const criarSteps = [
        "criar_ocasiao",
        "criar_peca",
        "criar_biotipo",
        "criar_comprimento",
        "criar_decote",
        "criar_manga",
        "criar_saia",
        "criar_renda",
        "criar_comentario",
      ];
      criarSteps.forEach((key) => {
        expect(TUTORIAL_DATA[key]).toBeDefined();
        expect(TUTORIAL_DATA[key].steps.length).toBeGreaterThan(0);
        expect(TUTORIAL_DATA[key].bubbleText).toBeTruthy();
      });
    });

    it("cada tutorial tem screenKey, bubbleText e steps com targetSelector", () => {
      Object.entries(TUTORIAL_DATA).forEach(([key, tutorial]) => {
        expect(tutorial.screenKey).toBe(key);
        expect(tutorial.bubbleText).toBeTruthy();
        expect(tutorial.steps.length).toBeGreaterThan(0);
        tutorial.steps.forEach((step) => {
          expect(step.targetSelector).toBeTruthy();
          expect(step.title).toBeTruthy();
          expect(step.text).toBeTruthy();
        });
      });
    });
  });

  describe("localStorage helpers", () => {
    it("getTutorialStorageKey retorna chave correta", () => {
      expect(getTutorialStorageKey("home")).toBe("tutorial_completed_home");
      expect(getTutorialStorageKey("criar_peca")).toBe(
        "tutorial_completed_criar_peca"
      );
    });

    it("isTutorialCompleted retorna false quando não completado", () => {
      expect(isTutorialCompleted("home")).toBe(false);
    });

    it("markTutorialCompleted marca como completado", () => {
      markTutorialCompleted("home");
      expect(isTutorialCompleted("home")).toBe(true);
    });

    it("resetTutorialCompleted reseta o estado", () => {
      markTutorialCompleted("home");
      expect(isTutorialCompleted("home")).toBe(true);
      resetTutorialCompleted("home");
      expect(isTutorialCompleted("home")).toBe(false);
    });

    it("telas diferentes são independentes", () => {
      markTutorialCompleted("home");
      expect(isTutorialCompleted("home")).toBe(true);
      expect(isTutorialCompleted("croqui")).toBe(false);
    });
  });
});
