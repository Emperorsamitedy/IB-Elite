import type { LadderStore, LeaderboardFilter } from "./store";
import type { LadderLeaderboardRow } from "./types";

/** Top students by wins, optionally narrowed to a country or school. */
export async function getLeaderboard(
  store: LadderStore,
  filter: LeaderboardFilter,
): Promise<LadderLeaderboardRow[]> {
  return store.leaderboard(filter);
}
