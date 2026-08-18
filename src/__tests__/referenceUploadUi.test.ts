import { describe, expect, it } from "vitest";
import { isReferenceImageType, REFERENCE_FILE_ACCEPT } from "../lib/referenceUploadUi";

describe("seletor de imagens de referência", () => {
  it("mantém a galeria aberta para qualquer formato de imagem que o navegador suporte", () => {
    expect(REFERENCE_FILE_ACCEPT).toBe("image/*");
    expect(isReferenceImageType("image/jpeg")).toBe(true);
    expect(isReferenceImageType("image/heic")).toBe(true);
    expect(isReferenceImageType("application/pdf")).toBe(false);
  });
});
