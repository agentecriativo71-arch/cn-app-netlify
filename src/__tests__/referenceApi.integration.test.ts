import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribeMock = vi.hoisted(() => vi.fn());
const analyzeMock = vi.hoisted(() => vi.fn());

vi.mock("@fal-ai/serverless-client", () => ({ subscribe: subscribeMock }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: (context: unknown) => unknown) => handler,
  }),
}));
vi.mock("../server/referenceVision", () => ({
  DEFAULT_FAL_VISION_MODEL: "google/gemini-2.5-flash",
  DEFAULT_OPENAI_VISION_MODEL: "gpt-5",
  ReferenceVisionError: class ReferenceVisionError extends Error {},
  resolveVisionModel: () => "google/gemini-2.5-flash",
  createReferenceVisionAnalyzer: () => ({
    analyze: analyzeMock,
    providerName: "fal",
    modelName: "google/gemini-2.5-flash",
    lastAttempts: 1,
  }),
}));

import {
  generateCroquiFn,
  pollUploadSessionFn,
  retryReferenceGenerationFn,
  uploadReferenceFilesFn,
} from "../server/api";
import { createUploadSession } from "../server/db";
import {
  normalizeReferenceAnalysis,
  REFERENCE_ANALYSIS_VERSION,
} from "../lib/referenceUtils";
import {
  ExecutionAssetStore,
  type PrivateStorageBoundary,
} from "../server/executionAssets";
import { setExecutionAssetStoreForTests } from "../server/executionAssetsRuntime";
import { operationalAnalytics } from "../server/analyticsRuntime";

const jpeg = "data:image/jpeg;base64,/9j/AA==";

class MemoryPrivateStorage implements PrivateStorageBoundary {
  readonly objects = new Map<
    string,
    { data: Uint8Array; contentType: string }
  >();
  async upload(path: string, data: Uint8Array, contentType: string) {
    this.objects.set(path, { data, contentType });
  }
  async download(path: string) {
    const object = this.objects.get(path);
    if (!object) throw new Error("not found");
    return object;
  }
  async remove(paths: string[]) {
    paths.forEach((path) => this.objects.delete(path));
  }
  async createSignedUrl(path: string) {
    return `https://storage.test/${path}`;
  }
}

function validAnalysis() {
  const observed = (value: unknown) => ({
    value,
    confidence: 0.95,
    evidence: "Visível no recorte.",
    sourceRole: "single" as const,
  });
  return normalizeReferenceAnalysis(
    {
      schemaVersion: REFERENCE_ANALYSIS_VERSION,
      mode: "single",
      focus: [
        {
          role: "single",
          status: "identified",
          targetDescription: "Vestido central",
          candidateCount: 1,
          confidence: 0.95,
          evidence: "Alvo predominante.",
        },
      ],
      peca: observed("Vestido"),
      comprimento: observed("Midi"),
      decote: observed("V (V-Neck)"),
      possuiManga: observed(false),
      manga: observed(null),
      saia: observed("Evasê"),
      rendaDecisao: observed(false),
      renda: observed(null),
      detalhesTecnicos: {
        corpete: observed("Corpete visível"),
        cintura: observed("Cintura marcada"),
        caimento: observed("Caimento fluido"),
        volume: observed("Volume moderado"),
        barra: observed("Barra visível"),
        transparencia: observed(null),
        tecido: observed(null),
        costas: observed(null),
        fechamento: observed(null),
      },
    },
    "single",
    "single",
  );
}

async function executeServerFn(fn: any, data: unknown) {
  return fn({ data });
}

