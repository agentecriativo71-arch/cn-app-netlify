import { describe, expect, it, vi } from "vitest";
import {
  FalGeminiReferenceVisionAnalyzer,
  OpenAIReferenceVisionAnalyzer,
  ReferenceVisionError,
  createReferenceVisionAnalyzer,
} from "../server/referenceVision";
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

describe("OpenAI GPT-5.4 mini Vision adapter", () => {
  it("envia imagem, configuração GPT-5.4 mini e schema estrito", async () => {
    const create = vi.fn().mockResolvedValue({ output_text: validVisionJson() });
    const analyzer = new OpenAIReferenceVisionAnalyzer({ client: { responses: { create } }, model: "gpt-5.4-mini", maxAttempts: 1 });
    const result = await analyzer.analyze({ mode: "single", occasion: "Festa", targetPiece: "Vestido", imageDataUrls: ["data:image/jpeg;base64,crop"] });
    const payload = create.mock.calls[0][0] as Record<string, any>;
    const content = payload.input[0].content;
    expect(payload.model).toBe("gpt-5.4-mini");
    expect(payload.store).toBe(false);
    expect(payload.reasoning).toEqual({ effort: "low" });
    expect(payload.max_output_tokens).toBe(1800);
    expect(payload).not.toHaveProperty("temperature");
    expect(payload.text.format.strict).toBe(true);
    expect(payload.text.format.schema.additionalProperties).toBe(false);
    expect(content.find((item: any) => item.type === "input_image")).toMatchObject({ type: "input_image", image_url: "data:image/jpeg;base64,crop", detail: "medium" });
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
    expect(images.every((image: any) => image.detail === "medium")).toBe(true);
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

describe("Fal Gemini Vision adapter", () => {
  it("envia imagem ao endpoint Vision da Fal com configuração rápida e contrato atual", async () => {
    const subscribe = vi.fn().mockResolvedValue({ output: validVisionJson() });
    const analyzer = new FalGeminiReferenceVisionAnalyzer({
      client: { subscribe },
      apiKey: "fal-test-key",
      maxAttempts: 1,
    });

    const result = await analyzer.analyze({
      mode: "single",
      occasion: "Festa",
      targetPiece: "Vestido",
      imageDataUrls: ["data:image/jpeg;base64,crop"],
    });
    const [endpoint, options] = subscribe.mock.calls[0] as [string, Record<string, any>];

    expect(endpoint).toBe("openrouter/router/vision");
    expect(options.input).toMatchObject({
      model: "google/gemini-2.5-flash",
      image_urls: ["data:image/jpeg;base64,crop"],
      temperature: 0,
      reasoning: false,
      max_tokens: 1800,
    });
    expect(options.input.prompt).toContain("Vestido");
    expect(options.input.system_prompt).toContain("JSON");
    expect(result.manga.value).toBeNull();
    expect(analyzer.providerName).toBe("fal");
  });

  it("envia imagens compostas na ordem top e bottom", async () => {
    const subscribe = vi.fn().mockResolvedValue({ output: validVisionJson("composite") });
    const analyzer = new FalGeminiReferenceVisionAnalyzer({ client: { subscribe }, apiKey: "fal-test-key", maxAttempts: 1 });

    await analyzer.analyze({ mode: "composite", imageDataUrls: ["data:image/jpeg;base64,top", "data:image/jpeg;base64,bottom"] });

    const input = (subscribe.mock.calls[0][1] as Record<string, any>).input;
    expect(input.image_urls).toEqual([
      "data:image/jpeg;base64,top",
      "data:image/jpeg;base64,bottom",
    ]);
    expect(input.prompt).toContain("IMAGE 1 is role \"top\"");
    expect(input.prompt).toContain("IMAGE 2 is role \"bottom\"");
  });

  it("faz retry de falha transitória sem trocar para outro provedor", async () => {
    const subscribe = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("Fal indisponível"), { status: 503 }))
      .mockResolvedValueOnce({ output: validVisionJson() });
    const analyzer = new FalGeminiReferenceVisionAnalyzer({ client: { subscribe }, apiKey: "fal-test-key", maxAttempts: 2 });

    await expect(analyzer.analyze({ mode: "single", imageDataUrls: ["data:image/jpeg;base64,crop"] })).resolves.toMatchObject({ schemaVersion: REFERENCE_ANALYSIS_VERSION });
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(analyzer.providerName).toBe("fal");
  });

  it("factory usa Fal por padrão e OpenAI somente quando explicitamente selecionado", () => {
    const falAnalyzer = createReferenceVisionAnalyzer({ provider: "fal", falClient: { subscribe: vi.fn() }, apiKey: "fal-test-key" });
    const openAiAnalyzer = createReferenceVisionAnalyzer({ provider: "openai", client: { responses: { create: vi.fn() } }, apiKey: "openai-test-key" });

    expect(falAnalyzer.providerName).toBe("fal");
    expect(openAiAnalyzer.providerName).toBe("openai");
  });
});
