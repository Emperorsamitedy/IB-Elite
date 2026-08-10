import type { ScanStore } from "./store";
import type { Scan, ScanStorage } from "./types";

export type FakeScanStore = ScanStore & { scans: Scan[] };

/** In-memory scan store for the unit tests. */
export function createFakeScanStore(
  markSchemes: Record<string, { answer: string | null; marks: number }> = {},
): FakeScanStore {
  const scans: Scan[] = [];
  let counter = 0;

  function find(scanId: string): Scan {
    const scan = scans.find((s) => s.id === scanId);
    if (!scan) throw new Error("Scan not found");
    return scan;
  }

  const store: ScanStore = {
    async createScan(input) {
      const scan: Scan = {
        id: `scan-${++counter}`,
        student_id: input.studentId,
        question_id: input.questionId,
        image_url: input.imageUrl,
        ocr_text: null,
        ocr_bounding_boxes: null,
        annotation_result: null,
        status: "UPLOADED",
        error_message: null,
      };
      scans.push(scan);
      return scan;
    },
    async getScan(scanId) {
      return scans.find((s) => s.id === scanId) ?? null;
    },
    async setStatus(scanId, status) {
      const scan = find(scanId);
      scan.status = status;
      return scan;
    },
    async saveOcr(scanId, ocr) {
      const scan = find(scanId);
      scan.ocr_text = ocr.text;
      scan.ocr_bounding_boxes = ocr.words;
      return scan;
    },
    async saveAnnotation(scanId, result) {
      const scan = find(scanId);
      scan.annotation_result = result;
      return scan;
    },
    async fail(scanId, message) {
      const scan = find(scanId);
      scan.status = "FAILED";
      scan.error_message = message;
      return scan;
    },
    async getMarkScheme(questionId) {
      return markSchemes[questionId] ?? { answer: null, marks: 0 };
    },
  };

  return Object.assign(store, { scans });
}

/** In-memory storage that records what was uploaded. */
export function createFakeScanStorage(): ScanStorage & { objects: string[] } {
  const objects: string[] = [];
  return {
    objects,
    async upload({ studentId, fileName }) {
      const path = `${studentId}/${objects.length}-${fileName}`;
      objects.push(path);
      return path;
    },
    async signedUrl(path) {
      return `https://storage.test/${path}`;
    },
    async download() {
      return new ArrayBuffer(8);
    },
  };
}
