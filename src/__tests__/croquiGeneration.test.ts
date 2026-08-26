import { describe, expect, it } from "vitest";
import { buildCatalogElementPromptFragment } from "../lib/garmentPrompt";
import { buildCandidateGatePrompt, buildCroquiReferenceImageUrls, chooseCroquiCandidate, CROQUI_TEMPLATES, FEMALE_CROQUI_INVARIANT, occasionInstruction, parseCroquiGenerationRequest, scoreCroquiCandidate } from "../lib/croquiGeneration";

describe("fidelidade do croqui", () => {
  it("traduz godê simples como meio círculo e bloqueia silhuetas incompatíveis", () => {
    const prompt = buildCatalogElementPromptFragment({ saia: "Godê Simples" });
    expect(prompt).toContain("continuous half-circle");
    expect(prompt).toContain("no mermaid");
    expect(prompt).toContain("peplum");
    expect(prompt).toContain("hips, thighs and knees");
  });

  it("monta referências com manequim do biotipo e elementos do catálogo", () => {
    const urls = buildCroquiReferenceImageUrls({ biotipo: "Triângulo", decote: "V (V-Neck)", manga: "Longa (Long Sleeve)", saia: "Evasê", renda: null });
    expect(urls[0]).toContain("manequins/triangulo.jpg");
    expect(urls.some((url) => url.includes("decote-v.png"))).toBe(true);
    expect(urls.some((url) => url.includes("manga-longa.png"))).toBe(true);
    expect(urls.some((url) => url.includes("saia-evase.png"))).toBe(true);
  });

  it("mantém os quatro manequins femininos como templates canônicos", () => {
    expect(CROQUI_TEMPLATES.map((template) => template.biotipo)).toEqual([
      "Ampulheta", "Triângulo", "Triângulo Invertido", "Retângulo",
    ]);
    expect(CROQUI_TEMPLATES.every((template) => template.style.includes("black-and-white") && template.views.includes("front and back"))).toBe(true);
  });

  it("impõe invariável feminina e ocasião de fardamento", () => {
    expect(FEMALE_CROQUI_INVARIANT).toContain("adult female");
    expect(occasionInstruction("Fardamento")).toContain("women's professional uniform");
  });

  it("rejeita requisição sem peça e só escolhe candidato acima de 4/5", () => {
    expect(() => parseCroquiGenerationRequest({})).toThrow();
    const candidate = scoreCroquiCandidate({ peca: "Vestido" }, buildCandidateGatePrompt({ peca: "Vestido" }), "https://example.test/croqui.png", 1);
    expect(chooseCroquiCandidate([candidate]).score).toBe(5);
    expect(() => chooseCroquiCandidate([{ ...candidate, score: 3 }])).toThrow();
  });

  it("trata evidência masculina como falha eliminatória", () => {
    const candidate = scoreCroquiCandidate(
      { peca: "Vestido" },
      buildCandidateGatePrompt({ peca: "Vestido" }),
      "https://example.test/croqui.png",
      2,
      { peca: { value: "Vestido", confidence: 0.95, evidence: "male mannequin visible" } },
    );
    expect(candidate.rejected).toBe(true);
    expect(candidate.rejectionReasons).toContain("male_figure_visual_mismatch");
  });
});
