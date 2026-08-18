export type CropPixels = { x: number; y: number; width: number; height: number };
export const MAX_CROP_SIDE = 2048;
export const MAX_CROP_BYTES = 8 * 1024 * 1024;

function dataUrlByteLength(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil(payload.length * 3 / 4);
}

export function cropImageToDataUrl(imageSrc: string, crop: CropPixels, options: { quality?: number; maxSide?: number; maxBytes?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSide = options.maxSide || MAX_CROP_SIDE;
      const scale = Math.min(1, maxSide / Math.max(crop.width, crop.height));
      canvas.width = Math.max(1, Math.round(crop.width * scale));
      canvas.height = Math.max(1, Math.round(crop.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Não foi possível preparar o recorte da imagem."));
        return;
      }
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      const maxBytes = options.maxBytes || MAX_CROP_BYTES;
      const initialQuality = options.quality || 0.9;
      const qualities = [initialQuality, 0.82, 0.74, 0.66, 0.58];
      for (const quality of qualities) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlByteLength(dataUrl) <= maxBytes) {
          resolve(dataUrl);
          return;
        }
      }
      reject(new Error("O recorte excede o limite de 8 MB mesmo após compressão."));
    };
    image.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    image.src = imageSrc;
  });
}
