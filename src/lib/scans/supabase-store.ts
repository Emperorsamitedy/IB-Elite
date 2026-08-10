import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ScanStore } from "./store";
import type {
  AnnotationResult,
  OcrWord,
  Scan,
  ScanStatus,
  ScanStorage,
} from "./types";

export const SCANS_BUCKET = "scans";
const SIGNED_URL_SECONDS = 60 * 10;

const SCAN_COLUMNS =
  "id, student_id, question_id, image_url, ocr_text, ocr_bounding_boxes, annotation_result, status, error_message";

type AdminClient = ReturnType<typeof createAdminClient>;

type ScanRow = Omit<Scan, "ocr_bounding_boxes" | "annotation_result" | "status"> & {
  ocr_bounding_boxes: unknown;
  annotation_result: unknown;
  status: string;
};

function asScan(row: ScanRow): Scan {
  return {
    ...row,
    ocr_bounding_boxes: (row.ocr_bounding_boxes as OcrWord[] | null) ?? null,
    annotation_result: (row.annotation_result as AnnotationResult | null) ?? null,
    status: row.status as ScanStatus,
  };
}

export function createSupabaseScanStore(
  client: AdminClient = createAdminClient(),
): ScanStore {
  async function update(
    scanId: string,
    patch: Record<string, unknown>,
  ): Promise<Scan> {
    const { data, error } = await client
      .from("scans")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", scanId)
      .select(SCAN_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return asScan(data);
  }

  return {
    async createScan(input) {
      const { data, error } = await client
        .from("scans")
        .insert({
          student_id: input.studentId,
          question_id: input.questionId,
          image_url: input.imageUrl,
          status: "UPLOADED",
        })
        .select(SCAN_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return asScan(data);
    },

    async getScan(scanId) {
      const { data } = await client
        .from("scans")
        .select(SCAN_COLUMNS)
        .eq("id", scanId)
        .maybeSingle();
      return data ? asScan(data) : null;
    },

    async setStatus(scanId, status) {
      return update(scanId, { status });
    },

    async saveOcr(scanId, ocr) {
      return update(scanId, {
        ocr_text: ocr.text,
        ocr_bounding_boxes: ocr.words,
      });
    },

    async saveAnnotation(scanId, result) {
      return update(scanId, { annotation_result: result });
    },

    async fail(scanId, message) {
      return update(scanId, { status: "FAILED", error_message: message });
    },

    async getMarkScheme(questionId) {
      const { data } = await client
        .from("questions")
        .select("answer, solution, marks")
        .eq("id", questionId)
        .maybeSingle();
      return {
        answer: data?.answer ?? data?.solution ?? null,
        marks: data?.marks ?? 0,
      };
    },
  };
}

/** Private Supabase Storage bucket, behind the same seam an S3 impl would use. */
export function createSupabaseScanStorage(
  client: AdminClient = createAdminClient(),
): ScanStorage {
  return {
    async upload({ studentId, fileName, contentType, body }) {
      const path = `${studentId}/${crypto.randomUUID()}-${fileName}`;
      const { error } = await client.storage
        .from(SCANS_BUCKET)
        .upload(path, body, { contentType, upsert: false });
      if (error) throw new Error(error.message);
      return path;
    },

    async signedUrl(path) {
      const { data, error } = await client.storage
        .from(SCANS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },

    async download(path) {
      const { data, error } = await client.storage
        .from(SCANS_BUCKET)
        .download(path);
      if (error) throw new Error(error.message);
      return data.arrayBuffer();
    },
  };
}
