import { NextResponse } from "next/server";
import {
  createSupabaseScanStorage,
  createSupabaseScanStore,
} from "@/lib/scans/supabase-store";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const scan = await createSupabaseScanStore().getScan(id);
    if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (scan.student_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const imageUrl = await createSupabaseScanStorage().signedUrl(scan.image_url);

    return NextResponse.json({
      scanId: scan.id,
      status: scan.status,
      imageUrl,
      errorMessage: scan.error_message,
      transcript: scan.status === "ANNOTATED" ? scan.ocr_text : null,
      annotationResult: scan.status === "ANNOTATED" ? scan.annotation_result : null,
      boundingBoxes: scan.status === "ANNOTATED" ? scan.ocr_bounding_boxes : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
