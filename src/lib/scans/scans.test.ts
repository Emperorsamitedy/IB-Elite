import { describe, expect, it, vi } from "vitest";
import { createFakeScanStorage, createFakeScanStore } from "./fake-store";
import { processScan } from "./process";
import { ScanUploadError, uploadScan } from "./upload";
import type { OcrResult, ScanOcr } from "./types";

const STUDENT = "student-1";
const QUESTION = "question-1";

const MARK_SCHEME = {
  [QUESTION]: {
    answer:
      "Momentum is conserved in the collision;\nKinetic energy is not conserved;\nThe collision is inelastic",
    marks: 3,
  },
};

function image(bytes = 32): ArrayBuffer {
  return new ArrayBuffer(bytes);
}

function ocrReturning(result: OcrResult): ScanOcr {
  return { read: vi.fn(async () => result) };
}

describe("uploadScan", () => {
  it("creates an UPLOADED row and returns a scan id without running OCR", async () => {
    const store = createFakeScanStore(MARK_SCHEME);
    const storage = createFakeScanStorage();

    const scan = await uploadScan(store, storage, {
      studentId: STUDENT,
      questionId: QUESTION,
      fileName: "answer.jpg",
      contentType: "image/jpeg",
      body: image(),
    });

    expect(scan.id).toBeTruthy();
    expect(scan.status).toBe("UPLOADED");
    expect(scan.ocr_text).toBeNull();
    expect(scan.annotation_result).toBeNull();
    expect(store.scans).toHaveLength(1);
    expect(storage.objects).toEqual([scan.image_url]);
  });

  it("rejects a non-image upload", async () => {
    const store = createFakeScanStore();
    const storage = createFakeScanStorage();

    await expect(
      uploadScan(store, storage, {
        studentId: STUDENT,
        questionId: QUESTION,
        fileName: "notes.pdf",
        contentType: "application/pdf",
        body: image(),
      }),
    ).rejects.toBeInstanceOf(ScanUploadError);
    expect(store.scans).toHaveLength(0);
  });
});

describe("processScan", () => {
  it("stores OCR text and reaches ANNOTATED", async () => {
    const store = createFakeScanStore(MARK_SCHEME);
    const storage = createFakeScanStorage();
    const scan = await uploadScan(store, storage, {
      studentId: STUDENT,
      questionId: QUESTION,
      fileName: "answer.jpg",
      contentType: "image/jpeg",
      body: image(),
    });

    const ocr = ocrReturning({
      text: "Momentum is conserved in the collision but kinetic energy is not conserved",
      words: [
        { text: "Momentum", box: { x: 10, y: 20, width: 90, height: 18 } },
        { text: "kinetic", box: { x: 10, y: 48, width: 70, height: 18 } },
      ],
    });

    const processed = await processScan(store, ocr, scan.id);

    expect(processed?.status).toBe("ANNOTATED");
    expect(processed?.ocr_text).toContain("Momentum is conserved");
    expect(processed?.ocr_bounding_boxes).toHaveLength(2);
    expect(processed?.error_message).toBeNull();

    const annotation = processed?.annotation_result;
    expect(annotation?.total).toBe(3);
    expect(annotation?.markPoints).toHaveLength(3);
    expect(annotation?.markPoints[0]).toMatchObject({ present: true });
    // The third point ("inelastic") is not in the OCR text.
    expect(annotation?.markPoints[2]).toMatchObject({ present: false, box: null });
    expect(annotation?.awarded).toBe(2);
  });

  it("records FAILED with the error message when OCR rejects, without throwing", async () => {
    const store = createFakeScanStore(MARK_SCHEME);
    const storage = createFakeScanStorage();
    const scan = await uploadScan(store, storage, {
      studentId: STUDENT,
      questionId: QUESTION,
      fileName: "answer.jpg",
      contentType: "image/jpeg",
      body: image(),
    });

    const ocr: ScanOcr = {
      read: vi.fn(async () => {
        throw new Error("OCR.space request failed with status 429");
      }),
    };

    const processed = await processScan(store, ocr, scan.id);

    expect(processed?.status).toBe("FAILED");
    expect(processed?.error_message).toBe("OCR.space request failed with status 429");
    expect(processed?.annotation_result).toBeNull();
  });

  it("returns null for an unknown scan", async () => {
    const store = createFakeScanStore();
    const ocr = ocrReturning({ text: "", words: [] });
    await expect(processScan(store, ocr, "missing")).resolves.toBeNull();
  });
});
