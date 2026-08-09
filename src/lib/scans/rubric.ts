import type { AnnotationResult, MarkPoint, OcrResult } from "./types";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "for", "with",
  "that", "this", "as", "by", "on", "at", "it", "be", "from",
]);

function keywords(point: string): string[] {
  return point
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/** Mark schemes list one point per line or per semicolon. */
export function splitMarkScheme(answer: string): string[] {
  return answer
    .split(/[\n;]+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Placeholder matcher until the real rubric engine exists: a mark point counts
 * as present when every one of its keywords appears in the OCR text, and the
 * box is the first matching word's box so the overlay has somewhere to point.
 */
export function generateRubricFeedback(
  ocr: OcrResult,
  markScheme: string | null,
  totalMarks: number,
): AnnotationResult {
  const points = markScheme ? splitMarkScheme(markScheme) : [];
  const haystack = ocr.text.toLowerCase();

  const markPoints: MarkPoint[] = points.map((text) => {
    const words = keywords(text);
    const hits = words.filter((word) => haystack.includes(word));
    const present = words.length > 0 && hits.length === words.length;
    const anchor = present
      ? (ocr.words.find((w) => hits.includes(w.text.toLowerCase())) ?? null)
      : null;
    return { text, present, box: anchor?.box ?? null };
  });

  const awarded = markPoints.filter((point) => point.present).length;
  return {
    markPoints,
    awarded: Math.min(awarded, totalMarks),
    total: totalMarks || markPoints.length,
  };
}
