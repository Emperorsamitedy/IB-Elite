import type { AnnotationResult, OcrWord, Scan, ScanStatus } from "./types";

/**
 * Storage seam for scan rows. `supabase-store.ts` talks to Postgres;
 * the tests use an in-memory fake.
 */
export type ScanStore = {
  createScan(input: {
    studentId: string;
    questionId: string;
    imageUrl: string;
  }): Promise<Scan>;
  getScan(scanId: string): Promise<Scan | null>;
  setStatus(scanId: string, status: ScanStatus): Promise<Scan>;
  saveOcr(
    scanId: string,
    ocr: { text: string; words: OcrWord[] },
  ): Promise<Scan>;
  saveAnnotation(scanId: string, result: AnnotationResult): Promise<Scan>;
  fail(scanId: string, message: string): Promise<Scan>;
  /** Mark-scheme text used by the matcher. */
  getMarkScheme(questionId: string): Promise<{ answer: string | null; marks: number }>;
};
