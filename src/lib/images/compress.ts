/**
 * Downscales and re-encodes a photo in the browser. Phone cameras produce
 * 3–8MB images, which the scan endpoint rejects and the OCR providers charge
 * for; a 1600px JPEG keeps handwriting legible at a fraction of the size.
 */
export const MAX_DIMENSION = 1600;
export const TARGET_BYTES = 900 * 1024;

const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality),
  );
}

export async function compressImage(
  file: File,
  { maxDimension = MAX_DIMENSION, targetBytes = TARGET_BYTES } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let best: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality);
    if (!blob) break;
    best = blob;
    if (blob.size <= targetBytes) break;
  }
  if (!best) return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([best], `${name}.jpg`, { type: "image/jpeg" });
}
