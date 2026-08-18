import { describe, expect, it } from "vitest";
import { MAX_REFERENCE_IMAGE_BYTES, ReferenceInputError, validateReferenceDataUrl, validateReferenceImages } from "../server/referenceInput";

const jpeg = (bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00])) => `data:image/jpeg;base64,${bytes.toString("base64")}`;
const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64")}`;
const webp = `data:image/webp;base64,${Buffer.from("RIFF0000WEBP").toString("base64")}`;

describe("validação server-side dos recortes", () => {
  it("aceita JPEG, PNG e WebP com assinatura real", () => {
    expect(validateReferenceDataUrl(jpeg()).mimeType).toBe("image/jpeg");
    expect(validateReferenceDataUrl(png).mimeType).toBe("image/png");
    expect(validateReferenceDataUrl(webp).mimeType).toBe("image/webp");
  });

  it("rejeita MIME declarado que não corresponde ao conteúdo", () => {
    const wrongMime = `data:image/jpeg;base64,${Buffer.from("RIFF0000WEBP").toString("base64")}`;
    expect(() => validateReferenceDataUrl(wrongMime)).toThrowError(ReferenceInputError);
  });

  it("rejeita base64 inválido e recorte acima de 8 MB", () => {
    expect(() => validateReferenceDataUrl("data:image/jpeg;base64,not valid" )).toThrowError(ReferenceInputError);
    expect(() => validateReferenceDataUrl(jpeg(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_REFERENCE_IMAGE_BYTES)])))).toThrowError(/8 MB/);
  });

  it("exige quantidade e ordem exatas para single/composite", () => {
    expect(validateReferenceImages("single", [{ role: "single", dataUrl: jpeg() }])).toHaveLength(1);
    expect(validateReferenceImages("composite", [{ role: "top", dataUrl: jpeg() }, { role: "bottom", dataUrl: jpeg() }])).toHaveLength(2);
    expect(() => validateReferenceImages("single", [])).toThrowError(/quantidade/);
    expect(() => validateReferenceImages("composite", [{ role: "bottom", dataUrl: jpeg() }, { role: "top", dataUrl: jpeg() }])).toThrowError(ReferenceInputError);
  });
});
