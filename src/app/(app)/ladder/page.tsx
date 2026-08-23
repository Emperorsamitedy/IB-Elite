import Link from "next/link";
import { Swords, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateSeason } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { leagueFor } from "@/lib/duel/elo";
import { Badge } from "@/components/ui/badge";
import { messages } from "@/lib/i18n/en";
import { EmptyState } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";

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

  const season = await getOrCreateSeason(createSupabaseDuelStore(), new Date());
  const { data: myRatings } = await createAdminClient()
    .from("subject_ratings")
    .select("subject_id, elo, wins, losses, draws")
    .eq("user_id", user.id)
    .eq("season_id", season.id);
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

      {(myRatings ?? []).length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Trophy className="h-4 w-4 text-accent" /> {messages.duel.yourRatings}
          </h2>
          <Card className="mt-3">
            <CardContent className="flex flex-wrap gap-3 p-4">
              {(myRatings ?? []).map((r) => {
                const subject = all.find((s) => s.id === r.subject_id);
                return (
                  <div
                    key={r.subject_id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{subject?.name ?? "—"}</span>
                    <Badge variant="accent">{r.elo}</Badge>
                    <Badge variant="outline">{leagueFor(r.elo)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {r.wins}W · {r.losses}L · {r.draws}D
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
