export const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_REFERENCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ReferenceImageRole = "single" | "top" | "bottom";
export type ReferenceImageInput = { role: ReferenceImageRole; dataUrl: string };

export class ReferenceInputError extends Error {
  readonly code: "invalid_count" | "invalid_data_url" | "invalid_mime" | "too_large" | "piece_mode_mismatch";

  constructor(code: ReferenceInputError["code"], message: string) {
    super(message);
    this.name = "ReferenceInputError";
    this.code = code;
  }
}

function hasValidMagicBytes(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

export function validateReferenceDataUrl(dataUrl: unknown): { dataUrl: string; mimeType: (typeof ALLOWED_REFERENCE_MIME_TYPES)[number]; byteLength: number } {
  if (typeof dataUrl !== "string") throw new ReferenceInputError("invalid_data_url", "O recorte deve ser uma Data URL.");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new ReferenceInputError("invalid_data_url", "O recorte deve ser JPEG, PNG ou WebP em base64.");
  const mimeType = match[1] as (typeof ALLOWED_REFERENCE_MIME_TYPES)[number];
  const payload = match[2];
  if (payload.length % 4 === 1) throw new ReferenceInputError("invalid_data_url", "A Data URL possui base64 inválido.");
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length || !hasValidMagicBytes(mimeType, bytes)) throw new ReferenceInputError("invalid_mime", "O conteúdo real do recorte não corresponde ao MIME declarado.");
  if (bytes.length > MAX_REFERENCE_IMAGE_BYTES) throw new ReferenceInputError("too_large", "O recorte excede o limite de 8 MB.");
  return { dataUrl, mimeType, byteLength: bytes.length };
}

export function validateReferenceImages(mode: "single" | "composite", images: unknown): ReferenceImageInput[] {
  const expectedRoles: ReferenceImageRole[] = mode === "single" ? ["single"] : ["top", "bottom"];
  if (!Array.isArray(images) || images.length !== expectedRoles.length) throw new ReferenceInputError("invalid_count", "A quantidade de recortes não corresponde ao modo selecionado.");
  return images.map((image, index) => {
    if (!image || typeof image !== "object") throw new ReferenceInputError("invalid_data_url", "Recorte inválido.");
    const candidate = image as Partial<ReferenceImageInput>;
    if (candidate.role !== expectedRoles[index]) throw new ReferenceInputError("invalid_count", "A ordem dos recortes não corresponde aos papéis esperados.");
    const validated = validateReferenceDataUrl(candidate.dataUrl);
    return { role: candidate.role, dataUrl: validated.dataUrl } as ReferenceImageInput;
  });
}
