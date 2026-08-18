import { describe, expect, it, vi } from "vitest";
import { OpenAIReferenceVisionAnalyzer, ReferenceVisionError } from "../server/referenceVision";
import { REFERENCE_ANALYSIS_VERSION } from "../lib/referenceUtils";

const observed = (value: unknown, sourceRole: "single" | "top" | "bottom" | null = "single") => ({ value, confidence: 0.9, evidence: "Visível no recorte.", sourceRole });
const detail = (sourceRole: "single" | "top" | "bottom" | null = "single") => observed("Detalhe visível", sourceRole);

function validVisionJson(mode: "single" | "composite" = "single") {
  const focus = mode === "single"
    ? [{ role: "single", status: "identified", targetDescription: "Vestido central", candidateCount: 1, confidence: 0.95, evidence: "Peça central." }]
    : [
      { role: "top", status: "identified", targetDescription: "Parte superior", candidateCount: 1, confidence: 0.95, evidence: "Busto central." },
      { role: "bottom", status: "identified", targetDescription: "Parte inferior", candidateCount: 1, confidence: 0.95, evidence: "Saia central." },
    ];
  const role = mode === "single" ? "single" : "top";
  return JSON.stringify({
    schemaVersion: REFERENCE_ANALYSIS_VERSION,
    mode,
    focus,
    peca: observed("Vestido", role), comprimento: observed("Midi", mode === "single" ? "single" : "bottom"), decote: observed("V (V-Neck)", role),
    possuiManga: observed(false, role), manga: observed(null, role), saia: observed("Evasê", mode === "single" ? "single" : "bottom"), rendaDecisao: observed(false, role), renda: observed(null, role),
    detalhesTecnicos: {
      corpete: detail(role), cintura: detail(role), caimento: detail(mode === "single" ? "single" : "bottom"), volume: detail(mode === "single" ? "single" : "bottom"), barra: detail(mode === "single" ? "single" : "bottom"),
      transparencia: detail(role), tecido: detail(role), costas: detail(role), fechamento: detail(role),
    },
  });
}

describe("OpenAI GPT-5 Vision adapter", () => {
  it("envia imagem, configuração GPT-5 e schema estrito", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: validVisionJson() });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, model: "gpt-5", maxAttempts: 1 });
    const result = await analyzer.analyze({ mode: "single", occasion: "Festa", targetPiece: "Vestido", imageDataUrls: ["data:image/jpeg;base64,crop"] });
    const payload = create.mock.calls[0][0] as Record<string, any>;
    const content = payload.input[0].content;
    expect(payload.model).toBe("gpt-5");
    expect(payload.store).toBe(false);
    expect(payload.reasoning).toEqual({ effort: "medium" });
    expect(payload.max_output_tokens).toBe(3000);
    expect(payload).not.toHaveProperty("temperature");
    expect(payload.text.format.strict).toBe(true);
    expect(payload.text.format.schema.additionalProperties).toBe(false);
    expect(content.find((item: any) => item.type === "input_image")).toMatchObject({ type: "input_image", image_url: "data:image/jpeg;base64,crop", detail: "high" });
    expect(content[0].text).toContain("Vestido");
    expect(result.manga.value).toBeNull();
  });

  it("envia duas imagens na ordem top e bottom em uma única requisição", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: validVisionJson("composite") });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, maxAttempts: 1 });
    const result = await analyzer.analyze({ mode: "composite", imageDataUrls: ["data:image/jpeg;base64,top", "data:image/jpeg;base64,bottom"] });
    const payload = create.mock.calls[0][0] as Record<string, any>;
    const images = payload.input[0].content.filter((item: any) => item.type === "input_image");
    expect(images).toHaveLength(2);
    expect(images.every((image: any) => image.detail === "high")).toBe(true);
    expect(images[0].image_url).toContain("top");
    expect(images[1].image_url).toContain("bottom");
    expect(payload.input[0].content[1].text).toContain("ROLE: top");
    expect(payload.input[0].content[3].text).toContain("ROLE: bottom");
    expect(result.mode).toBe("composite");
  });

  it("rejeita resposta composta que perde a ordem dos focos", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: validVisionJson("single") });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, maxAttempts: 1 });
    await expect(analyzer.analyze({ mode: "composite", imageDataUrls: ["data:image/jpeg;base64,top", "data:image/jpeg;base64,bottom"] })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("faz somente um retry para erro transitório HTTP", async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error("provider unavailable"), { status: 503 }));
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, maxAttempts: 2 });
    await expect(analyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).rejects.toBeInstanceOf(ReferenceVisionError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("faz retry para resposta estrutural inválida, mas não para recusa", async () => {
    const invalidThenValid = vi.fn().mockResolvedValueOnce({ output_text: "modelo genérico" }).mockResolvedValueOnce({ output_text: validVisionJson() });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create: invalidThenValid } }, maxAttempts: 2 });
    await expect(analyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).resolves.toMatchObject({ schemaVersion: REFERENCE_ANALYSIS_VERSION });
    expect(invalidThenValid).toHaveBeenCalledTimes(2);

    const refusal = vi.fn().mockResolvedValue({ output: [{ type: "message", content: [{ type: "refusal", refusal: "não posso" }] }] });
    const refusalAnalyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create: refusal } }, maxAttempts: 2 });
    await expect(refusalAnalyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).rejects.toMatchObject({ code: "refusal" });
    expect(refusal).toHaveBeenCalledTimes(1);
  });

  it("não repete erro definitivo do provedor", async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error("invalid request"), { status: 400 }));
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, maxAttempts: 2 });

    await expect(analyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).rejects.toMatchObject({ code: "provider_error", retryable: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("faz retry quando a resposta bruta contém campo extra", async () => {
    const extra = JSON.parse(validVisionJson());
    extra.unexpected = "não permitido";
    const create = vi.fn().mockResolvedValueOnce({ output_text: JSON.stringify(extra) }).mockResolvedValueOnce({ output_text: validVisionJson() });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, maxAttempts: 2 });

    await expect(analyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).resolves.toMatchObject({ schemaVersion: REFERENCE_ANALYSIS_VERSION });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
