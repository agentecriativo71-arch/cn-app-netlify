export type ReferenceUploadMode = "single" | "composite";
export type ReferenceCropSelection = {
  single?: string | null;
  top?: string | null;
  bottom?: string | null;
};

export function buildReferenceUploadPayload(sessionId: string, mode: ReferenceUploadMode, crops: ReferenceCropSelection) {
  const images = mode === "single"
    ? [{ role: "single" as const, dataUrl: crops.single }]
    : [{ role: "top" as const, dataUrl: crops.top }, { role: "bottom" as const, dataUrl: crops.bottom }];

  if (images.some((image) => typeof image.dataUrl !== "string" || image.dataUrl.length === 0)) {
    throw new Error("Cada imagem de referência precisa ter um recorte confirmado.");
  }

  return { sessionId, mode, images };
}
