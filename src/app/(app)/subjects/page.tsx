import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: subjects }, { data: mine }] = await Promise.all([
    supabase
      .from("subjects")
      .select(
        "id, slug, name, group_name, description, color, topics(count), questions(count)",
      )
      .order("sort_order"),
    supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
  ]);

  const mineSet = new Set((mine ?? []).map((m) => m.subject_id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Subjects</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          Browse the curriculum · open any topic
        </p>
      </div>

      {subjects && subjects.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((s) => {
            const topicCount =
              (s.topics as { count: number }[])?.[0]?.count ?? 0;
            const questionCount =
              (s.questions as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={s.id}
                href={`/subjects/${s.slug}`}
                className="group flex h-full flex-col gap-3 rounded-lg border border-border border-l-4 bg-card p-5 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ borderLeftColor: s.color }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold tracking-tight group-hover:text-accent">
                      {s.name}
                    </h2>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {s.group_name}
                    </p>
                  </div>
                  {mineSet.has(s.id) && <Badge variant="accent">Mine</Badge>}
                </div>
                {s.description && (
                  <p className="line-clamp-2 flex-1 font-serif text-[15px] leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>
                    {topicCount} topics · {questionCount} questions
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Library}
          title="No subjects yet"
          description="Subjects will appear here once they've been added."
        />
      )}
    </div>
  );
}
