import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuestionViewer } from "@/components/question/question-viewer";

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: question } = await supabase
    .from("questions")
    .select(
      `id, title, prompt, answer, solution, difficulty, marks, question_type,
       calculator, year, paper, source, license,
       topics(name, slug, subjects(name, slug))`,
    )
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!question) notFound();

  const [{ data: bm }, { data: noteRow }] = await Promise.all([
    supabase
      .from("bookmarks")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("question_id", id)
      .maybeSingle(),
    supabase
      .from("notes")
      .select("body")
      .eq("user_id", user.id)
      .eq("question_id", id)
      .maybeSingle(),
  ]);

  const topic = question.topics as {
    name: string;
    slug: string;
    subjects: { name: string; slug: string } | null;
  } | null;

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">
          Subjects
        </Link>
        {topic?.subjects && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href={`/subjects/${topic.subjects.slug}`}
              className="hover:text-foreground"
            >
              {topic.subjects.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link
              href={`/subjects/${topic.subjects.slug}/${topic.slug}`}
              className="hover:text-foreground"
            >
              {topic.name}
            </Link>
          </>
        )}
      </nav>

      <QuestionViewer
        question={{ ...question, topics: topic ? { name: topic.name } : null }}
        initialBookmarked={Boolean(bm)}
        initialNote={noteRow?.body ?? ""}
      />
    </div>
  );
}
