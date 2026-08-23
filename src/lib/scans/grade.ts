import "server-only";
import { gradeWithGemini, isGeminiConfigured } from "./gemini";
import { findAnchor, generateRubricFeedback } from "./rubric";
import type { AnnotationResult, OcrResult, QuestionContext } from "./types";

/**
 * Marks a transcript against the question's mark scheme. Gemini marks it as an
 * examiner would when a key is configured; otherwise the keyword matcher runs
 * and the result is labelled `keywords` so the UI can say so.
 */
export async function gradeScan(
  ocr: OcrResult,
  context: QuestionContext,
): Promise<AnnotationResult> {
  const markScheme = context.answer ?? context.solution;

  if (!isGeminiConfigured() || !markScheme || !ocr.text.trim()) {
    return generateRubricFeedback(ocr, markScheme, context.marks);
  }

  const grade = await gradeWithGemini(ocr.text, context);

  return {
    markPoints: grade.markPoints.map((point) => ({
      text: point.text,
      present: point.present,
      comment: point.comment,
      box: point.evidence ? findAnchor(ocr, [point.evidence]) : null,
    })),
    awarded: grade.awarded,
    total: context.marks || grade.markPoints.length,
    feedback: grade.feedback || null,
    source: "ai",
  };
}
