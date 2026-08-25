import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateSeason } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { pointsForEvent, schoolScore, type MemberActivity } from "./scoring";
import { detectLeadChange, pairRivals } from "./rivalry";

const RIVALRY_DAYS = 7;
/** Rivalries only make sense between schools with a pulse. */
const MIN_ACTIVE_FOR_RIVALRY = 2;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Member activity points per school over a time window, computed from the
 * immutable ledger. Quarantined events never count.
 */
async function memberActivity(
  admin: Admin,
  fromIso: string,
  toIso: string,
): Promise<Map<string, MemberActivity[]>> {
  const { data: memberships } = await admin
    .from("school_members")
    .select("user_id, school_id");
  const schoolOf = new Map(
    (memberships ?? []).map((m) => [m.user_id, m.school_id]),
  );
  if (schoolOf.size === 0) return new Map();

  const { data: events } = await admin
    .from("performance_events")
    .select("user_id, kind, payload")
    .in("user_id", [...schoolOf.keys()])
    .eq("quarantined", false)
    .gte("created_at", fromIso)
    .lt("created_at", toIso);

  const pointsByUser = new Map<string, number>();
  for (const event of events ?? []) {
    const points = pointsForEvent(
      event.kind,
      event.payload as Record<string, unknown>,
    );
    if (points > 0) {
      pointsByUser.set(
        event.user_id,
        (pointsByUser.get(event.user_id) ?? 0) + points,
      );
    }
  }

  const bySchool = new Map<string, MemberActivity[]>();
  for (const [userId, schoolId] of schoolOf) {
    const list = bySchool.get(schoolId) ?? [];
    list.push({ userId, points: pointsByUser.get(userId) ?? 0 });
    bySchool.set(schoolId, list);
  }
  return bySchool;
}

/**
 * The School Wars heartbeat: recompute seasonal scores, keep rivalries
 * live (scores, lead-change notifications, finishing), pair unpaired
 * schools, and snapshot a season that just ended. Idempotent.
 */
export async function schoolHeartbeat(now: Date): Promise<{
  scored: number;
  rivalriesStarted: number;
  leadChanges: number;
  finished: number;
}> {
  const admin = createAdminClient();
  const season = await getOrCreateSeason(createSupabaseDuelStore(), now);

  // ---- seasonal scores ----
  const activity = await memberActivity(
    admin,
    season.starts_at,
    season.ends_at,
  );
  const { data: schools } = await admin
    .from("schools")
    .select("id, country, name");
  let scored = 0;
  for (const school of schools ?? []) {
    const members = activity.get(school.id) ?? [];
    const { score, activeMembers } = schoolScore(members);
    await admin.from("school_scores").upsert({
      school_id: school.id,
      season_id: season.id,
      score,
      active_members: activeMembers,
      member_count: members.length,
      updated_at: now.toISOString(),
    });
    scored += 1;
  }

  // ---- rivalries: update live scores, notify lead flips, finish ----
  const { data: active } = await admin
    .from("rivalries")
    .select("id, school_a, school_b, starts_at, ends_at, last_leader")
    .eq("status", "active");
  let leadChanges = 0;
  let finished = 0;
  for (const rivalry of active ?? []) {
    const window = await memberActivity(
      admin,
      rivalry.starts_at,
      rivalry.ends_at,
    );
    const a = schoolScore(window.get(rivalry.school_a) ?? []);
    const b = schoolScore(window.get(rivalry.school_b) ?? []);

    const over = new Date(rivalry.ends_at).getTime() <= now.getTime();
    const change = detectLeadChange(
      a.score,
      b.score,
      (rivalry.last_leader as "a" | "b" | null) ?? null,
    );
    await admin
      .from("rivalries")
      .update({
        a_score: a.score,
        b_score: b.score,
        last_leader: change?.newLeader ?? rivalry.last_leader,
        status: over ? "finished" : "active",
      })
      .eq("id", rivalry.id);

    if (over) {
      finished += 1;
      await notifySchools(
        admin,
        [rivalry.school_a, rivalry.school_b],
        "Rivalry Week is over — see the final score",
        `/schools`,
      );
    } else if (change) {
      leadChanges += 1;
      const leaderId =
        change.newLeader === "a" ? rivalry.school_a : rivalry.school_b;
      const { data: leader } = await admin
        .from("schools")
        .select("name")
        .eq("id", leaderId)
        .single();
      await notifySchools(
        admin,
        [rivalry.school_a, rivalry.school_b],
        `Lead change: ${leader?.name ?? "a school"} just took the rivalry lead`,
        `/schools`,
      );
    }
  }

  // ---- pair schools with no active rivalry ----
  const { data: stillActive } = await admin
    .from("rivalries")
    .select("school_a, school_b")
    .eq("status", "active");
  const busy = new Set(
    (stillActive ?? []).flatMap((r) => [r.school_a, r.school_b]),
  );
  const { data: standings } = await admin
    .from("school_scores")
    .select("school_id, score, active_members, schools!inner(country)")
    .eq("season_id", season.id)
    .gte("active_members", MIN_ACTIVE_FOR_RIVALRY)
    .order("score", { ascending: false });
  const candidates = (standings ?? [])
    .filter((s) => !busy.has(s.school_id))
    .map((s) => ({
      schoolId: s.school_id,
      score: Number(s.score),
      country: (s.schools as unknown as { country: string | null }).country,
    }));
  const pairs = pairRivals(candidates);
  let rivalriesStarted = 0;
  for (const pair of pairs) {
    const endsAt = new Date(now.getTime() + RIVALRY_DAYS * 864e5);
    // Rivalries never cross the season boundary.
    const cap = new Date(season.ends_at);
    const { error } = await admin.from("rivalries").insert({
      season_id: season.id,
      school_a: pair.schoolA,
      school_b: pair.schoolB,
      starts_at: now.toISOString(),
      ends_at: (endsAt < cap ? endsAt : cap).toISOString(),
    });
    if (!error) {
      rivalriesStarted += 1;
      await notifySchools(
        admin,
        [pair.schoolA, pair.schoolB],
        "Rivalry Week has begun — your school has been matched",
        `/schools`,
      );
    }
  }

  await snapshotEndedSeason(admin, now);

  return { scored, rivalriesStarted, leadChanges, finished };
}

