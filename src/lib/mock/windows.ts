/**
 * Sitting window rules. All decisions run on server time; the client only
 * renders countdowns. Late submissions are still graded but never ranked.
 */

export type SittingWindow = {
  opens_at: string;
  closes_at: string;
  status: "scheduled" | "cancelled";
};

/** Network/upload slack on top of the deadline, not extra writing time. */
export const SUBMIT_GRACE_MS = 60_000;

export type SittingPhase = "upcoming" | "open" | "closed" | "cancelled";

export function sittingPhase(sitting: SittingWindow, now: Date): SittingPhase {
  if (sitting.status === "cancelled") return "cancelled";
  if (now.getTime() < new Date(sitting.opens_at).getTime()) return "upcoming";
  if (now.getTime() < new Date(sitting.closes_at).getTime()) return "open";
  return "closed";
}

/**
 * The moment a script must be in by: the student's own exam clock
 * (started_at + duration) or the hall closing, whichever is earlier.
 */
export function submissionDeadline(
  startedAt: string,
  durationMinutes: number,
  closesAt: string,
): Date {
  const own = new Date(startedAt).getTime() + durationMinutes * 60_000;
  return new Date(Math.min(own, new Date(closesAt).getTime()));
}

export function isLate(
  submittedAt: Date,
  startedAt: string,
  durationMinutes: number,
  closesAt: string,
): boolean {
  return (
    submittedAt.getTime() >
    submissionDeadline(startedAt, durationMinutes, closesAt).getTime() +
      SUBMIT_GRACE_MS
  );
}
