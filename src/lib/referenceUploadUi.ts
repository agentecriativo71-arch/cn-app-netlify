export const REFERENCE_FILE_ACCEPT = "image/*";

export function isReferenceImageType(fileType: string): boolean {
  return fileType.toLowerCase().startsWith("image/");
}
