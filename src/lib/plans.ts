/**
 * Plan tiers. `max` is a superset of `pro`: anything Pro unlocks, Max unlocks
 * too, so gating should compare with `planAtLeast` rather than `=== "pro"`.
 */
export type Plan = "free" | "pro" | "max";

const RANK: Record<Plan, number> = { free: 0, pro: 1, max: 2 };

export function planAtLeast(plan: Plan, required: Plan): boolean {
  return RANK[plan] >= RANK[required];
}

export function isPlan(value: unknown): value is Plan {
  return value === "free" || value === "pro" || value === "max";
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

/**
 * The tier of an active subscription. The plan recorded at checkout (stamped
 * into Stripe metadata and persisted by the webhook) is authoritative; the
 * price-ID lookup is only a fallback for rows written before that column
 * existed.
 */
export function resolvePlan(
  storedPlan: string | null | undefined,
  priceId: string | null | undefined,
  prices: PriceIds,
): Plan {
  if (isPlan(storedPlan) && storedPlan !== "free") return storedPlan;
  return planForPriceId(priceId, prices);
}

/**
 * Free-tier limits enforced server-side. Shared with the marketing page so the
 * advertised numbers can never drift from the enforced ones.
 */
export const FREE_LIMITS = {
  aiMessagesPerDay: 10,
  practiceQuestionsPerDay: 30,
};