describe("fluxo público de referência", () => {
  beforeEach(() => {
    setExecutionAssetStoreForTests(
      new ExecutionAssetStore(
        new MemoryPrivateStorage(),
        async () =>
          new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      ),
    );
    analyzeMock
      .mockReset()
      .mockResolvedValue({ analysis: validAnalysis(), providerExtras: [] });
    subscribeMock
      .mockReset()
      .mockResolvedValue({ images: [{ url: "https://fal.test/croqui.png" }] });
  });

  it("persiste a análise, recupera a ocasião e envia recorte anonimizado ao Seedream edit", async () => {
    const analysis = validAnalysis();
    analysis.providerExtras = [
      {
        path: "detalhesTecnicos.manga.punho",
        value: "Ajustado",
        confidence: 0.9,
        evidence: "Punho visível.",
        sourceRole: "single",
      },
    ];
    analyzeMock.mockResolvedValueOnce({
      analysis,
      providerExtras: analysis.providerExtras,
    });
    const session = await createUploadSession("Cliente", "Festa", "Vestido");
    expect(session.reference_piece).toBe("Vestido");
    const analyzed = await executeServerFn(uploadReferenceFilesFn, {
      sessionId: session.id,
      mode: "single",
      images: [{ role: "single", dataUrl: jpeg }],
    });

    expect(analyzed.status).toBe("uploaded");
    expect(analyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "single",
        occasion: "Festa",
        targetPiece: "Vestido",
        imageDataUrls: [jpeg],
      }),
    );

    const polled = await executeServerFn(pollUploadSessionFn, {
      sessionId: session.id,
    });
    expect(polled.session.reference_analysis).toMatchObject({
      schemaVersion: REFERENCE_ANALYSIS_VERSION,
    });
    expect(polled.session.ocasiao).toBe("Festa");
    expect(polled.session.vision_provider).toBe("fal");
    expect(polled.session.vision_model).toBe("google/gemini-2.5-flash");
    expect(polled.session.specification).toMatchObject({
      peca: "Vestido",
      decote: "V (V-Neck)",
      saia: "Evasê",
    });
    expect(polled.session.reference_analysis.providerExtras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "detalhesTecnicos.manga.punho",
          value: "Ajustado",
        }),
      ]),
    );
    expect(JSON.stringify(polled.session)).not.toContain("data:image");

    expect(subscribeMock).toHaveBeenCalledWith(
      "fal-ai/bytedance/seedream/v4/edit",
      expect.objectContaining({
        input: expect.objectContaining({
          image_urls: expect.any(Array),
          seed: expect.any(Number),
        }),
      }),
    );
    expect(JSON.stringify(subscribeMock.mock.calls[0][1].input)).toContain(
      "data:image",
    );
    expect(JSON.stringify(subscribeMock.mock.calls[0][1].input)).toContain(
      "não adicionar elástico no punho",
    );
    expect(
      (await executeServerFn(pollUploadSessionFn, { sessionId: session.id }))
        .session.status,
    ).toBe("uploaded");
  });

  it("analisa top e bottom em paralelo e funde cada parte na propriedade correta", async () => {
    const topImage = "data:image/jpeg;base64,/9j/AQ==";
    const bottomImage = "data:image/jpeg;base64,/9j/Ag==";
    analyzeMock.mockImplementation(
      async ({
        imageDataUrls,
        prompt,
      }: {
        imageDataUrls: string[];
        prompt: string;
      }) => {
        if (prompt.startsWith("Evaluate this generated fashion croqui"))
          return { analysis: validAnalysis(), providerExtras: [] };
        const isTop = imageDataUrls[0] === topImage;
        const analysis = validAnalysis();
        analysis.decote = {
          ...analysis.decote,
          value: isTop ? "Quadrado (Square)" : "V (V-Neck)",
        };
        analysis.possuiManga = { ...analysis.possuiManga, value: isTop };
        analysis.manga = {
          ...analysis.manga,
          value: isTop ? "Longa (Long Sleeve)" : null,
        };
        analysis.saia = { ...analysis.saia, value: isTop ? null : "Evasê" };
        analysis.comprimento = {
          ...analysis.comprimento,
          value: isTop ? null : "Midi",
        };
        if (imageDataUrls.length === 1)
          expect(prompt).toContain(
            isTop ? "upper garment crop" : "lower garment crop",
          );
        return { analysis, providerExtras: [] };
      },
    );

    const session = await createUploadSession(
      "Cliente composto",
      "Festa",
      "Vestido",
    );
    const result = await executeServerFn(uploadReferenceFilesFn, {
      sessionId: session.id,
      mode: "composite",
      images: [
        { role: "top", dataUrl: topImage },
        { role: "bottom", dataUrl: bottomImage },
      ],
    });

    expect(result.status).toBe("uploaded");
    expect(analyzeMock).toHaveBeenCalledTimes(7);
    expect(result.analysis).toMatchObject({
      mode: "composite",
      decote: { value: "Quadrado (Square)", sourceRole: "top" },
      possuiManga: { value: true, sourceRole: "top" },
      manga: { value: "Longa (Long Sleeve)", sourceRole: "top" },
      saia: { value: "Evasê", sourceRole: "bottom" },
      comprimento: { value: "Midi", sourceRole: "bottom" },
    });

    const generationInput = subscribeMock.mock.calls[0][1].input as {
      prompt: string;
      image_urls?: unknown;
    };
    expect(generationInput.prompt).toContain("PARTE SUPERIOR");
    expect(generationInput.prompt).toContain("PARTE INFERIOR");
    expect(generationInput.prompt).toContain("Quadrado (Square)");
    expect(generationInput.prompt).toContain("Evasê");
    expect(generationInput.image_urls).toEqual(
      expect.arrayContaining([topImage, bottomImage]),
    );
  });

  it("não gera croqui quando o foco é ambíguo", async () => {
    analyzeMock.mockResolvedValueOnce({
      analysis: {
        ...validAnalysis(),
        focus: [
          { ...validAnalysis().focus[0], status: "ambiguous", confidence: 0.4 },
        ],
      },
      providerExtras: [],
    });
    const session = await createUploadSession("Cliente ambíguo", "Festa");
    const result = await executeServerFn(uploadReferenceFilesFn, {
      sessionId: session.id,
      mode: "single",
      images: [{ role: "single", dataUrl: jpeg }],
    });

    expect(result).toMatchObject({
      status: "needs_recrop",
      code: "focus_below_threshold",
    });
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("permite retry da geração sem chamar Vision novamente", async () => {
    let attempts = 0;
    subscribeMock.mockImplementation(async () => {
      attempts += 1;
      if (attempts <= 8) throw new Error("falha Seedream");
      return { images: [{ url: "https://fal.test/retry.png" }] };
    });
    const session = await createUploadSession("Cliente retry", "Festa");
    const analyzed = await executeServerFn(uploadReferenceFilesFn, {
      sessionId: session.id,
      mode: "single",
      images: [{ role: "single", dataUrl: jpeg }],
    });
    expect(analyzed.status).toBe("generation_failed");
    expect(
      (await executeServerFn(pollUploadSessionFn, { sessionId: session.id }))
        .session.status,
    ).toBe("generation_failed");
    await executeServerFn(retryReferenceGenerationFn, {
      sessionId: session.id,
    });

    expect(analyzeMock).toHaveBeenCalledTimes(5);
    expect(
      JSON.stringify(subscribeMock.mock.calls[8][1].input.image_urls),
    ).toContain("data:image/jpeg");
    expect(
      (await executeServerFn(pollUploadSessionFn, { sessionId: session.id }))
        .session.status,
    ).toBe("uploaded");
  });

  it("persiste diagnóstico Fal.ai 422 e não chama Vision sem imagem gerada", async () => {
    const falError = Object.assign(new Error("Client Error"), {
      status: 422,
      body: {
        detail: [
          {
            loc: ["body", "image_urls"],
            msg: "Failed to download the file. https://private.test/?token=secret",
            type: "value_error",
          },
        ],
      },
    });
    subscribeMock.mockRejectedValue(falError);

    const session = await createUploadSession("Cliente 422", "Festa", "Vestido");
    const result = await executeServerFn(uploadReferenceFilesFn, {
      sessionId: session.id,
      mode: "single",
      images: [{ role: "single", dataUrl: jpeg }],
    });

    expect(result.status).toBe("generation_failed");
    expect(analyzeMock).toHaveBeenCalledTimes(1);
    const detail = await operationalAnalytics.getExecutionDetail(result.executionId);
    const providerStep = detail?.steps.find(
      (step) => step.stage === "croqui_provider_request",
    );
    expect(providerStep).toMatchObject({
      status: "error",
      errorCode: "fal_reference_download_failed",
      provider: "fal",
      model: "seedream-v4",
        metadata: {
          httpStatus: 422,
          providerField: "image_urls",
          retryable: false,
          referenceSummary: expect.arrayContaining([
            expect.objectContaining({ role: "biotipo" }),
          ]),
        },
    });
    expect(JSON.stringify(detail)).not.toContain("private.test");
    expect(JSON.stringify(detail)).not.toContain("secret");
  });

  it("não registra a mensagem integral do erro de Vision", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    analyzeMock.mockRejectedValueOnce(
      new Error("data:image/jpeg;base64/conteudo-privado"),
    );
    try {
      const session = await createUploadSession(
        "Cliente log",
        "Festa",
        "Vestido",
      );
      const result = await executeServerFn(uploadReferenceFilesFn, {
        sessionId: session.id,
        mode: "single",
        images: [{ role: "single", dataUrl: jpeg }],
      });

      expect(result.status).toBe("analysis_failed");
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
        "data:image/jpeg",
      );
      expect(JSON.stringify(errorLog.mock.calls)).toContain("vision_failed");
    } finally {
      errorLog.mockRestore();
    }
  });

  it("persiste os quatro candidatos rejeitados com a seleção do usuário", async () => {
    const previousGate = process.env.CROQUI_VISUAL_GATE;
    process.env.CROQUI_VISUAL_GATE = "true";
    analyzeMock.mockImplementation(async ({ prompt }: { prompt?: string }) => {
      if (prompt?.startsWith("Evaluate this generated fashion croqui")) {
        const analysis = validAnalysis();
        analysis.peca = { ...analysis.peca, value: "Calça" };
        return { analysis, providerExtras: [] };
      }
      return { analysis: validAnalysis(), providerExtras: [] };
    });

    try {
      const session = await createUploadSession(
        "Cliente auditoria",
        "Festa",
        "Vestido",
      );
      const result = await executeServerFn(uploadReferenceFilesFn, {
        sessionId: session.id,
        mode: "single",
        images: [{ role: "single", dataUrl: jpeg }],
      });

      expect(result).toMatchObject({
        status: "generation_failed",
        executionId: expect.any(String),
      });
      const detail = await operationalAnalytics.getExecutionDetail(
        result.executionId,
      );
      expect(detail?.specification).toMatchObject({
        ocasiao: "Festa",
        peca: "Vestido",
      });
      expect(detail?.status).toBe("failed");
      const generatedArtifacts =
        detail?.artifacts.filter(
          (artifact) => artifact.kind === "croqui_candidate",
        ) || [];
      expect(generatedArtifacts).toHaveLength(4);
      expect(
        generatedArtifacts.every(
          (artifact) =>
            artifact.storagePath?.startsWith("generated/") &&
            artifact.metadata.seed,
        ),
      ).toBe(true);
    } finally {
      if (previousGate === undefined) delete process.env.CROQUI_VISUAL_GATE;
      else process.env.CROQUI_VISUAL_GATE = previousGate;
    }
  });

  it("gera no máximo dois candidatos de croqui simultaneamente", async () => {
    let activeGenerations = 0;
    let maxActiveGenerations = 0;
    analyzeMock.mockImplementation(async ({ prompt }: { prompt?: string }) => {
      const analysis = validAnalysis();
      if (prompt?.startsWith("Evaluate this generated fashion croqui")) {
        analysis.peca = { ...analysis.peca, value: "Saia" };
        analysis.saia = { ...analysis.saia, value: "Evasê" };
      }
      return { analysis, providerExtras: [] };
    });
    subscribeMock.mockImplementation(async () => {
      activeGenerations += 1;
      maxActiveGenerations = Math.max(
        maxActiveGenerations,
        activeGenerations,
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      activeGenerations -= 1;
      return {
        images: [{ url: `https://fal.test/candidate-${subscribeMock.mock.calls.length}.png` }],
      };
    });

    const result = await executeServerFn(generateCroquiFn, {
      peca: "Saia",
      biotipo: "Retângulo",
      saia: "Evasê",
      ocasiao: "Festa",
    });

    expect(result.metadata.candidates).toHaveLength(4);
    expect(subscribeMock).toHaveBeenCalledTimes(4);
    expect(maxActiveGenerations).toBe(2);
  });

  it("gera Blazer sem exigir decote, manga ou biotipo", async () => {
    analyzeMock.mockImplementation(async ({ prompt }: { prompt?: string }) => {
      const analysis = validAnalysis();
      if (prompt?.startsWith("Evaluate this generated fashion croqui")) {
        analysis.peca = { ...analysis.peca, value: "Blazer" };
        analysis.comprimento = { ...analysis.comprimento, value: null };
        analysis.decote = { ...analysis.decote, value: null };
        analysis.possuiManga = { ...analysis.possuiManga, value: true };
        analysis.manga = { ...analysis.manga, value: "Longa (Long Sleeve)" };
        analysis.saia = { ...analysis.saia, value: null };
      }
      return { analysis, providerExtras: [] };
    });

    const result = await executeServerFn(generateCroquiFn, {
      peca: "Blazer",
      ocasiao: "Fardamento",
    });

    expect(result.url).toBe("https://fal.test/croqui.png");
    expect(result.metadata.candidates).toHaveLength(4);
    expect(subscribeMock.mock.calls[0][1].input.prompt).not.toContain(
      "NECKLINE STYLE",
    );
  });
});
