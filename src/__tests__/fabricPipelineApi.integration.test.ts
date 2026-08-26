import sharp from "sharp";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const subscribeMock = vi.hoisted(() => vi.fn());

vi.mock("@fal-ai/serverless-client", () => ({ subscribe: subscribeMock }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: (context: unknown) => unknown) => handler }),
}));

import { generateRealistaFn } from "../server/api";

async function executeServerFn(fn: any, data: unknown) {
  return fn({ data });
}

describe("integração do pipeline de tecido na geração realista", () => {
  beforeEach(async () => {
    const fabricPng = await sharp({
      create: { width: 256, height: 256, channels: 3, background: { r: 180, g: 80, b: 120 } },
    }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "image/png", "content-length": String(fabricPng.byteLength) }),
      arrayBuffer: async () => fabricPng.buffer.slice(fabricPng.byteOffset, fabricPng.byteOffset + fabricPng.byteLength),
    }));
    vi.stubEnv("REALISTA_FABRIC_PIPELINE_V1", "true");
    subscribeMock.mockReset();
    let editCall = 0;
    subscribeMock.mockImplementation(async (endpoint: string) => {
      if (endpoint === "openrouter/router/vision") {
        return {
          output: JSON.stringify({
            candidates: [
              { index: 0, scores: { colorPattern: 3, material: 3, design: 3, artifactFree: 3 } },
              { index: 1, scores: { colorPattern: 5, material: 5, design: 4, artifactFree: 5 } },
              { index: 2, scores: { colorPattern: 3, material: 3, design: 3, artifactFree: 3 } },
            ],
          }),
        };
      }

      editCall += 1;
      if (editCall === 1) return { images: [{ url: "https://fal.test/garment-reference.png" }] };
      return { images: [{ url: `https://fal.test/candidate-${editCall - 2}.png` }] };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("faz uma referência de peça, três variantes, uma avaliação e retorna a melhor", async () => {
    const result = await executeServerFn(generateRealistaFn, {
      peca: "Vestido",
      cor: null,
      croquiUrl: "https://example.com/croqui.png",
      modo: "manequim",
      biotipo: "Ampulheta",
      comprimento: "Midi",
      decote: "Quadrado (Square)",
      manga: "Sem Manga",
      saia: "Evasê",
      renda: null,
      comentario: null,
      tecidoImageUrl: "https://example.com/fabric.png",
      tecidoSku: "SKU-123",
      tecidoNome: "Seda Floral",
      ocasiao: "Festa",
    });

    expect(result).toMatchObject({
      url: "https://fal.test/candidate-1.png",
      trackingStatus: "healthy",
      executionId: expect.any(String),
      artifactId: expect.any(String),
    });
    expect(subscribeMock).toHaveBeenCalledTimes(5);

    const editCalls = subscribeMock.mock.calls.filter(([endpoint]) => endpoint === "fal-ai/bytedance/seedream/v4/edit");
    expect(editCalls).toHaveLength(4);
    expect((editCalls[0][1] as any).input.image_urls).toHaveLength(2);
    expect((editCalls[0][1] as any).input.image_urls[0]).toBe("https://example.com/croqui.png");
    expect((editCalls[0][1] as any).input.image_urls[1]).toMatch(/^data:image\/jpeg;base64,/);

    for (const call of editCalls.slice(1)) {
      const input = (call[1] as any).input;
      expect(input.image_urls).toEqual(["https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manequins/ampulheta.jpg", "https://fal.test/garment-reference.png"]);
      expect(input.enhance_prompt_mode).toBe("standard");
    }

    const evaluationCall = subscribeMock.mock.calls.find(([endpoint]) => endpoint === "openrouter/router/vision");
    expect(evaluationCall).toBeDefined();
    expect((evaluationCall?.[1] as any).input.image_urls).toHaveLength(5);
  });

  it("mantém fluxo de pessoa sem pipeline novo mesmo com flag ligada", async () => {
    subscribeMock.mockReset().mockResolvedValue({ images: [{ url: "https://fal.test/person.png" }] });

    const result = await executeServerFn(generateRealistaFn, {
      peca: "Vestido",
      cor: null,
      userImageUrl: "https://example.com/person.jpg",
      croquiUrl: "https://example.com/croqui.png",
      modo: "foto",
      tecidoImageUrl: "https://example.com/fabric.png",
      tecidoSku: "SKU-123",
      tecidoNome: "Seda Floral",
    });

    expect(result).toMatchObject({
      url: "https://fal.test/person.png",
      trackingStatus: "healthy",
      executionId: expect.any(String),
      artifactId: expect.any(String),
    });
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect((subscribeMock.mock.calls[0][1] as any).input.image_urls).toEqual([
      "https://example.com/person.jpg",
      "https://example.com/croqui.png",
      "https://example.com/fabric.png",
    ]);
  });

  it("faz fallback para geração legada quando pipeline de tecido falha", async () => {
    subscribeMock
      .mockReset()
      .mockRejectedValueOnce(new Error("Fal indisponível"))
      .mockResolvedValueOnce({ images: [{ url: "https://fal.test/legacy.png" }] });

    const result = await executeServerFn(generateRealistaFn, {
      peca: "Vestido",
      cor: null,
      croquiUrl: "https://example.com/croqui.png",
      modo: "manequim",
      biotipo: "Ampulheta",
      tecidoImageUrl: "https://example.com/fabric.png",
      tecidoSku: "SKU-123",
      tecidoNome: "Seda Floral",
    });

    expect(result).toMatchObject({
      url: "https://fal.test/legacy.png",
      trackingStatus: "healthy",
      executionId: expect.any(String),
      artifactId: expect.any(String),
    });
    expect(subscribeMock).toHaveBeenCalledTimes(2);
    expect((subscribeMock.mock.calls[1][1] as any).input.image_urls).toEqual([
      "https://szbptnoviikflyzulhhs.supabase.co/storage/v1/object/public/elementos/manequins/ampulheta.jpg",
      "https://example.com/croqui.png",
      "https://example.com/fabric.png",
    ]);
  });
});
