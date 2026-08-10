import type { ScanStore } from "./store";
import type { Scan, ScanStorage } from "./types";

/** Matches the OCR.space free tier, so an oversized file fails at upload
 * rather than silently later, in the background OCR pass. */
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type UploadInput = {
  studentId: string;
  questionId: string;
  fileName: string;
  contentType: string;
  body: ArrayBuffer;
};

export class ScanUploadError extends Error {}

/**
 * Stores the image and opens a scan row. OCR runs separately so the request
 * returns a scanId immediately.
 */
export async function uploadScan(
  store: ScanStore,
  storage: ScanStorage,
  input: UploadInput,
): Promise<Scan> {
  if (!ALLOWED_TYPES.includes(input.contentType)) {
    throw new ScanUploadError(`Unsupported image type ${input.contentType}`);
  }
  if (input.body.byteLength === 0) {
    throw new ScanUploadError("Image is empty");
  }
  if (input.body.byteLength > MAX_UPLOAD_BYTES) {
    throw new ScanUploadError("Image is larger than 1MB");
  }

  const imageUrl = await storage.upload({
    studentId: input.studentId,
    fileName: input.fileName,
    contentType: input.contentType,
    body: input.body,
  });

  return store.createScan({
    studentId: input.studentId,
    questionId: input.questionId,
    imageUrl,
  });
}
