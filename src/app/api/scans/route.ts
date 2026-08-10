import { NextResponse, type NextRequest } from "next/server";
import { processScan } from "@/lib/scans/process";
import {
  createSupabaseScanStorage,
  createSupabaseScanStore,
} from "@/lib/scans/supabase-store";
import { createOcrSpaceOcr } from "@/lib/scans/ocr-space";
import { ScanUploadError, uploadScan } from "@/lib/scans/upload";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const questionId = form?.get("questionId");
  if (!(file instanceof File) || typeof questionId !== "string") {
    return NextResponse.json(
      { error: "Expected multipart fields `file` and `questionId`" },
      { status: 400 },
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

    // Fire and forget: processScan never throws, it records FAILED instead.
    void processScan(store, createOcrSpaceOcr(storage), scan.id);

    return NextResponse.json(
      { scanId: scan.id, status: scan.status },
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
