/** Free students get a small daily allowance; pro is unmetered. */
export const FREE_SOLVES_PER_DAY = 3;

export type UsageDecision =
  | { allowed: true; remaining: number | null }
  | { allowed: false; message: string };

/**
 * Checked before any storage or OCR spend, so a blocked student costs nothing.
 */
export function checkSolveUsage(
  isPro: boolean,
  usedToday: number,
): UsageDecision {
  if (isPro) return { allowed: true, remaining: null };
  if (usedToday >= FREE_SOLVES_PER_DAY) {
    return {
      allowed: false,
      message: `You've used your ${FREE_SOLVES_PER_DAY} free solves today. Upgrade to Pro for unlimited Solve & Grade.`,
    };
  }
  return { allowed: true, remaining: FREE_SOLVES_PER_DAY - usedToday - 1 };
}
