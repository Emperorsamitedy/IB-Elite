/**
 * Participation-weighted school scoring. Design constraints from the spec:
 * a 60-student school can beat a 2,000-student school (average, not total),
 * no individual can carry a school (per-member cap), and the winning
 * strategy is always "get more classmates active" (participation boost +
 * small-school floor).
 */

/** Points one member can contribute per season/window at most. */
export const MEMBER_CAP = 100;
/** Schools are averaged over at least this many members. */
export const ACTIVE_FLOOR = 10;
/** Breadth bonus saturates here. */
const BOOST_SATURATION = 200;
const BOOST_MAX = 0.5;

export type MemberActivity = {
  userId: string;
  points: number;
};

/** Activity points for one rated event, by kind. */
export function pointsForEvent(
  kind: string,
  payload: Record<string, unknown>,
): number {
  switch (kind) {
    case "duel_result": {
      if (payload.mode === "friendly") return 0;
      const result = payload.result;
      return result === "won" ? 5 : result === "drew" ? 3 : 2;
    }
    case "mock_result": {
      if (payload.ranked !== true) return 2; // showing up still counts a little
      const pct = Number(payload.globalPercentile);
      return 5 + (Number.isFinite(pct) ? Math.round(pct / 5) : 0); // 5..25
    }
    case "practice_result": {
      const total = Number(payload.total) || 0;
      const awarded = Number(payload.awarded) || 0;
      return total > 0 ? 1 + Math.round((awarded / total) * 2) : 1; // 1..3
    }
    default:
      return 0;
  }
}

export function participationBoost(activeMembers: number): number {
  return 1 + Math.min(BOOST_MAX, activeMembers / BOOST_SATURATION);
}

/**
 * The school's score over a set of member activity totals. Caps each
 * member, averages over max(active, floor), then applies the breadth boost.
 */
export function schoolScore(members: MemberActivity[]): {
  score: number;
  activeMembers: number;
} {
  const active = members.filter((m) => m.points > 0);
  const cappedSum = active.reduce(
    (sum, m) => sum + Math.min(m.points, MEMBER_CAP),
    0,
  );
  const average = cappedSum / Math.max(active.length, ACTIVE_FLOOR);
  const score =
    Math.round(average * participationBoost(active.length) * 10) / 10;
  return { score, activeMembers: active.length };
}
