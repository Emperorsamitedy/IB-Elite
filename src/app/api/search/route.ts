import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (q.length < 2) {
    return NextResponse.json({ subjects: [], topics: [], questions: [] });
  }

  const like = `%${q}%`;

  const [subjects, topics, questions] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, slug, name, group_name")
      .ilike("name", like)
      .limit(5),
    supabase
      .from("topics")
      .select("id, slug, name, subject_id, subjects(slug, name)")
      .ilike("name", like)
      .limit(6),
    supabase
      .from("questions")
      .select("id, title, prompt, topic_id, topics(name, slug, subjects(slug))")
      .eq("status", "published")
      .ilike("prompt", like)
      .limit(6),
  ]);

  return NextResponse.json({
    subjects: subjects.data ?? [],
    topics: topics.data ?? [],
    questions: questions.data ?? [],
  });
}
