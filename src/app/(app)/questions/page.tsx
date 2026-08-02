import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { QuestionFilters } from "@/components/question/question-filters";
import type { Difficulty } from "@/lib/types";

export const metadata = { title: "Question browser" };

const PAGE_SIZE = 20;
const DIFF_VARIANT: Record<Difficulty, "success" | "outline" | "danger"> = {
  easy: "success",
  medium: "outline",
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
        <h1 className="text-2xl font-extrabold tracking-tight">
          Question browser
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {total} question{total === 1 ? "" : "s"} · filter to the exact one
        </p>
      </div>

      <QuestionFilters
        subjects={subjects ?? []}
        years={years}
        papers={papers}
      />

      {questions && questions.length > 0 ? (
        <>
          <ul className="divide-y divide-border border-y border-border">
            {questions.map((q) => {
              const topic = q.topics as {
                name: string;
                subjects: { name: string } | null;
              } | null;
              return (
                <li key={q.id}>
                  <Link
                    href={`/questions/${q.id}`}
                    className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-surface-2/60"
                  >
                    <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold text-accent">
                      [{q.marks}]
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-serif text-[15px] group-hover:text-accent">
                        {q.title || q.prompt}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                        {topic?.subjects?.name} · {topic?.name}
                        {q.paper ? ` · ${q.paper}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={DIFF_VARIANT[q.difficulty]}
                      className="shrink-0"
                    >
                      {q.difficulty}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                <Link href={buildPage(page - 1)}>Previous</Link>
              </Button>
              <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
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
