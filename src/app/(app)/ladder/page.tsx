import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLeaderboard } from "@/lib/ladder/leaderboard";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";
import { EmptyState } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

  const top = await getLeaderboard(createSupabaseLadderStore(), { limit: 10 });
  // The board stores ids only; names come from profiles via the admin client
  // (public read of every profile would leak the user directory).
  const names = new Map<string, string>();
  if (top.length > 0) {
    const { data: profiles } = await createAdminClient()
      .from("profiles")
      .select("id, full_name")
      .in(
        "id",
        top.map((r) => r.student_id),
      );
    for (const p of profiles ?? []) {
      if (p.full_name) names.set(p.id, p.full_name);
    }
  }

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

      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <Trophy className="h-4 w-4 text-accent" /> Leaderboard
        </h2>
        <Card className="mt-3">
          <CardContent className="p-0">
            {top.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No matches finished yet — the first winner tops this board.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">#</th>
                    <th className="px-4 py-2.5 text-left font-medium">Student</th>
                    <th className="px-4 py-2.5 text-right font-medium">Wins</th>
                    <th className="px-4 py-2.5 text-right font-medium">Losses</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border last:border-0",
                        row.student_id === user.id && "bg-surface-2 font-medium",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        {names.get(row.student_id) ?? "Anonymous"}
                        {row.student_id === user.id && " (you)"}
                        {row.school ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.school}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-right">{row.wins}</td>
                      <td className="px-4 py-2.5 text-right">{row.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
