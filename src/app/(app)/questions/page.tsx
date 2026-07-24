import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { QuestionFilters } from "@/components/question/question-filters";
import type { Difficulty } from "@/lib/types";

export const metadata = { title: "Question browser" };

const PAGE_SIZE = 20;
const DIFF_VARIANT: Record<Difficulty, "success" | "warning" | "danger"> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
};

export default async function QuestionBrowserPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, name, topics(id, name)")
    .order("sort_order");

  const { data: meta } = await supabase
    .from("questions")
    .select("year, paper")
    .eq("status", "published");
  const years = [
    ...new Set((meta ?? []).map((m) => m.year).filter((y): y is number => !!y)),
  ].sort((a, b) => b - a);
  const papers = [
    ...new Set((meta ?? []).map((m) => m.paper).filter((p): p is string => !!p)),
  ].sort();

  let query = supabase
    .from("questions")
    .select(
      "id, title, prompt, difficulty, marks, question_type, year, paper, topics(name, slug, subjects(name, slug))",
      { count: "exact" },
    )
    .eq("status", "published");

  if (sp.subject) query = query.eq("subject_id", sp.subject);
  if (sp.topic) query = query.eq("topic_id", sp.topic);
  if (sp.difficulty) query = query.eq("difficulty", sp.difficulty as Difficulty);
  if (sp.year) query = query.eq("year", Number(sp.year));
  if (sp.paper) query = query.eq("paper", sp.paper);
  if (sp.q) query = query.ilike("prompt", `%${sp.q}%`);

  const { data: questions, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const buildPage = (p: number) => {
    const next = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => v) as [string, string][],
    );
    next.set("page", String(p));
    return `/questions?${next.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Question browser
        </h1>
        <p className="mt-1 text-muted-foreground">
          {total} question{total === 1 ? "" : "s"} · filter to find exactly what
          you need.
        </p>
      </div>

      <QuestionFilters
        subjects={subjects ?? []}
        years={years}
        papers={papers}
      />

      {questions && questions.length > 0 ? (
        <>
          <div className="flex flex-col gap-2.5">
            {questions.map((q) => {
              const topic = q.topics as {
                name: string;
                subjects: { name: string } | null;
              } | null;
              return (
                <Link key={q.id} href={`/questions/${q.id}`}>
                  <Card interactive>
                    <CardContent className="flex items-center gap-4 p-4">
                      <FileQuestion className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium">
                          {q.title || q.prompt}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {topic?.subjects?.name} · {topic?.name}
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
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                <Link href={buildPage(page - 1)}>Previous</Link>
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={page >= totalPages}
              >
                <Link href={buildPage(page + 1)}>Next</Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={FileQuestion}
          title="No questions match"
          description="Try removing a filter or broadening your search."
        />
      )}
    </div>
  );
}
