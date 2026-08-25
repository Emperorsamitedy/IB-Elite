/**
 * Skill-based pairing within a subject + level. The acceptable rating gap
 * widens the longer a player waits, so nobody queues forever; both sides
 * must accept the gap, which the symmetric window guarantees.
 */

export const BASE_WINDOW = 100;
export const WIDEN_PER_SECOND = 100 / 30; // +100 every 30s waited
export const MAX_WINDOW = 600;

export function windowFor(waitedSeconds: number): number {
  return Math.min(
    MAX_WINDOW,
    Math.round(BASE_WINDOW + waitedSeconds * WIDEN_PER_SECOND),
  );
}

export type QueueCandidate = {
  userId: string;
  elo: number;
  enqueuedAt: string;
  /** Salted network hash; equal hashes never pair in ranked play. */
  ipHash?: string | null;
};

/**
 * Best opponent for `seeker` among `candidates` (same subject/level/mode,
 * seeker excluded): the closest rating whose mutual windows both cover the
 * gap, oldest enqueue breaking ties.
 */
export function pickOpponent(
  seeker: QueueCandidate,
  candidates: QueueCandidate[],
  now: Date,
): QueueCandidate | null {
  const seekerWindow = windowFor(waitedSeconds(seeker, now));
  let best: QueueCandidate | null = null;
  let bestGap = Infinity;

  for (const candidate of candidates) {
    if (candidate.userId === seeker.userId) continue;
    // Two accounts on one network smell like one person; never pair them.
    if (
      seeker.ipHash &&
      candidate.ipHash &&
      seeker.ipHash === candidate.ipHash
    ) {
      continue;
    }
    const gap = Math.abs(candidate.elo - seeker.elo);
    if (gap > seekerWindow) continue;
    if (gap > windowFor(waitedSeconds(candidate, now))) continue;
    if (
      gap < bestGap ||
      (gap === bestGap &&
        best !== null &&
        candidate.enqueuedAt < best.enqueuedAt)
    ) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

function waitedSeconds(candidate: QueueCandidate, now: Date): number {
  return Math.max(
    0,
    (now.getTime() - new Date(candidate.enqueuedAt).getTime()) / 1000,
  );
}
