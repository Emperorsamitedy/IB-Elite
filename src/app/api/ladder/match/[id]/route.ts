import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";

/**
 * Match state for the runner: the match row, both sides' progress, and the
 * question content. Participants only — and the payload is safe to share
 * because both players see the same paper anyway; scores travel as position
 * and count only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const store = createSupabaseLadderStore();
  const match = await store.getMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  if (match.student_a_id !== user.id && match.student_b_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const progress = await store.listProgress(id);

  // Question content is read with the user's own client so RLS still applies.
  const { data: questionRows, error } = await supabase
    .from("questions")
    .select("id, title, prompt, answer, solution, marks, difficulty")
    .in("id", match.question_ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Restore match order — `.in()` returns rows in table order.
  const byId = new Map((questionRows ?? []).map((q) => [q.id, q]));
  const questions = match.question_ids
    .map((qid) => byId.get(qid))
    .filter((q) => q !== undefined);

  return NextResponse.json({ match, progress, questions });
}
