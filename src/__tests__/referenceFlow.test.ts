import { describe, expect, it } from "vitest";
import {
  CATALOG_ELEMENTS,
  CATALOG_VALUES,
  REFERENCE_ANALYSIS_VERSION,
  buildVisionPromptForCompositeReference,
  buildVisionPromptForReferencePart,
  buildVisionPromptForSingleReference,
  getReferenceAnalysisJsonSchema,
  mergeCompositeReferenceAnalyses,
  normalizeReferenceAnalysis,
  referenceAnalysisSchema,
  referenceAnalysisToCroquiSpecs,
  validateReferenceAnalysisForMode,
} from "../lib/referenceUtils";

const observed = (value: unknown, sourceRole: "single" | "top" | "bottom" | null = "single", confidence = 0.92) => ({
  value, confidence, evidence: "Elemento visível no recorte selecionado.", sourceRole,
});

const focus = (role: "single" | "top" | "bottom", status = "identified", confidence = 0.95) => ({
  role, status, targetDescription: "Pessoa/roupa principal no recorte", candidateCount: 1, confidence, evidence: "Alvo central e visualmente predominante.",
});

function analysisInput(mode: "single" | "composite" = "single") {
  const role = mode === "single" ? "single" : "top";
  const roles = mode === "single" ? [focus("single")] : [focus("top"), focus("bottom")];
  return {
    schemaVersion: REFERENCE_ANALYSIS_VERSION,
    mode,
    focus: roles,
    peca: observed("Vestido", role), comprimento: observed("Midi", mode === "single" ? "single" : "bottom"),
    decote: observed("V (V-Neck)", role), possuiManga: observed(false, role), manga: observed(null, role),
    saia: observed("Evasê", mode === "single" ? "single" : "bottom"), rendaDecisao: observed(false, role), renda: observed(null, role),
    detalhesTecnicos: {
      corpete: observed("Corpete estruturado", role), cintura: observed("Cintura marcada", role), caimento: observed("Caimento fluido", mode === "single" ? "single" : "bottom"),
      volume: observed("Volume moderado", mode === "single" ? "single" : "bottom"), barra: observed("Barra visível", mode === "single" ? "single" : "bottom"),
      transparencia: observed(null, role), tecido: observed(null, role), costas: observed(null, role), fechamento: observed(null, role),
    },
  };
}

