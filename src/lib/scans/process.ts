import { gradeScan } from "./grade";
import type { ScanStore } from "./store";
import type { Scan, ScanOcr } from "./types";

/**
 * Runs OCR then rubric matching for one scan. Every failure is recorded on the
 * row as FAILED with a message — this never throws, so the caller (a
 * fire-and-forget upload handler) cannot be taken down by it.
 */
export async function processScan(
  store: ScanStore,
  ocr: ScanOcr,
  scanId: string,
): Promise<Scan | null> {
  try {
    const scan = await store.getScan(scanId);
    if (!scan) return null;

    await store.setStatus(scanId, "PROCESSING");

    const result = await ocr.read(scan.image_url);
    await store.saveOcr(scanId, { text: result.text, words: result.words });

    const context = await store.getQuestionContext(scan.question_id);
    const annotation = await gradeScan(result, context);

    await store.saveAnnotation(scanId, annotation);
    return store.setStatus(scanId, "ANNOTATED");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan processing failed";
    try {
      return await store.fail(scanId, message);
    } catch {
      return null;
    }
  }
}
