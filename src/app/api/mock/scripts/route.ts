import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMockStore } from "@/lib/mock/supabase-store";
import { createSupabaseScanStorage } from "@/lib/scans/supabase-store";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/scans/upload";
import { sittingPhase } from "@/lib/mock/windows";
import { rateLimitOk, RATE_LIMITED_MESSAGE } from "@/lib/anti-abuse";
import { mockErrorResponse, requireMockUser } from "../util";

export const maxDuration = 60;

/** Uploads one page of the handwritten script during the exam window. */
export async function POST(request: NextRequest) {
  const gate = await requireMockUser();
  if ("error" in gate) return gate.error;
  if (!(await rateLimitOk("mockScript", gate.user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const sittingId = form?.get("sittingId");
  if (!(file instanceof File) || typeof sittingId !== "string") {
    return NextResponse.json(
      { error: "Expected multipart fields `file` and `sittingId`" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 400 });
  }

  try {
    const store = createSupabaseMockStore();
    const sitting = await store.getSitting(sittingId);
    if (!sitting) {
      return NextResponse.json({ error: "Sitting not found" }, { status: 404 });
    }
    // Pages upload during the window (grace covers submit, not new pages).
    if (sittingPhase(sitting, new Date()) !== "open") {
      return NextResponse.json({ error: "The window has closed" }, { status: 409 });
    }
    const entry = await store.getEntry(sittingId, gate.user.id);
    if (!entry?.started_at) {
      return NextResponse.json({ error: "Start the paper first" }, { status: 409 });
    }
    if (entry.submitted_at) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    const existing = await store.listScripts(entry.id);
    if (existing.length >= 12) {
      return NextResponse.json({ error: "Page limit reached" }, { status: 400 });
    }

    const storage = createSupabaseScanStorage();
    const path = await storage.upload({
      studentId: gate.user.id,
      fileName: file.name || "page.jpg",
      contentType: file.type,
      body: await file.arrayBuffer(),
    });
    const script = await store.addScript(entry.id, existing.length, path);
    return NextResponse.json({
      script: { id: script.id, pageIndex: script.page_index },
      pages: existing.length + 1,
    });
  } catch (error) {
    return mockErrorResponse(error);
  }
}