/** Top-100 snapshot for the most recent season that ended without one. */
async function snapshotEndedSeason(admin: Admin, now: Date): Promise<void> {
  const { data: ended } = await admin
    .from("seasons")
    .select("id")
    .lte("ends_at", now.toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ended) return;
  const { count } = await admin
    .from("season_school_snapshots")
    .select("school_id", { count: "exact", head: true })
    .eq("season_id", ended.id);
  if (count && count > 0) return;

  const { data: finalBoard } = await admin
    .from("school_scores")
    .select("school_id, score, active_members")
    .eq("season_id", ended.id)
    .gt("active_members", 0)
    .order("score", { ascending: false })
    .limit(100);
  if (!finalBoard || finalBoard.length === 0) return;
  await admin.from("season_school_snapshots").insert(
    finalBoard.map((row, i) => ({
      season_id: ended.id,
      school_id: row.school_id,
      rank: i + 1,
      score: row.score,
      active_members: row.active_members,
    })),
  );
}

/** One notification per member of the given schools, respecting opt-outs. */
async function notifySchools(
  admin: Admin,
  schoolIds: string[],
  title: string,
  href: string,
): Promise<void> {
  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .in("school_id", schoolIds);
  if (!members || members.length === 0) return;
  const { data: optouts } = await admin
    .from("notification_optouts")
    .select("user_id")
    .eq("category", "school")
    .in(
      "user_id",
      members.map((m) => m.user_id),
    );
  const muted = new Set((optouts ?? []).map((o) => o.user_id));
  const rows = members
    .filter((m) => !muted.has(m.user_id))
    .map((m) => ({
      user_id: m.user_id,
      category: "school",
      title,
      href,
    }));
  if (rows.length > 0) await admin.from("notifications").insert(rows);
}

/** The regional fallback team for a country, created on first join. */
export async function getOrCreateRegionalTeam(
  country: string,
): Promise<string> {
  const admin = createAdminClient();
  const slug = `team-${country.toLowerCase()}`;
  const { data: existing } = await admin
    .from("schools")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("schools")
    .insert({
      slug,
      name: `Team ${country}`,
      country,
      kind: "regional",
      crest_emoji: "🌍",
      verified: true,
    })
    .select("id")
    .single();
  if (error) {
    // Lost a race with a concurrent join — the row exists now.
    const { data: raced } = await admin
      .from("schools")
      .select("id")
      .eq("slug", slug)
      .single();
    return raced!.id;
  }
  return data.id;
}
