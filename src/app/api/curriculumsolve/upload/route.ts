import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/subscription";
import { createOcrSpaceOcr } from "@/lib/scans/ocr-space";
import { createSupabaseScanStorage } from "@/lib/scans/supabase-store";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from "@/lib/scans/upload";
import { checkSolveUsage } from "@/lib/curriculumsolve/usage";
import { classifyProblem, effectiveLevel } from "@/lib/curriculumsolve/classify";
import { retrieveContext } from "@/lib/curriculumsolve/retrieve";
import { gradeAndSolve } from "@/lib/curriculumsolve/grade";
import {
  createOpenAiSolveClient,
  createRetrievalSource,
  createSolveStore,
  loadCatalogue,
  outcomePatch,
} from "@/lib/curriculumsolve/store";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = createSolveStore();

  // Gate before any storage or OCR spend.
  const entitlement = await getEntitlement(user.id);
  const usage = checkSolveUsage(
    entitlement.isPro,
    await store.usageToday(user.id),
  );
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "daily_limit", message: usage.message },
      { status: 429 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Expected a multipart `file` field" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type ${file.type}` },
      { status: 400 },
    );
  }
  const body = await file.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 1MB" },
      { status: 400 },
    );
  }

  const storage = createSupabaseScanStorage();
  const imageUrl = await storage.upload({
    studentId: user.id,
    fileName: file.name || "problem.jpg",
    contentType: file.type,
    body,
  });

  const session = await store.createSession({ studentId: user.id, imageUrl });
  await store.recordUsage(user.id);

  try {
    const ocr = await createOcrSpaceOcr(storage).read(imageUrl);
    const catalogue = await loadCatalogue();
    const match = classifyProblem(ocr.text, catalogue);
    const entry = catalogue.find(
      (c) => c.topicId === match.topicId && c.subtopicId === match.subtopicId,
    );

    const context = await retrieveContext(
      match.topicId,
      match.subtopicId,
      createRetrievalSource(),
    );
    const outcome = await gradeAndSolve(
      ocr.text,
      context,
      entry ? effectiveLevel(entry.topicLevel, entry.subtopicLevel) : null,
      createOpenAiSolveClient(),
    );

    const saved = await store.saveResult(session.id, {
      ocr_text: ocr.text,
      subject_id: match.subjectId,
      topic_id: match.topicId,
      subtopic_id: match.subtopicId,
      retrieved_context: context,
      ...outcomePatch(outcome),
    });

    return NextResponse.json(
      { sessionId: saved.id, verdict: saved.verdict, message: outcome.message },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Solve failed";
    await store.saveResult(session.id, {
      verdict: "INSUFFICIENT_DATA",
      steps: [],
      source_citations: [],
    });
    return NextResponse.json({ sessionId: session.id, error: message }, { status: 502 });
  }
}
