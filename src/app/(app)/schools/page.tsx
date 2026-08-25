import Link from "next/link";
import { notFound } from "next/navigation";
import { SchoolIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { getOrCreateSeason } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SchoolJoin, type SchoolHit } from "@/components/school/school-join";
import {
  RivalryPanel,
  type BannerRow,
} from "@/components/school/rivalry-panel";
import { LeaveSchoolButton } from "@/components/school/leave-school-button";
import { messages } from "@/lib/i18n/en";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

export const metadata = { title: messages.school.title };

const t = messages.school;

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; invite?: string }>;
}) {
  if (!(await getFlag("school_wars"))) notFound();
  const { board = "world", invite } = await searchParams;
  const admin = createAdminClient();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const season = await getOrCreateSeason(createSupabaseDuelStore(), new Date());

  // My affiliation (when signed in).
  const membership = user
    ? (
        await admin
          .from("school_members")
          .select("school_id, schools(id, slug, name, crest_emoji, color, city, country)")
          .eq("user_id", user.id)
          .maybeSingle()
      ).data
    : null;
  const mySchool = membership?.schools as unknown as {
    id: string;
    slug: string;
    name: string;
    crest_emoji: string;
    color: string;
    city: string | null;
    country: string | null;
  } | null;

  const profile = user
    ? (
        await admin
          .from("profiles")
          .select("country")
          .eq("id", user.id)
          .maybeSingle()
      ).data
    : null;

  // Standings for the chosen board.
  let standingsQuery = admin
    .from("school_scores")
    .select(
      "school_id, score, active_members, member_count, schools!inner(slug, name, crest_emoji, city, country)",
    )
    .eq("season_id", season.id)
    .gt("active_members", 0)
    .order("score", { ascending: false })
    .limit(50);
  if (board === "country" && (mySchool?.country ?? profile?.country)) {
    standingsQuery = standingsQuery.eq(
      "schools.country",
      (mySchool?.country ?? profile?.country)!,
    );
  }
  if (board === "city" && mySchool?.city) {
    // ilike (no wildcards) = case-insensitive equality, absorbing any
    // legacy rows written before city normalization.
    standingsQuery = standingsQuery.ilike("schools.city", mySchool.city);
  }
  const { data: standings } = await standingsQuery;

  // Rivalry for my school.
  let rivalryPanel: React.ReactNode = null;
  if (mySchool && user) {
    const { data: rivalry } = await admin
      .from("rivalries")
      .select("id, school_a, school_b, ends_at, a_score, b_score, status")
      .or(`school_a.eq.${mySchool.id},school_b.eq.${mySchool.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (rivalry) {
      const mineIsA = rivalry.school_a === mySchool.id;
      const otherId = mineIsA ? rivalry.school_b : rivalry.school_a;
      const { data: other } = await admin
        .from("schools")
        .select("id, name, crest_emoji")
        .eq("id", otherId)
        .single();
      const counts = new Map<string, number>();
      for (const id of [mySchool.id, otherId]) {
        const { data: score } = await admin
          .from("school_scores")
          .select("active_members")
          .eq("school_id", id)
          .eq("season_id", season.id)
          .maybeSingle();
        counts.set(id, score?.active_members ?? 0);
      }
      const { data: bannersRaw } = await admin
        .from("rivalry_banners")
        .select("id, preset_key, school_id, profiles:user_id(display_name)")
        .eq("rivalry_id", rivalry.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const banners: BannerRow[] = (bannersRaw ?? []).map((b) => ({
        id: b.id,
        preset_key: b.preset_key,
        schoolName:
          b.school_id === mySchool.id ? mySchool.name : (other?.name ?? ""),
        displayName:
          (b.profiles as unknown as { display_name?: string })?.display_name ??
          "",
      }));
      rivalryPanel = (
        <RivalryPanel
          rivalryId={rivalry.id}
          mine={{
            schoolId: mySchool.id,
            name: mySchool.name,
            crest: mySchool.crest_emoji,
            score: Number(mineIsA ? rivalry.a_score : rivalry.b_score),
            activeMembers: counts.get(mySchool.id) ?? 0,
          }}
          theirs={{
            schoolId: otherId,
            name: other?.name ?? "",
            crest: other?.crest_emoji ?? "🏫",
            score: Number(mineIsA ? rivalry.b_score : rivalry.a_score),
            activeMembers: counts.get(otherId) ?? 0,
          }}
          endsAt={rivalry.ends_at}
          finished={rivalry.status === "finished"}
          banners={banners}
          isMember
          inviteUrl={`${env.siteUrl}/schools?invite=${user.id}`}
        />
      );
    }
  }

  // Join surface data (signed-in, unaffiliated).
  let joinSurface: React.ReactNode = null;
  if (user && !mySchool) {
    const { data: allSchools } = await admin
      .from("schools")
      .select("id, name, city, country, crest_emoji, school_members(user_id)")
      .order("name")
      .limit(500);
    const hits: SchoolHit[] = (allSchools ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      country: s.country,
      crest_emoji: s.crest_emoji,
      members: (s.school_members ?? []).length,
    }));
    joinSurface = (
      <SchoolJoin
        schools={hits}
        country={profile?.country ?? null}
        inviterId={invite ?? null}
      />
    );
  }

  const boards = [
    { key: "world", label: t.boards.world },
    { key: "country", label: t.boards.country },
    { key: "city", label: t.boards.city },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <SchoolIcon className="h-5 w-5 text-accent" /> {t.title}
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {t.subtitle} · {season.slug}
        </p>
      </div>

      {mySchool && (
        <Card>
          <CardContent
            className="flex flex-wrap items-center justify-between gap-3 border-l-4 p-5"
            style={{ borderLeftColor: mySchool.color }}
          >
            <div>
              <Link
                href={`/schools/${mySchool.slug}`}
                className="text-lg font-bold tracking-tight hover:text-accent"
              >
                {mySchool.crest_emoji} {mySchool.name}
              </Link>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {[mySchool.city, mySchool.country].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">{t.joined}</Badge>
              <LeaveSchoolButton />
            </div>
          </CardContent>
        </Card>
      )}

      {joinSurface}
      {rivalryPanel ?? (mySchool && (
        <p className="text-sm text-muted-foreground">{t.rivalryNone}</p>
      ))}

      <div>
        <div className="flex gap-1.5">
          {boards.map((b) => (
            <Link
              key={b.key}
              href={`/schools?board=${b.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                board === b.key
                  ? "bg-surface-2 font-semibold"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {b.label}
            </Link>
          ))}
        </div>
        <Card className="mt-3">
          <CardContent className="p-0">
            {!standings || standings.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                {t.boardEmpty}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">#</th>
                    <th className="px-4 py-2.5 text-left font-medium">School</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t.activeMembers}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t.score}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => {
                    const school = row.schools as unknown as {
                      slug: string;
                      name: string;
                      crest_emoji: string;
                      city: string | null;
                      country: string | null;
                    };
                    return (
                      <tr
                        key={row.school_id}
                        className={cn(
                          "border-b border-border last:border-0",
                          row.school_id === mySchool?.id &&
                            "bg-surface-2 font-medium",
                        )}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/schools/${school.slug}`}
                            className="hover:text-accent"
                          >
                            {school.crest_emoji} {school.name}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {[school.city, school.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {row.active_members}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {Number(row.score)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
