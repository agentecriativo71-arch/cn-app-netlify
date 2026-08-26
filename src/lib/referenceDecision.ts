import { REFERENCE_CATALOG_CONFIDENCE_THRESHOLD, REFERENCE_FOCUS_CONFIDENCE_THRESHOLD, type ReferenceAnalysis, type ReferencePiece } from "./referenceUtils";

export type AnalysisDecision = {
  status: "analysis_ready" | "needs_recrop" | "unsupported_garment";
  code: string | null;
  retryable: boolean;
  message: string | null;
};

export function decideReferenceAnalysis(analysis: ReferenceAnalysis, targetPiece?: ReferencePiece | null): AnalysisDecision {
  const focusNeedsRecrop = analysis.focus.some((focus) => focus.status !== "identified" || focus.confidence < REFERENCE_FOCUS_CONFIDENCE_THRESHOLD);
  if (focusNeedsRecrop) return { status: "needs_recrop", code: "focus_below_threshold", retryable: true, message: "Recorte novamente deixando somente a pessoa ou roupa principal claramente visível." };
  if (!analysis.peca.value) return { status: "unsupported_garment", code: "unsupported_garment", retryable: false, message: "A peça principal não corresponde a um tipo de roupa suportado." };
  if (targetPiece && analysis.peca.value !== targetPiece) return { status: "needs_recrop", code: "selected_piece_mismatch", retryable: true, message: `O recorte não corresponde à peça selecionada (${targetPiece}). Envie um recorte dessa peça.` };
  if (analysis.peca.confidence < REFERENCE_CATALOG_CONFIDENCE_THRESHOLD) return { status: "needs_recrop", code: "piece_below_threshold", retryable: true, message: "O tipo da peça não está visível com confiança suficiente." };
  if (targetPiece) {
    const requireField = (field: keyof ReferenceAnalysis, code: string, message: string) => {
      const observation = analysis[field] as { value?: unknown; confidence?: number };
      if (observation.value == null || (observation.confidence || 0) < REFERENCE_CATALOG_CONFIDENCE_THRESHOLD) {
        return { status: "needs_recrop" as const, code, retryable: true, message };
      }
      return null;
    };
    const topPiece = ["Vestido", "Blusa", "Macacão", "Top", "Blazer"].includes(targetPiece);
    const bottomPiece = ["Vestido", "Saia", "Macacão"].includes(targetPiece);
    if (topPiece) {
      const neckline = requireField("decote", "neckline_below_threshold", "O decote ou gola não está visível com confiança suficiente. Envie um recorte mais próximo do busto.");
      if (neckline) return neckline;
      const sleevePresence = analysis.possuiManga;
      if (sleevePresence.value == null || sleevePresence.confidence < REFERENCE_CATALOG_CONFIDENCE_THRESHOLD) return { status: "needs_recrop", code: "sleeve_presence_below_threshold", retryable: true, message: "Não foi possível confirmar se há manga. Envie um recorte que mostre os ombros e braços." };
      if (sleevePresence.value === true) {
        const sleeve = requireField("manga", "sleeve_below_threshold", "A manga está visível, mas não foi identificada com confiança suficiente.");
        if (sleeve) return sleeve;
      }
    }
    if (bottomPiece) {
      const skirt = requireField("saia", "skirt_below_threshold", "A modelagem da saia ou parte inferior não está visível com confiança suficiente.");
      if (skirt) return skirt;
    }
    if (analysis.rendaDecisao.value === true) {
      const lace = requireField("renda", "lace_below_threshold", "A renda está visível, mas o tipo não foi identificado com confiança suficiente.");
      if (lace) return lace;
    }
  }
  return { status: "analysis_ready", code: null, retryable: false, message: null };
}
