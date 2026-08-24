import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { getOrCreateSeason } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: messages.school.title };

const t = messages.school;

export default async function SchoolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await getFlag("school_wars"))) notFound();
  const { slug } = await params;
  await requireUser();
  const admin = createAdminClient();

  const { data: school } = await admin
    .from("schools")
    .select("id, slug, name, city, country, kind, crest_emoji, color, verified")
    .eq("slug", slug)
    .maybeSingle();
  if (!school) notFound();

  const season = await getOrCreateSeason(createSupabaseDuelStore(), new Date());

  const [{ count: memberCount }, { data: score }, { data: history }, { data: rivalry }] =
    await Promise.all([
      admin
        .from("school_members")
        .select("user_id", { count: "exact", head: true })
        .eq("school_id", school.id),
      admin
        .from("school_scores")
        .select("score, active_members")
        .eq("school_id", school.id)
        .eq("season_id", season.id)
        .maybeSingle(),
      admin
        .from("season_school_snapshots")
        .select("rank, score, seasons(slug)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(6),
      admin
        .from("rivalries")
        .select("id, status, a_score, b_score, school_a, school_b")
        .or(`school_a.eq.${school.id},school_b.eq.${school.id}`)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  let rivalName: string | null = null;
  if (rivalry) {
    const otherId =
      rivalry.school_a === school.id ? rivalry.school_b : rivalry.school_a;
    const { data: other } = await admin
      .from("schools")
      .select("name")
      .eq("id", otherId)
      .maybeSingle();
    rivalName = other?.name ?? null;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/schools" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t.title}
        </Link>
      </nav>

      <Card>
        <CardContent
          className="flex flex-col gap-3 border-l-4 p-6"
          style={{ borderLeftColor: school.color }}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {school.crest_emoji} {school.name}
            </h1>
            {school.verified && <Badge variant="success">verified</Badge>}
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {[school.city, school.country].filter(Boolean).join(", ")}
            {school.kind === "regional" && " · regional team"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {memberCount ?? 0} {t.members}
            </Badge>
            <Badge variant="outline">
              {score?.active_members ?? 0} {t.activeMembers}
            </Badge>
            <Badge variant="accent">
              {t.score} {Number(score?.score ?? 0)}
            </Badge>
          </div>
          {rivalry && rivalName && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Swords className="h-4 w-4 text-accent" /> {t.rivalryTitle}:{" "}
              {t.rivalryVs} {rivalName} —{" "}
              {Number(
                rivalry.school_a === school.id ? rivalry.a_score : rivalry.b_score,
              )}{" "}
              : {Number(
                rivalry.school_a === school.id ? rivalry.b_score : rivalry.a_score,
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {history && history.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-5">
            <h2 className="text-sm font-semibold">{t.rank} history</h2>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {history.map((row, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {(row.seasons as unknown as { slug?: string })?.slug}
                  </span>
                  <span className="font-mono">
                    #{row.rank} · {Number(row.score)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
