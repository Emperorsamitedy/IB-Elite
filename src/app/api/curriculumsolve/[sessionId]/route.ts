import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSolveStore } from "@/lib/curriculumsolve/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await createSolveStore().getSession(sessionId);
  if (!session || session.student_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    verdict: session.verdict,
    steps: session.steps,
    sourceCitations: session.source_citations,
    topicId: session.topic_id,
    subtopicId: session.subtopic_id,
    completedAt: session.completed_at,
  });
}
