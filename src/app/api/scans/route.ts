import { NextResponse, type NextRequest } from "next/server";
import { processScan } from "@/lib/scans/process";
import {
  createSupabaseScanStorage,
  createSupabaseScanStore,
} from "@/lib/scans/supabase-store";
import { createScanOcr, isScanOcrConfigured } from "@/lib/scans/ocr";
import { ScanUploadError, uploadScan } from "@/lib/scans/upload";
import { createClient } from "@/lib/supabase/server";
import { rateLimitOk, RATE_LIMITED_MESSAGE } from "@/lib/anti-abuse";
import { createAdminClient } from "@/lib/supabase/admin";

/** OCR plus marking runs inside the request: a serverless function can be
 * frozen the moment it responds, so fire-and-forget work never finished and
 * scans sat in UPLOADED for ever. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await rateLimitOk("scanUpload", user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }


  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const questionId = form?.get("questionId");
  if (!(file instanceof File) || typeof questionId !== "string") {
    return NextResponse.json(
      { error: "Expected multipart fields `file` and `questionId`" },
      { status: 400 },
    );
  }

  if (!isScanOcrConfigured()) {
    return NextResponse.json(
      {
        error:
          "Handwriting recognition is not configured on the server yet, so we cannot mark a photo.",
      },
      { status: 503 },
    );
  }

  const store = createSupabaseScanStore();
  const storage = createSupabaseScanStorage();

  try {
    const scan = await uploadScan(store, storage, {
      studentId: user.id,
      questionId,
      fileName: file.name || "scan.jpg",
      contentType: file.type,
      body: await file.arrayBuffer(),
    });

    // processScan never throws; it records FAILED with a message instead.
    const processed = await processScan(store, createScanOcr(storage), scan.id);

    // Graded practice feeds the performance ledger (school scores, Signal).
    if (processed?.status === "ANNOTATED" && processed.annotation_result) {
      const annotation = processed.annotation_result;
      const { data: question } = await supabase
        .from("questions")
        .select("subject_id, topic_id")
        .eq("id", questionId)
        .maybeSingle();
      await createAdminClient()
        .from("performance_events")
        .insert({
          user_id: user.id,
          subject_id: question?.subject_id ?? null,
          kind: "practice_result",
          payload: {
            scanId: scan.id,
            questionId,
            topicId: question?.topic_id ?? null,
            awarded: annotation.awarded,
            total: annotation.total,
            source: annotation.source,
          },
        })
        .then(() => undefined, () => undefined); // ledger writes never block a scan
    }

    return NextResponse.json(
      { scanId: scan.id, status: processed?.status ?? scan.status },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof ScanUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
