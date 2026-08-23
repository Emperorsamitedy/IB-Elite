import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { getOrCreateSeason } from "@/lib/duel/service";
import { leagueFor } from "@/lib/duel/elo";
import { DuelQueue } from "@/components/duel/duel-queue";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";

export const metadata = { title: messages.duel.title };

const t = messages.duel;

export default async function DuelSubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) notFound();

  const admin = createAdminClient();
  const season = await getOrCreateSeason(createSupabaseDuelStore(), new Date());

  const { data: standings } = await admin
    .from("subject_ratings")
    .select("user_id, elo, wins, losses, draws, matches_played")
    .eq("subject_id", subjectId)
    .eq("season_id", season.id)
    .gt("matches_played", 0)
    .order("elo", { ascending: false })
    .limit(20);

  const names = new Map<string, string>();
  if (standings && standings.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in(
        "id",
        standings.map((r) => r.user_id),
      );
    for (const p of profiles ?? []) names.set(p.id, p.display_name);
  }

  const mine = await admin
    .from("subject_ratings")
    .select("elo, wins, losses, draws")
    .eq("subject_id", subjectId)
    .eq("season_id", season.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const myElo = mine.data?.elo ?? null;

  const seasonEnd = new Date(season.ends_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t.title}</h1>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {subject.name} · {t.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {myElo !== null ? (
            <>
              <Badge variant="accent">{myElo}</Badge>
              <Badge variant="outline">{leagueFor(myElo)}</Badge>
            </>
          ) : (
            <Badge variant="outline">{t.unranked}</Badge>
          )}
        </div>
      </div>

      <DuelQueue subjectId={subject.id} />

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Trophy className="h-4 w-4 text-accent" /> {t.leaderboardTitle}
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {t.seasonEnds}{" "}
            {seasonEnd.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            {!standings || standings.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t.leaderboardEmpty}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">#</th>
                    <th className="px-4 py-2.5 text-left font-medium">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium">{t.league}</th>
                    <th className="px-4 py-2.5 text-right font-medium">Elo</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t.wins}/{t.losses}/{t.draws}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr
                      key={row.user_id}
                      className={cn(
                        "border-b border-border last:border-0",
                        row.user_id === user.id && "bg-surface-2 font-medium",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        {names.get(row.user_id) ?? "Student"}
                        {row.user_id === user.id && " (you)"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline">{leagueFor(row.elo)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {row.elo}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">
                        {row.wins}/{row.losses}/{row.draws}
                      </td>
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
