import { describe, expect, it } from "vitest";
import { clampReferenceCrop, normalizedCropToPixels } from "../lib/referenceCrop";

describe("recorte dinâmico da referência", () => {
  it("converte largura e altura independentes para pixels", () => {
    expect(normalizedCropToPixels({ x: 0.1, y: 0.2, width: 0.5, height: 0.7 }, 1000, 2000)).toEqual({
      x: 100,
      y: 400,
      width: 500,
      height: 1400,
    });
  });

  it("mantém o recorte dentro da imagem e respeita um tamanho mínimo", () => {
    expect(clampReferenceCrop({ x: 0.9, y: -0.2, width: 0.01, height: 1.2 })).toEqual({
      x: 0.9,
      y: 0,
      width: 0.08,
      height: 1,
    });
  });
});
