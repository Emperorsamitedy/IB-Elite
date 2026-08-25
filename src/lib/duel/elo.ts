/**
 * Per-subject Elo. Pure functions only — the algorithm version and its
 * parameters are recorded in `rating_algorithm_versions` so historical
 * ratings can be recomputed and explained.
 */

export const ELO_INITIAL = 1200;
export const ELO_K = 32;
/** Soft reset pulls everyone halfway back to the anchor between seasons. */
export const SOFT_RESET_ANCHOR = 1200;

export type MatchOutcome = 1 | 0.5 | 0;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** New rating after one match. `score`: 1 win, 0.5 draw, 0 loss. */
export function updateElo(
  rating: number,
  opponent: number,
  score: MatchOutcome,
  k: number = ELO_K,
): number {
  return Math.round(rating + k * (score - expectedScore(rating, opponent)));
}

/** Season carry-over: halfway between last season's rating and the anchor. */
export function softReset(previousElo: number): number {
  return Math.round(SOFT_RESET_ANCHOR + (previousElo - SOFT_RESET_ANCHOR) / 2);
}

export const LEAGUES = [
  { name: "Bronze", min: -Infinity },
  { name: "Silver", min: 1100 },
  { name: "Gold", min: 1300 },
  { name: "Platinum", min: 1500 },
  { name: "Diamond", min: 1700 },
  { name: "Master", min: 1900 },
  { name: "Grandmaster", min: 2100 },
] as const;

export type LeagueName = (typeof LEAGUES)[number]["name"];

export function leagueFor(elo: number): LeagueName {
  let league: LeagueName = LEAGUES[0].name;
  for (const tier of LEAGUES) {
    if (elo >= tier.min) league = tier.name;
  }
  return league;
}
