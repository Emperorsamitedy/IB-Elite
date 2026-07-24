import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileQuestion } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StartSessionButton } from "@/components/app/start-session-button";
import { EmptyState } from "@/components/ui/misc";
import type { Difficulty } from "@/lib/types";

const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

export default async function TopicPage({
  params,
}: {
  params: Promise<{ subject: string; topic: string }>;
}) {
  const { subject: subjectSlug, topic: topicSlug } = await params;
  await requireUser();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, slug, name")
    .eq("slug", subjectSlug)
    .maybeSingle();
  if (!subject) notFound();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, slug, name, description")
    .eq("subject_id", subject.id)
    .eq("slug", topicSlug)
    .maybeSingle();
  if (!topic) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, title, prompt, difficulty, marks, question_type")
    .eq("topic_id", topic.id)
    .eq("status", "published")
    .order("difficulty");

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/subjects" className="hover:text-foreground">
          Subjects
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/subjects/${subject.slug}`}
          className="hover:text-foreground"
        >
          {subject.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{topic.name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {topic.name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {topic.description ??
              `${questions?.length ?? 0} questions in ${subject.name}`}
          </p>
        </div>
        {questions && questions.length > 0 && (
          <StartSessionButton
            input={{
              subjectId: subject.id,
              topicIds: [topic.id],
              count: Math.min(questions.length, 15),
            }}
          >
            Practise this topic
          </StartSessionButton>
        )}
      </div>

      {questions && questions.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {questions.map((q) => (
            <Link key={q.id} href={`/questions/${q.id}`}>
              <Card interactive>
                <CardContent className="flex items-center gap-4 p-4">
                  <FileQuestion className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
                      {q.title || q.prompt}
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">
                      {q.prompt}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{q.marks}m</Badge>
                    <Badge
                      variant={DIFF_VARIANT[q.difficulty]}
                      className="capitalize"
                    >
                      {q.difficulty}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileQuestion}
          title="No questions yet"
          description="Questions for this topic will appear here soon."
        />
      )}
    </div>
  );
}
