import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Search is scoped by the caller: no scope searches the whole platform,
 * `subject` restricts results to one subject, `topic` to a single topic.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const subjectSlug = params.get("subject");
  const topicSlug = params.get("topic");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const empty = { subjects: [], topics: [], questions: [], scope: null };
  if (q.length < 2) return NextResponse.json(empty);

  const like = `%${q}%`;

  let subjectId: string | null = null;
  let topicId: string | null = null;
  let scope: { subject?: string; topic?: string } | null = null;

  if (subjectSlug) {
    const { data: subject } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("slug", subjectSlug)
      .maybeSingle();
    if (!subject) return NextResponse.json(empty);
    subjectId = subject.id;
    scope = { subject: subject.name };

    if (topicSlug) {
      const { data: topic } = await supabase
        .from("topics")
        .select("id, name")
        .eq("subject_id", subject.id)
        .eq("slug", topicSlug)
        .maybeSingle();
      if (!topic) return NextResponse.json(empty);
      topicId = topic.id;
      scope = { subject: subject.name, topic: topic.name };
    }
  }

  let topicQuery = supabase
    .from("topics")
    .select("id, slug, name, subject_id, themes(name), subjects(slug, name)")
    .eq("status", "published")
    .ilike("name", like)
    .limit(6);
  if (subjectId) topicQuery = topicQuery.eq("subject_id", subjectId);
  if (topicId) topicQuery = topicQuery.eq("id", topicId);

  let questionQuery = supabase
    .from("questions")
    .select("id, title, prompt, topic_id, topics(name, slug, subjects(slug))")
    .eq("status", "published")
    .ilike("prompt", like)
    .limit(8);
  if (subjectId) questionQuery = questionQuery.eq("subject_id", subjectId);
  if (topicId) questionQuery = questionQuery.eq("topic_id", topicId);

  const subjectQuery = subjectId
    ? null
    : supabase
        .from("subjects")
        .select("id, slug, name, group_name")
        .ilike("name", like)
        .limit(5);

  const [subjects, topics, questions] = await Promise.all([
    subjectQuery,
    topicQuery,
    questionQuery,
  ]);

  return NextResponse.json({
    subjects: subjects?.data ?? [],
    topics: topics.data ?? [],
    questions: questions.data ?? [],
    scope,
  });
}
