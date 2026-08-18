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
  return { status: "analysis_ready", code: null, retryable: false, message: null };
}
