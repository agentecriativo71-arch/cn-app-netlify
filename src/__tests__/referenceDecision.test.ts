import { describe, expect, it } from "vitest";
import { decideReferenceAnalysis } from "../lib/referenceDecision";
import { REFERENCE_ANALYSIS_VERSION, type ReferenceAnalysis } from "../lib/referenceUtils";

function analysis(overrides: Partial<ReferenceAnalysis> = {}): ReferenceAnalysis {
  const observed = (value: any, confidence = 0.9) => ({ value, confidence, evidence: "Visível no recorte.", sourceRole: "single" as const });
  const base: ReferenceAnalysis = {
    schemaVersion: REFERENCE_ANALYSIS_VERSION,
    mode: "single",
    focus: [{ role: "single", status: "identified", targetDescription: "Vestido central", candidateCount: 1, confidence: 0.9, evidence: "Alvo predominante." }],
    peca: observed("Vestido"), comprimento: observed("Midi"), decote: observed(null), possuiManga: observed(null), manga: observed(null), saia: observed(null), rendaDecisao: observed(null), renda: observed(null),
    detalhesTecnicos: { corpete: observed(null), cintura: observed(null), caimento: observed(null), volume: observed(null), barra: observed(null), transparencia: observed(null), tecido: observed(null), costas: observed(null), fechamento: observed(null) },
  };
  return { ...base, ...overrides };
}

describe("decisão server-side da análise de referência", () => {
  it("solicita novo recorte para foco ambíguo ou fraco", () => {
    const result = decideReferenceAnalysis({ ...analysis(), focus: [{ ...analysis().focus[0], status: "ambiguous", confidence: 0.4 }] });
    expect(result).toMatchObject({ status: "needs_recrop", retryable: true, code: "focus_below_threshold" });
  });

  it("não inventa peça quando o tipo não é suportado", () => {
    const result = decideReferenceAnalysis({ ...analysis(), peca: { ...analysis().peca, value: null, confidence: 0 } });
    expect(result).toMatchObject({ status: "unsupported_garment", retryable: false });
  });

  it("bloqueia peça identificada com confiança insuficiente", () => {
    const result = decideReferenceAnalysis({ ...analysis(), peca: { ...analysis().peca, confidence: 0.74 } });
    expect(result.code).toBe("piece_below_threshold");
  });

  it("solicita novo recorte quando a análise contradiz a peça escolhida", () => {
    const result = decideReferenceAnalysis(analysis(), "Saia");
    expect(result).toMatchObject({ status: "needs_recrop", retryable: true, code: "selected_piece_mismatch" });
  });

  it("libera somente uma análise pronta", () => {
    expect(decideReferenceAnalysis(analysis())).toMatchObject({ status: "analysis_ready", retryable: false });
  });
});
