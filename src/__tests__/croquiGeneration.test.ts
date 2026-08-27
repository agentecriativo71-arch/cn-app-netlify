import { describe, expect, it } from "vitest";
import { buildCatalogElementPromptFragment } from "../lib/garmentPrompt";
import {
  buildCandidateGatePrompt,
  buildCroquiReferenceImageUrls,
  buildCroquiVisionAssessment,
  chooseCroquiCandidate,
  CROQUI_CANDIDATE_COUNT,
  CROQUI_TEMPLATES,
  FEMALE_CROQUI_INVARIANT,
  occasionInstruction,
  parseCroquiGenerationRequest,
  rankCroquiCandidates,
  scoreCroquiCandidate,
} from "../lib/croquiGeneration";

describe("fidelidade do croqui", () => {
  it("traduz godê simples como meio círculo e bloqueia silhuetas incompatíveis", () => {
    const prompt = buildCatalogElementPromptFragment({ saia: "Godê Simples" });
    expect(prompt).toContain("continuous half-circle");
    expect(prompt).toContain("no mermaid");
    expect(prompt).toContain("peplum");
    expect(prompt).toContain("hips, thighs and knees");
  });

  it("monta referências com manequim do biotipo e elementos do catálogo", () => {
    const urls = buildCroquiReferenceImageUrls({
      biotipo: "Triângulo",
      decote: "V (V-Neck)",
      manga: "Longa (Long Sleeve)",
      saia: "Evasê",
      renda: null,
    });
    expect(urls[0]).toContain("manequins/triangulo.jpg");
    expect(urls.some((url) => url.includes("decote-v.png"))).toBe(true);
    expect(urls.some((url) => url.includes("manga-longa.png"))).toBe(true);
    expect(urls.some((url) => url.includes("saia-evase.png"))).toBe(true);
  });

  it("mantém os quatro manequins femininos como templates canônicos", () => {
    expect(CROQUI_TEMPLATES.map((template) => template.biotipo)).toEqual([
      "Ampulheta",
      "Triângulo",
      "Triângulo Invertido",
      "Retângulo",
    ]);
    expect(
      CROQUI_TEMPLATES.every(
        (template) =>
          template.style.includes("black-and-white") &&
          template.views.includes("front and back"),
      ),
    ).toBe(true);
  });

  it("impõe invariável feminina e ocasião de fardamento", () => {
    expect(FEMALE_CROQUI_INVARIANT).toContain("adult female");
    expect(occasionInstruction("Fardamento")).toContain(
      "women's professional uniform",
    );
  });

  it("rejeita requisição sem peça e escolhe o melhor candidato elegível", () => {
    expect(() => parseCroquiGenerationRequest({})).toThrow();
    const candidate = scoreCroquiCandidate(
      { peca: "Vestido" },
      buildCandidateGatePrompt({ peca: "Vestido" }),
      "https://example.test/croqui.png",
      1,
    );
    expect(chooseCroquiCandidate([candidate]).score).toBe(5);
    expect(chooseCroquiCandidate([{ ...candidate, score: 3 }]).score).toBe(3);
  });

  it("trata evidência masculina como falha eliminatória", () => {
    const candidate = scoreCroquiCandidate(
      { peca: "Vestido" },
      buildCandidateGatePrompt({ peca: "Vestido" }),
      "https://example.test/croqui.png",
      2,
      {
        peca: {
          value: "Vestido",
          confidence: 0.95,
          evidence: "male mannequin visible",
        },
      },
    );
    expect(candidate.rejected).toBe(true);
    expect(candidate.rejectionReasons).toContain("male_figure_visual_mismatch");
  });

  it("gera exatamente quatro candidatos e classifica maior nota após todas as tentativas", () => {
    expect(CROQUI_CANDIDATE_COUNT).toBe(4);
    const base = scoreCroquiCandidate(
      { peca: "Vestido", decote: "V (V-Neck)" },
      buildCandidateGatePrompt({ peca: "Vestido" }),
      "https://example.test/croqui.png",
      1,
      {
        peca: {
          value: "Vestido",
          confidence: 0.8,
          evidence: "Vestido visível.",
        },
        decote: {
          value: "V (V-Neck)",
          confidence: 0.8,
          evidence: "Decote em V visível.",
        },
      },
      1,
    );
    const lower = { ...base, attempt: 2, seed: 2, score: 2.5 };
    const ranked = rankCroquiCandidates([lower, base]);
    expect(ranked[0]).toMatchObject({ seed: 1, rank: 1, selected: true });
    expect(ranked[1]).toMatchObject({ seed: 2, rank: 2, selected: false });
  });

  it("persiste critérios com valor observado, confiança, evidência e nota técnica", () => {
    const assessment = buildCroquiVisionAssessment(
      { peca: "Saia", comprimento: "Midi", saia: "Evasê" },
      {
        peca: { value: "Saia", confidence: 0.9, evidence: "Saia visível." },
        comprimento: {
          value: "Midi",
          confidence: 0.8,
          evidence: "A barra termina na panturrilha.",
        },
        saia: {
          value: "Evasê",
          confidence: 0.95,
          evidence: "Silhueta evasê visível.",
        },
      },
    );
    expect(assessment).toMatchObject({
      schemaVersion: "croqui-vision-assessment-v1",
      technicalScore: expect.any(Number),
      averageConfidence: expect.any(Number),
    });
    expect(assessment?.criteria.comprimento).toEqual(
      expect.objectContaining({
        observed: "Midi",
        confidence: 0.8,
        evidence: "A barra termina na panturrilha.",
        matched: true,
      }),
    );
  });
});
