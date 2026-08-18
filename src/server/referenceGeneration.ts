const REFERENCE_IMAGE_KEYS = ["image_url", "image_urls", "referenceImageUrl", "referenceImages", "fileBase64", "singleFileBase64", "topFileBase64", "bottomFileBase64"] as const;

export function assertReferenceGenerationTextOnly(data: Record<string, unknown>): void {
  if (!data.referenceAnalysis) return;
  const forbidden = REFERENCE_IMAGE_KEYS.filter((key) => data[key] !== undefined && data[key] !== null);
  if (forbidden.length) throw new Error("Geração de referência aceita somente especificações textuais; imagem de cliente não permitida.");
}

export function buildReferenceSeedreamInput(prompt: string) {
  return {
    prompt,
    image_size: "portrait_4_3",
    num_images: 1,
    enable_safety_checker: false,
  };
}
