import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSolveStore } from "@/lib/curriculumsolve/store";

/**
 * Marks every step as revealed. The spaced-repetition hand-off belongs here —
 * there is no SRS in the codebase yet, so this deliberately schedules nothing
 * rather than inventing a second review mechanism.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = createSolveStore();
  const session = await store.getSession(sessionId);
  if (!session || session.student_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const completed = await store.complete(sessionId);
  return NextResponse.json({
    sessionId: completed.id,
    completedAt: completed.completed_at,
  });
}
