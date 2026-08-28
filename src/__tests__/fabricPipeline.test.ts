import { describe, expect, it, vi } from "vitest";
import {
  buildGarmentReferencePrompt,
  buildMannequinFabricPrompt,
  deriveFabricVariantSeed,
  evaluateFabricCandidates,
  runFabricPipeline,
  normalizeFabricReference,
  selectBestFabricCandidate,
} from "../server/fabricPipeline";

describe("pipeline de fidelidade de tecidos", () => {
  it("deriva seeds reproduzíveis e diferentes por variante", () => {
    const input = {
      tecidoSku: "SKU-123",
      croquiUrl: "https://example.com/croqui.png",
    };

    const firstRun = [0, 1, 2].map((variantIndex) => deriveFabricVariantSeed({ ...input, variantIndex }));
    const secondRun = [0, 1, 2].map((variantIndex) => deriveFabricVariantSeed({ ...input, variantIndex }));

    expect(firstRun).toEqual(secondRun);
    expect(new Set(firstRun).size).toBe(3);
    expect(firstRun.every((seed) => Number.isInteger(seed) && seed >= 0)).toBe(true);
  });

  it("separa responsabilidades entre imagem da peça e imagem do manequim", () => {
    const garmentPrompt = buildGarmentReferencePrompt({
      pecaEn: "dress",
      tecidoNome: "Seda Floral",
      elementFragment: "Incorporate a square neckline.",
    });
    const mannequinPrompt = buildMannequinFabricPrompt({
      pecaEn: "dress",
      background: "a clean white background",
      elementFragment: "Incorporate a square neckline.",
    });

    expect(garmentPrompt).toContain("IMAGE 1");
    expect(garmentPrompt).toContain("IMAGE 2");
    expect(garmentPrompt).toContain("Seda Floral");
    expect(garmentPrompt).toContain("fabric color, weave, pattern, texture, sheen, transparency, and finish");
    expect(mannequinPrompt).toContain("IMAGE 1");
    expect(mannequinPrompt).toContain("IMAGE 2");
    expect(mannequinPrompt).toContain("Do not infer fabric from the mannequin image");
    expect(mannequinPrompt).not.toContain("IMAGE 3");
  });

  it("seleciona candidato pela pontuação ponderada de fidelidade", () => {
    const selected = selectBestFabricCandidate([
      {
        index: 0,
        url: "https://example.com/candidate-0.png",
        scores: { colorPattern: 5, material: 2, design: 5, artifactFree: 5 },
      },
      {
        index: 1,
        url: "https://example.com/candidate-1.png",
        scores: { colorPattern: 4, material: 5, design: 4, artifactFree: 5 },
      },
      {
        index: 2,
        url: "https://example.com/candidate-2.png",
        scores: { colorPattern: 3, material: 3, design: 3, artifactFree: 3 },
      },
    ]);

    expect(selected?.index).toBe(1);
    expect(selected?.score).toBeCloseTo(4.45);
  });

  it("rejeita conjunto sem candidato acima do mínimo", () => {
    expect(selectBestFabricCandidate([
      {
        index: 0,
        url: "https://example.com/candidate-0.png",
        scores: { colorPattern: 1, material: 1, design: 5, artifactFree: 5 },
      },
    ])).toBeNull();
  });

  it("valida e normaliza o tecido como JPEG temporário em data URL", async () => {
    const normalized = await normalizeFabricReference("https://example.com/fabric.png", {
      fetchImpl: async () => ({
        ok: true,
        headers: new Headers({ "content-type": "image/png", "content-length": "4" }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      }),
      transform: async () => new Uint8Array([255, 216, 255, 217]),
    });

    expect(normalized).toBe("data:image/jpeg;base64,/9j/2Q==");
  });

  it("rejeita URL insegura ou resposta que não seja imagem", async () => {
    await expect(normalizeFabricReference("http://localhost/fabric.png", {
      fetchImpl: vi.fn(),
    })).rejects.toThrow("URL HTTPS pública");

    await expect(normalizeFabricReference("https://example.com/fabric", {
      fetchImpl: async () => ({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    })).rejects.toThrow("não retornou uma imagem");
  });

  it("gera referência intermediária e três variantes finais sem reenviar o swatch", async () => {
    const subscribe = vi.fn(async (endpoint: string, options: { input: Record<string, unknown> }) => {
      if (subscribe.mock.calls.length === 1) {
        return { images: [{ url: "https://fal.test/garment-reference.png" }] };
      }
      const candidateIndex = subscribe.mock.calls.length - 2;
      return { images: [{ url: `https://fal.test/candidate-${candidateIndex}.png` }] };
    });

    const result = await runFabricPipeline({
      client: { subscribe },
      croquiUrl: "https://example.com/croqui.png",
      tecidoImageUrl: "https://example.com/fabric.png",
      tecidoSku: "SKU-123",
      tecidoNome: "Seda Floral",
      pecaEn: "dress",
      mannequinUrl: "https://example.com/mannequin.jpg",
      background: "a clean white background",
      elementFragment: "Incorporate a square neckline.",
      normalize: async () => "data:image/jpeg;base64,fabric",
      evaluate: async (candidates) => candidates.map((candidate, index) => ({
        ...candidate,
        scores: index === 1
          ? { colorPattern: 5, material: 5, design: 4, artifactFree: 5 }
          : { colorPattern: 3, material: 3, design: 3, artifactFree: 3 },
      })),
    });

    expect(result.url).toBe("https://fal.test/candidate-1.png");
    expect(subscribe).toHaveBeenCalledTimes(4);
    expect(subscribe.mock.calls[0][0]).toBe("fal-ai/bytedance/seedream/v4/edit");
    expect((subscribe.mock.calls[0][1] as { input: { image_urls: string[] } }).input.image_urls).toEqual([
      "https://example.com/croqui.png",
      "data:image/jpeg;base64,fabric",
    ]);

    for (const call of subscribe.mock.calls.slice(1)) {
      const input = (call[1] as { input: { image_urls: string[]; enhance_prompt_mode: string } }).input;
      expect(input.image_urls).toEqual(["https://example.com/mannequin.jpg", "https://fal.test/garment-reference.png"]);
      expect(input.enhance_prompt_mode).toBe("standard");
      expect(input.image_urls).not.toContain("https://example.com/fabric.png");
    }
  });

  it("registra cada chamada Fal e a comparação Vision no rastreio", async () => {
    const steps: Array<{ input: any; succeed: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn> }> = [];
    const execution = {
      startStep: vi.fn(async (input: any) => {
        const step = { input, succeed: vi.fn(), fail: vi.fn() };
        steps.push(step);
        return step;
      }),
    };
    const subscribe = vi.fn(async (endpoint: string) => endpoint === "openrouter/router/vision"
      ? { output: JSON.stringify({ candidates: [
          { index: 0, scores: { colorPattern: 5, material: 5, design: 5, artifactFree: 5 } },
          { index: 1, scores: { colorPattern: 4, material: 4, design: 4, artifactFree: 4 } },
          { index: 2, scores: { colorPattern: 3, material: 3, design: 3, artifactFree: 3 } },
        ] }) }
      : { images: [{ url: `https://fal.test/result-${subscribe.mock.calls.length}.png` }] });

    await runFabricPipeline({
      client: { subscribe },
      execution: execution as any,
      croquiUrl: "https://app.test/croqui.png",
      tecidoImageUrl: "https://app.test/fabric.png",
      pecaEn: "dress",
      mannequinUrl: "https://app.test/mannequin.png",
      background: "white",
      normalize: async () => "data:image/jpeg;base64,normalized",
      evaluate: (candidates, context) => evaluateFabricCandidates({
        client: { subscribe },
        normalizedFabricUrl: context.normalizedFabricUrl,
        intermediateUrl: context.intermediateUrl,
        candidates,
      }),
    });

    expect(steps.map((step) => step.input.stage)).toEqual([
      "realistic_provider_request",
      "realistic_provider_request",
      "realistic_provider_request",
      "realistic_provider_request",
      "realistic_vision_evaluation",
    ]);
    expect(steps[0].succeed).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        operation: "fal-ai/bytedance/seedream/v4/edit",
        referenceManifest: expect.arrayContaining([
          expect.objectContaining({ role: "croqui" }),
          expect.objectContaining({ role: "fabric", transport: "data_url" }),
        ]),
      }),
    }));
    expect(steps[4].succeed).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        operation: "openrouter/router/vision",
        referenceCount: 5,
      }),
    }));
  });

  it("avalia candidatos comparando swatch, peça intermediária e resultados", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      output: JSON.stringify({
        candidates: [
          { index: 0, scores: { colorPattern: 4, material: 3, design: 5, artifactFree: 5 } },
          { index: 1, scores: { colorPattern: 5, material: 5, design: 4, artifactFree: 5 } },
          { index: 2, scores: { colorPattern: 2, material: 2, design: 3, artifactFree: 2 } },
        ],
      }),
    });

    const result = await evaluateFabricCandidates({
      client: { subscribe },
      normalizedFabricUrl: "data:image/jpeg;base64,fabric",
      intermediateUrl: "https://fal.test/garment-reference.png",
      candidates: [
        { index: 0, url: "https://fal.test/candidate-0.png" },
        { index: 1, url: "https://fal.test/candidate-1.png" },
        { index: 2, url: "https://fal.test/candidate-2.png" },
      ],
      model: "google/gemini-2.5-flash",
    });

    expect(result[1].scores.material).toBe(5);
    expect(subscribe).toHaveBeenCalledWith("openrouter/router/vision", expect.objectContaining({
      input: expect.objectContaining({
        image_urls: [
          "data:image/jpeg;base64,fabric",
          "https://fal.test/garment-reference.png",
          "https://fal.test/candidate-0.png",
          "https://fal.test/candidate-1.png",
          "https://fal.test/candidate-2.png",
        ],
      }),
    }));
  });
});
