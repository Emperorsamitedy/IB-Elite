import Link from "next/link";
import { ArrowRight, Library } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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
        <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
        <p className="mt-1 text-muted-foreground">
          Browse the full curriculum and dive into any topic.
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
              <Link key={s.id} href={`/subjects/${s.slug}`}>
                <Card interactive className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `${s.color}1a`,
                          color: s.color,
                        }}
                      >
                        <Library className="h-5 w-5" />
                      </span>
                      {mineSet.has(s.id) && (
                        <Badge variant="accent">My subject</Badge>
                      )}
                    </div>
                    <div className="flex-1">
                      <h2 className="font-semibold">{s.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {s.group_name}
                      </p>
                      {s.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {topicCount} topics · {questionCount} questions
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
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
