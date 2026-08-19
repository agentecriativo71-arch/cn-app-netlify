import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribeMock = vi.hoisted(() => vi.fn());
const analyzeMock = vi.hoisted(() => vi.fn());

vi.mock("@fal-ai/serverless-client", () => ({ subscribe: subscribeMock }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: (context: unknown) => unknown) => handler }),
}));
vi.mock("../server/referenceVision", () => ({
  DEFAULT_FAL_VISION_MODEL: "google/gemini-2.5-flash",
  DEFAULT_OPENAI_VISION_MODEL: "gpt-5.4-mini",
  ReferenceVisionError: class ReferenceVisionError extends Error {},
  createReferenceVisionAnalyzer: () => ({ analyze: analyzeMock, providerName: "fal", modelName: "google/gemini-2.5-flash", lastAttempts: 1 }),
}));

import { pollUploadSessionFn, retryReferenceGenerationFn, uploadReferenceFilesFn } from "../server/api";
import { createUploadSession } from "../server/db";
import { normalizeReferenceAnalysis, REFERENCE_ANALYSIS_VERSION } from "../lib/referenceUtils";

const jpeg = "data:image/jpeg;base64,/9j/AA==";

function validAnalysis() {
  const observed = (value: unknown) => ({ value, confidence: 0.95, evidence: "Visível no recorte.", sourceRole: "single" as const });
  return normalizeReferenceAnalysis({
    schemaVersion: REFERENCE_ANALYSIS_VERSION,
    mode: "single",
    focus: [{ role: "single", status: "identified", targetDescription: "Vestido central", candidateCount: 1, confidence: 0.95, evidence: "Alvo predominante." }],
    peca: observed("Vestido"), comprimento: observed("Midi"), decote: observed("V (V-Neck)"), possuiManga: observed(false), manga: observed(null), saia: observed("Evasê"), rendaDecisao: observed(false), renda: observed(null),
    detalhesTecnicos: { corpete: observed("Corpete visível"), cintura: observed("Cintura marcada"), caimento: observed("Caimento fluido"), volume: observed("Volume moderado"), barra: observed("Barra visível"), transparencia: observed(null), tecido: observed(null), costas: observed(null), fechamento: observed(null) },
  }, "single", "single");
}

async function executeServerFn(fn: any, data: unknown) {
  return fn({ data });
}

describe("fluxo público de referência", () => {
  beforeEach(() => {
    analyzeMock.mockReset().mockResolvedValue(validAnalysis());
    subscribeMock.mockReset().mockResolvedValue({ images: [{ url: "https://fal.test/croqui.png" }] });
  });

  it("persiste a análise, recupera a ocasião e envia somente texto ao Seedream", async () => {
    const session = await createUploadSession("Cliente", "Festa", "Vestido");
    expect(session.reference_piece).toBe("Vestido");
    const analyzed = await executeServerFn(uploadReferenceFilesFn, { sessionId: session.id, mode: "single", images: [{ role: "single", dataUrl: jpeg }] });

    expect(analyzed.status).toBe("uploaded");
    expect(analyzeMock).toHaveBeenCalledWith(expect.objectContaining({ mode: "single", occasion: "Festa", targetPiece: "Vestido", imageDataUrls: [jpeg] }));

    const polled = await executeServerFn(pollUploadSessionFn, { sessionId: session.id });
    expect(polled.session.reference_analysis).toMatchObject({ schemaVersion: REFERENCE_ANALYSIS_VERSION });
    expect(polled.session.ocasiao).toBe("Festa");
    expect(polled.session.vision_provider).toBe("fal");
    expect(polled.session.vision_model).toBe("google/gemini-2.5-flash");
    expect(JSON.stringify(polled.session)).not.toContain("data:image");

    expect(subscribeMock).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4/text-to-image", expect.objectContaining({ input: expect.not.objectContaining({ image_urls: expect.anything() }) }));
    expect(JSON.stringify(subscribeMock.mock.calls[0][1].input)).not.toContain("data:image");
    expect((await executeServerFn(pollUploadSessionFn, { sessionId: session.id })).session.status).toBe("uploaded");
  });

  it("não gera croqui quando o foco é ambíguo", async () => {
    analyzeMock.mockResolvedValueOnce({ ...validAnalysis(), focus: [{ ...validAnalysis().focus[0], status: "ambiguous", confidence: 0.4 }] });
    const session = await createUploadSession("Cliente ambíguo", "Festa");
    const result = await executeServerFn(uploadReferenceFilesFn, { sessionId: session.id, mode: "single", images: [{ role: "single", dataUrl: jpeg }] });

    expect(result).toMatchObject({ status: "needs_recrop", code: "focus_below_threshold" });
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("permite retry da geração sem chamar Vision novamente", async () => {
    subscribeMock.mockRejectedValueOnce(new Error("falha Seedream")).mockResolvedValueOnce({ images: [{ url: "https://fal.test/retry.png" }] });
    const session = await createUploadSession("Cliente retry", "Festa");
    const analyzed = await executeServerFn(uploadReferenceFilesFn, { sessionId: session.id, mode: "single", images: [{ role: "single", dataUrl: jpeg }] });
    expect(analyzed.status).toBe("generation_failed");
    expect((await executeServerFn(pollUploadSessionFn, { sessionId: session.id })).session.status).toBe("generation_failed");
    await executeServerFn(retryReferenceGenerationFn, { sessionId: session.id });

    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect((await executeServerFn(pollUploadSessionFn, { sessionId: session.id })).session.status).toBe("uploaded");
  });

  it("não registra a mensagem integral do erro de Vision", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    analyzeMock.mockRejectedValueOnce(new Error("data:image/jpeg;base64/conteudo-privado"));
    try {
      const session = await createUploadSession("Cliente log", "Festa", "Vestido");
      const result = await executeServerFn(uploadReferenceFilesFn, { sessionId: session.id, mode: "single", images: [{ role: "single", dataUrl: jpeg }] });

      expect(result.status).toBe("analysis_failed");
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("data:image/jpeg");
      expect(JSON.stringify(errorLog.mock.calls)).toContain("vision_failed");
    } finally {
      errorLog.mockRestore();
    }
  });
});