describe("Contrato reference-analysis-v1", () => {
  it("deriva todos os valores válidos diretamente do catálogo", () => {
    expect(CATALOG_VALUES.manga).toContain("Curta (Short Sleeve)");
    expect(CATALOG_VALUES.saia).toContain("Godê Simples");
    expect(CATALOG_VALUES.renda).toContain("Renda Inteira");
    expect(CATALOG_VALUES.decote).toContain("V (V-Neck)");
    expect(CATALOG_VALUES.manga).not.toContain("Manga Curta");
    expect(CATALOG_VALUES.saia).not.toContain("Godê");
  });

  it("inclui foco, privacidade, ocasião, nomes e diretrizes do catálogo no prompt", () => {
    const prompt = buildVisionPromptForSingleReference("Noiva");
    expect(prompt).toContain(REFERENCE_ANALYSIS_VERSION);
    expect(prompt).toContain("user-selected crop");
    expect(prompt).toContain("Never identify a person");
    expect(prompt).toContain("Noiva");
    expect(prompt).toContain("MANGA (use the exact catalog name before the colon)");
    expect(prompt).toContain(CATALOG_ELEMENTS[0].nome);
    expect(prompt).toContain(CATALOG_ELEMENTS[0].diretrizes);
    for (const values of Object.values(CATALOG_VALUES)) for (const value of values) expect(prompt).toContain(value);
  });

  it("preserva modo e ordem top/bottom no prompt composto", () => {
    const prompt = buildVisionPromptForCompositeReference("Festa");
    expect(prompt).toContain('analysis mode is "composite"');
    expect(prompt).toContain('IMAGE 1 is role "top"');
    expect(prompt).toContain('IMAGE 2 is role "bottom"');
    expect(prompt.indexOf("IMAGE 1")).toBeLessThan(prompt.indexOf("IMAGE 2"));
    expect(prompt).toContain("Manga is a garment-level field and may be evidenced by either crop");
    expect(prompt).toContain("same fabric, color or person");
  });

  it("delimita escopo superior e inferior nos prompts de análise por parte", () => {
    const topPrompt = buildVisionPromptForReferencePart("top", "Festa", "Vestido");
    const bottomPrompt = buildVisionPromptForReferencePart("bottom", "Festa", "Vestido");
    expect(topPrompt).toContain("upper garment crop");
    expect(topPrompt).toContain("decote, manga, possuiManga, corpete, cintura");
    expect(bottomPrompt).toContain("lower garment crop");
    expect(bottomPrompt).toContain("comprimento, saia, caimento, volume, barra");
    expect(topPrompt).toContain("never infer");
    expect(bottomPrompt).toContain("never infer");
  });

  it("rejeita aliases fora do catálogo e propriedades extras", () => {
    expect(() => normalizeReferenceAnalysis({ ...analysisInput(), manga: observed("Manga Curta"), saia: observed("Godê") }, "single", "single")).toThrow("fora do catálogo");
    const parsed = referenceAnalysisSchema.safeParse({ ...normalizeReferenceAnalysis(analysisInput(), "single", "single"), unexpected: true });
    expect(parsed.success).toBe(false);
  });

  it("rejeita confiança fora do intervalo permitido", () => {
    expect(() => normalizeReferenceAnalysis({ ...analysisInput(), peca: observed("Vestido", "single", 1.01) }, "single", "single")).toThrow(/0 e 1/i);
    expect(() => normalizeReferenceAnalysis({ ...analysisInput(), focus: [focus("single", "identified", -0.1)] }, "single", "single")).toThrow(/0 e 1/i);
  });

  it("aceita todos os nomes reais do catálogo nas quatro dimensões", () => {
    for (const [field, values] of Object.entries(CATALOG_VALUES)) {
      for (const value of values) {
        const candidate = { ...analysisInput(), [field]: observed(value) };
        expect(referenceAnalysisSchema.safeParse(candidate).success, `${field}: ${value}`).toBe(true);
      }
    }
  });

  it("mantém foco ambíguo e campos desconhecidos sem defaults", () => {
    const analysis = normalizeReferenceAnalysis({
      ...analysisInput(),
      focus: [focus("single", "ambiguous", 0.4)],
      peca: observed(null, null, 0), comprimento: observed(null, null, 0), decote: observed(null, null, 0),
      possuiManga: observed(null, null, 0), manga: observed(null, null, 0), saia: observed(null, null, 0), rendaDecisao: observed(null, null, 0), renda: observed(null, null, 0),
    }, "single", "single");
    expect(analysis.focus[0].status).toBe("ambiguous");
    expect(analysis.peca.value).toBeNull();
    expect(analysis.rendaDecisao.value).toBeNull();
    expect(analysis.detalhesTecnicos.tecido.value).toBeNull();
  });

  it("mantém sem manga, manga desconhecida e baixa confiança semanticamente distintos", () => {
    const sleeveless = normalizeReferenceAnalysis({ ...analysisInput(), possuiManga: observed(false), manga: observed("Curta (Short Sleeve)") }, "single", "single");
    expect(sleeveless.possuiManga.value).toBe(false);
    expect(sleeveless.manga.value).toBeNull();

    const unknownSleeve = normalizeReferenceAnalysis({ ...analysisInput(), possuiManga: observed(true), manga: observed(null) }, "single", "single");
    expect(unknownSleeve.possuiManga.value).toBe(true);
    expect(unknownSleeve.manga.value).toBeNull();

    const lowCatalog = normalizeReferenceAnalysis({ ...analysisInput(), decote: observed("V (V-Neck)", "single", 0.4) }, "single", "single");
    expect(referenceAnalysisToCroquiSpecs(lowCatalog).decote).toBeNull();

    const lowTechnical = normalizeReferenceAnalysis({ ...analysisInput(), comprimento: observed("Longo", "single", 0.4), possuiManga: observed(false, "single", 0.4), detalhesTecnicos: { ...analysisInput().detalhesTecnicos, tecido: observed("tecido não confirmado", "single", 0.4) } }, "single", "single");
    expect(referenceAnalysisToCroquiSpecs(lowTechnical).comprimento).toBeNull();
    expect(referenceAnalysisToCroquiSpecs(lowTechnical).possuiManga).toBeNull();
    expect(referenceAnalysisToCroquiSpecs(lowTechnical).comentario).not.toContain("tecido não confirmado");
  });

  it("envia extras legados para geração sem transformar punho ajustado em elástico", () => {
    const analysis = normalizeReferenceAnalysis({
      ...analysisInput(),
      providerExtras: [
        { path: "detalhesTecnicos.manga.punho", value: "Ajustado", confidence: 0.9, evidence: "Punho visível.", sourceRole: "single", visibleEvidence: true },
      ],
    }, "single", "single");

    const specs = referenceAnalysisToCroquiSpecs(analysis);
    expect(specs.comentario).toContain("detalhesTecnicos.manga.punho: Ajustado");
    expect(specs.comentario).toContain("não adicionar elástico no punho");
  });

  it("só instrui elástico quando extra explícito tem confiança suficiente", () => {
    const analysis = normalizeReferenceAnalysis({
      ...analysisInput(),
      providerExtras: [
        { path: "detalhesTecnicos.manga.punho", value: "Ajustado", confidence: 0.9, evidence: "Punho visível.", sourceRole: "single" },
        { path: "detalhesTecnicos.manga.elastico", value: true, confidence: 0.9, evidence: "Elástico visível.", sourceRole: "single" },
      ],
    }, "single", "single");

    const specs = referenceAnalysisToCroquiSpecs(analysis);
    expect(specs.comentario).toContain("detalhesTecnicos.manga.elastico: true");
    expect(specs.comentario).not.toContain("não adicionar elástico no punho");
  });

  it("valida ordem dos focos e sintetiza composição como vestido", () => {
    const composite = normalizeReferenceAnalysis(analysisInput("composite"), "top", "composite");
    const validated = validateReferenceAnalysisForMode(composite, "composite");
    expect(validated.focus.map((item) => item.role)).toEqual(["top", "bottom"]);
    expect(validated.peca.value).toBe("Vestido");
    expect(referenceAnalysisToCroquiSpecs(validated).peca).toBe("Vestido");
  });

  it("rejeita evidência atribuída ao papel errado no modo composto", () => {
    const topEvidence = normalizeReferenceAnalysis({ ...analysisInput("composite"), decote: observed("V (V-Neck)", "bottom") }, "top", "composite");
    const bottomEvidence = normalizeReferenceAnalysis({ ...analysisInput("composite"), saia: observed("Evasê", "top") }, "top", "composite");

    expect(() => validateReferenceAnalysisForMode(topEvidence, "composite")).toThrow("campo superior");
    expect(() => validateReferenceAnalysisForMode(bottomEvidence, "composite")).toThrow("campo inferior");
  });

  it("funde duas análises sem permitir que a parte inferior sobrescreva a superior", () => {
    const top = normalizeReferenceAnalysis({
      ...analysisInput(),
      peca: observed("Vestido"),
      decote: observed("Quadrado (Square)", "single"),
      possuiManga: observed(true),
      manga: observed("Longa (Long Sleeve)"),
      saia: observed(null),
    }, "single", "single");
    const bottom = normalizeReferenceAnalysis({
      ...analysisInput(),
      peca: observed("Vestido"),
      decote: observed("V (V-Neck)"),
      possuiManga: observed(false),
      manga: observed(null),
      saia: observed("Evasê"),
      comprimento: observed("Midi"),
    }, "single", "single");

    const merged = mergeCompositeReferenceAnalyses({ top, bottom, targetPiece: "Vestido" });

    expect(merged.mode).toBe("composite");
    expect(merged.focus.map((item) => item.role)).toEqual(["top", "bottom"]);
    expect(merged.decote).toMatchObject({ value: "Quadrado (Square)", sourceRole: "top" });
    expect(merged.possuiManga).toMatchObject({ value: true, sourceRole: "top" });
    expect(merged.manga).toMatchObject({ value: "Longa (Long Sleeve)", sourceRole: "top" });
    expect(merged.saia).toMatchObject({ value: "Evasê", sourceRole: "bottom" });
    expect(merged.comprimento).toMatchObject({ value: "Midi", sourceRole: "bottom" });
  });

  it("mantém campos ausentes nulos e marca origem dos extras", () => {
    const top = normalizeReferenceAnalysis({
      ...analysisInput(),
      providerExtras: [{ path: "detalhesTecnicos.manga.punho", value: "Ajustado", confidence: 0.9, evidence: "Punho visível.", sourceRole: "single" }],
    }, "single", "single");
    const bottom = normalizeReferenceAnalysis({
      ...analysisInput(),
      decote: observed(null),
      manga: observed(null),
      possuiManga: observed(null),
      providerExtras: [{ path: "detalhesTecnicos.saia.camadas", value: "Sim", confidence: 0.9, evidence: "Camadas visíveis.", sourceRole: "single" }],
    }, "single", "single");

    const merged = mergeCompositeReferenceAnalyses({ top, bottom, targetPiece: "Vestido" });

    expect(merged.decote.value).toBe("V (V-Neck)");
    expect(merged.providerExtras).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "top.detalhesTecnicos.manga.punho", sourceRole: "top" }),
      expect.objectContaining({ path: "bottom.detalhesTecnicos.saia.camadas", sourceRole: "bottom" }),
    ]));
  });

  it("não usa bottom como fallback para campos exclusivos de top", () => {
    const top = normalizeReferenceAnalysis({
      ...analysisInput(),
      decote: observed(null),
      possuiManga: observed(null),
      manga: observed(null),
    }, "single", "single");
    const bottom = normalizeReferenceAnalysis({
      ...analysisInput(),
      decote: observed("Quadrado (Square)"),
      possuiManga: observed(true),
      manga: observed("Longa (Long Sleeve)"),
    }, "single", "single");

    const merged = mergeCompositeReferenceAnalyses({ top, bottom, targetPiece: "Vestido" });

    expect(merged.decote.value).toBeNull();
    expect(merged.possuiManga.value).toBeNull();
    expect(merged.manga.value).toBeNull();
  });

  it("expõe schema estrito com campos exatos e obrigatórios", () => {
    const schema = getReferenceAnalysisJsonSchema() as { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining(["schemaVersion", "mode", "focus", "detalhesTecnicos"]));
    expect(schema.required).not.toContain("detalhes_extras");
    expect(schema.properties.detalhesTecnicos).toBeDefined();
  });
});
