import { describe, expect, it } from "vitest";
import { buildReferenceUploadPayload } from "../lib/referenceUpload";

describe("payload público do upload de referência", () => {
  it("envia somente o recorte único confirmado", () => {
    const payload = buildReferenceUploadPayload("sess-1", "single", { single: "data:image/jpeg;base64,crop" });

    expect(payload).toEqual({
      sessionId: "sess-1",
      mode: "single",
      images: [{ role: "single", dataUrl: "data:image/jpeg;base64,crop" }],
    });
    expect(payload).not.toHaveProperty("original");
    expect(payload).not.toHaveProperty("originalFile");
  });

  it("exige os dois recortes confirmados na composição", () => {
    expect(() => buildReferenceUploadPayload("sess-2", "composite", { top: "crop-top" })).toThrow(/cada imagem/i);
  });
});
