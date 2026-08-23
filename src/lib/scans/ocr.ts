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
 * engine 3 mangles it — with OCR.space as the fallback. OCR.space always
 * answers, on its shared demo key when no key of our own is set, so the last
 * branch is only reachable if that ever stops being true.
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
