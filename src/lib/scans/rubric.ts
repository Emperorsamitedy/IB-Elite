import type { AnnotationResult, BoundingBox, MarkPoint, OcrResult } from "./types";

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
 * Box of the first OCR line containing any of `needles`, so an overlay has
 * somewhere to point. Substring, not equality: handwriting OCR returns one
 * "word" per line, so the anchor is the line holding the phrase.
 */
export function findAnchor(
  ocr: OcrResult,
  needles: string[],
): BoundingBox | null {
  const wanted = needles
    .map((needle) => needle.toLowerCase().trim())
    .filter((needle) => needle.length > 2);
  if (wanted.length === 0) return null;
  const hit = ocr.words.find((word) => {
    const text = word.text.toLowerCase();
    return wanted.some((needle) => text.includes(needle) || needle.includes(text));
  });
  return hit?.box ?? null;
}

/**
 * Keyword fallback used when no AI marker is configured: a mark point counts
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
    // Substring, not equality: OCR.space engine 3 returns one "word" per line
    // for handwriting, so the anchor box is the line containing the keyword.
    return { text, present, box: present ? findAnchor(ocr, hits) : null };
  });

  const awarded = markPoints.filter((point) => point.present).length;
  return {
    markPoints,
    awarded: Math.min(awarded, totalMarks),
    total: totalMarks || markPoints.length,
    source: "keywords",
  };
}
