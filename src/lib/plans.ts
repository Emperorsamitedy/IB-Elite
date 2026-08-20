/**
 * Plan tiers. `max` is a superset of `pro`: anything Pro unlocks, Max unlocks
 * too, so gating should compare with `planAtLeast` rather than `=== "pro"`.
 */
export type Plan = "free" | "pro" | "max";

const RANK: Record<Plan, number> = { free: 0, pro: 1, max: 2 };

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return RANK[plan] >= RANK[required];
}

export type PriceIds = {
  proMonthly: string;
  proAnnual: string;
  maxMonthly: string;
};

/**
 * Which tier a Stripe price belongs to. An unrecognised price still counts as
 * Pro: a paying subscriber must never be downgraded to free just because the
 * environment's price IDs have moved on.
 */
export function planForPriceId(
  priceId: string | null | undefined,
  prices: PriceIds,
): Plan {
  if (priceId && prices.maxMonthly && priceId === prices.maxMonthly) {
    return "max";
  }
  return "pro";
}
