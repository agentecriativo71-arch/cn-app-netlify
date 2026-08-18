import type { CropPixels } from "./imageCrop";

export type NormalizedCrop = { x: number; y: number; width: number; height: number };

export const MIN_NORMALIZED_CROP_SIZE = 0.08;

export function createInitialReferenceCrop(): NormalizedCrop {
  return { x: 0.08, y: 0.08, width: 0.84, height: 0.84 };
}

export function clampReferenceCrop(crop: NormalizedCrop): NormalizedCrop {
  const width = Math.min(1, Math.max(MIN_NORMALIZED_CROP_SIZE, crop.width));
  const height = Math.min(1, Math.max(MIN_NORMALIZED_CROP_SIZE, crop.height));
  const x = Math.min(1 - width, Math.max(0, crop.x));
  const y = Math.min(1 - height, Math.max(0, crop.y));
  return { x, y, width, height };
}

export function normalizedCropToPixels(crop: NormalizedCrop, naturalWidth: number, naturalHeight: number): CropPixels {
  const safeCrop = clampReferenceCrop(crop);
  return {
    x: Math.round(safeCrop.x * naturalWidth),
    y: Math.round(safeCrop.y * naturalHeight),
    width: Math.max(1, Math.round(safeCrop.width * naturalWidth)),
    height: Math.max(1, Math.round(safeCrop.height * naturalHeight)),
  };
}
