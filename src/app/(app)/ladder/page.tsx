import Link from "next/link";
import { Swords } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/misc";

export const metadata = { title: "World Ladder" };

export default async function LadderIndexPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: mine }, { data: subjects }] = await Promise.all([
    supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
    supabase
      .from("subjects")
      .select("id, name, group_name, color")
      .order("sort_order"),
  ]);

  const mineSet = new Set((mine ?? []).map((m) => m.subject_id));
  const all = subjects ?? [];
  const listed = all.filter((s) => mineSet.has(s.id));
  const shown = listed.length > 0 ? listed : all;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">World Ladder</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          Live 1v1 against a student anywhere with your subject
        </p>
      </div>

      {shown.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((s) => (
            <Link
              key={s.id}
              href={`/ladder/${s.id}`}
              className="group flex items-center justify-between gap-3 rounded-lg border border-border border-l-4 bg-card p-5 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ borderLeftColor: s.color }}
            >
              <div>
                <h2 className="font-bold tracking-tight group-hover:text-accent">
                  {s.name}
                </h2>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {s.group_name}
                </p>
              </div>
              <Swords className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-accent" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No subjects yet"
          description="Pick your subjects in settings to enter the ladder."
        />
      )}
    </div>
  );
}
