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

/**
 * Removes the only identity-bearing area we need for garment analysis and
 * replaces the outer background with a neutral board. Original photo never
 * leaves the device; this function receives only the confirmed crop.
 */
export function anonymizeCropDataUrl(imageSrc: string, options: { quality?: number; maxSide?: number; maxBytes?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSide = options.maxSide || MAX_CROP_SIDE;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Não foi possível anonimizar o recorte."));
      context.fillStyle = "#f7f7f5";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      // Flood-fill background from corners. Keeps central garment pixels while
      // removing connected wall/floor/background regions before export.
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const visited = new Uint8Array(canvas.width * canvas.height);
      const queue: number[] = [0, canvas.width - 1, (canvas.height - 1) * canvas.width, canvas.width * canvas.height - 1];
      const seed = [pixels.data[0], pixels.data[1], pixels.data[2]];
      const closeToBackground = (offset: number) => Math.abs(pixels.data[offset] - seed[0]) + Math.abs(pixels.data[offset + 1] - seed[1]) + Math.abs(pixels.data[offset + 2] - seed[2]) < 72;
      while (queue.length) {
        const index = queue.pop()!;
        if (index < 0 || index >= visited.length || visited[index] || !closeToBackground(index * 4)) continue;
        visited[index] = 1;
        const offset = index * 4;
        pixels.data[offset] = 247; pixels.data[offset + 1] = 247; pixels.data[offset + 2] = 245;
        const x = index % canvas.width;
        if (x > 0) queue.push(index - 1);
        if (x < canvas.width - 1) queue.push(index + 1);
        if (index >= canvas.width) queue.push(index - canvas.width);
        if (index < visited.length - canvas.width) queue.push(index + canvas.width);
      }
      context.putImageData(pixels, 0, 0);

      // Cover face/head zone. Garment starts below this band in supported crops.
      const faceHeight = Math.round(canvas.height * 0.18);
      const faceWidth = Math.round(canvas.width * 0.42);
      context.fillStyle = "#d1d5db";
      context.beginPath();
      context.ellipse(canvas.width / 2, faceHeight * 0.52, faceWidth / 2, Math.max(1, faceHeight * 0.48), 0, 0, Math.PI * 2);
      context.fill();

      // Keep a neutral margin around the subject, reducing background leakage.
      const marginX = Math.round(canvas.width * 0.04);
      const marginY = Math.round(canvas.height * 0.02);
      context.fillStyle = "#f7f7f5";
      context.fillRect(0, 0, marginX, canvas.height);
      context.fillRect(canvas.width - marginX, 0, marginX, canvas.height);
      context.fillRect(0, 0, canvas.width, marginY);
      context.fillRect(0, canvas.height - marginY, canvas.width, marginY);

      const maxBytes = options.maxBytes || MAX_CROP_BYTES;
      for (const quality of [options.quality || 0.88, 0.78, 0.68, 0.58]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlByteLength(dataUrl) <= maxBytes) return resolve(dataUrl);
      }
      reject(new Error("O recorte anonimizado excede o limite de 8 MB."));
    };
    image.onerror = () => reject(new Error("Não foi possível ler o recorte para anonimização."));
    image.src = imageSrc;
  });
}

export async function deriveGarmentDetailCrops(imageSrc: string): Promise<string[]> {
  const segments = [
    { top: 0.12, bottom: 0.42 }, // gola e busto
    { top: 0.30, bottom: 0.62 }, // cintura e construção
    { top: 0.48, bottom: 1 },    // saia e barra
  ];
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const candidate = new Image();
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error("Não foi possível preparar detalhes do recorte."));
    candidate.src = imageSrc;
  });
  return Promise.all(segments.map((segment) => cropImageToDataUrl(imageSrc, {
    x: 0,
    y: Math.round(image.naturalHeight * segment.top),
    width: image.naturalWidth,
    height: Math.max(1, Math.round(image.naturalHeight * (segment.bottom - segment.top))),
  }, { maxSide: 1536, maxBytes: 4 * 1024 * 1024 })));
}
