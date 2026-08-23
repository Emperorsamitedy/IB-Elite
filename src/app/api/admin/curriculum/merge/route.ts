import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeSchema } from "@/lib/admin/curriculum";
import { requireAdminApi } from "../../auth";

/**
 * Moves every question (and subtopic) from one topic into another, then
 * archives the source. Nothing is deleted, so a wrong merge can be undone by
 * hand.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const parsed = mergeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { source_id, target_id } = parsed.data;
  const supabase = createAdminClient();

  const { data: topics, error: lookupError } = await supabase
    .from("topics")
    .select("id, subject_id")
    .in("id", [source_id, target_id]);
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!topics || topics.length !== 2) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }
  if (topics[0].subject_id !== topics[1].subject_id) {
    return NextResponse.json(
      { error: "Topics must belong to the same subject." },
      { status: 400 },
    );
  }

  const { count: moved, error: moveError } = await supabase
    .from("questions")
    .update({ topic_id: target_id, subtopic_id: null }, { count: "exact" })
    .eq("topic_id", source_id);
  if (moveError) {
    return NextResponse.json({ error: moveError.message }, { status: 500 });
  }

  const { error: subtopicError } = await supabase
    .from("subtopics")
    .update({ topic_id: target_id })
    .eq("topic_id", source_id);
  if (subtopicError) {
    return NextResponse.json({ error: subtopicError.message }, { status: 500 });
  }

  const { error: archiveError } = await supabase
    .from("topics")
    .update({ status: "archived" })
    .eq("id", source_id);
  if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, moved: moved ?? 0 });
}
