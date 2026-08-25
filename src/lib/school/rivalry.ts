/**
 * Rivalry Week pairing: schools of similar rank, preferring the same
 * country (locality), each school in at most one active rivalry.
 */

export type RankedSchool = {
  schoolId: string;
  score: number;
  country: string | null;
};

export type RivalryPair = { schoolA: string; schoolB: string };

/** Preset-only inter-school messages; keys are the only thing stored. */
export const BANNER_PRESETS: Record<string, string> = {
  gg: "Good luck — may the best school win! 🤝",
  fire: "We're on fire this week! 🔥",
  comeback: "The comeback starts now. 📈",
  respect: "Respect — that was a strong push. 👏",
  rally: "Rally the classroom! 🏫",
  victory: "Victory lap! 🏆",
};

/**
 * Greedy pairing down the ranked list: each unpaired school takes the
 * nearest-ranked unpaired school, same country first. An odd school out
 * simply sits the week — better than a mismatched stomp.
 */
export function pairRivals(ranked: RankedSchool[]): RivalryPair[] {
  const pairs: RivalryPair[] = [];
  const taken = new Set<string>();

  for (let i = 0; i < ranked.length; i++) {
    const school = ranked[i];
    if (taken.has(school.schoolId)) continue;

    let partner: RankedSchool | null = null;
    // Nearest by rank, scanning outward; same-country match wins within
    // a window of 3 rank positions.
    for (let j = i + 1; j < ranked.length; j++) {
      const candidate = ranked[j];
      if (taken.has(candidate.schoolId)) continue;
      if (!partner) partner = candidate;
      if (
        school.country !== null &&
        candidate.country === school.country &&
        j - i <= 3
      ) {
        partner = candidate;
        break;
      }
      if (j - i > 3 && partner) break;
    }
    if (!partner) continue;

    taken.add(school.schoolId);
    taken.add(partner.schoolId);
    pairs.push({ schoolA: school.schoolId, schoolB: partner.schoolId });
  }
  return pairs;
}

export type LeadChange = { newLeader: "a" | "b" } | null;

/** Detects a lead flip between heartbeats; ties keep the previous leader. */
export function detectLeadChange(
  aScore: number,
  bScore: number,
  lastLeader: "a" | "b" | null,
): LeadChange {
  const leader = aScore > bScore ? "a" : bScore > aScore ? "b" : null;
  if (leader === null || leader === lastLeader) return null;
  return { newLeader: leader };
}
