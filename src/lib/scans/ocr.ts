import "server-only";
import { createGeminiOcr, isGeminiConfigured } from "./gemini";
import { createOcrSpaceOcr, isOcrConfigured } from "./ocr-space";
import type { ScanOcr, ScanStorage } from "./types";

/** True when at least one handwriting engine is configured. */
export function isScanOcrConfigured(): boolean {
  return isGeminiConfigured() || isOcrConfigured();
}

/**
 * Gemini first — it reads mathematics and returns LaTeX, where OCR.space
 * engine 3 mangles it — with OCR.space as the fallback. When neither key is
 * set, `read` throws a message the student can act on rather than the scan
 * hanging in PROCESSING for ever.
 */
export function createScanOcr(storage: ScanStorage): ScanOcr {
  if (isGeminiConfigured()) return createGeminiOcr(storage);
  if (isOcrConfigured()) return createOcrSpaceOcr(storage);
  return {
    async read() {
      throw new Error(
        "Handwriting recognition is not configured yet — no GEMINI_API_KEY or OCR_SPACE_API_KEY on the server.",
      );
    },
  };
}
