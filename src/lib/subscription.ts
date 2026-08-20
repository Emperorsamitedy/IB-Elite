import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { planForPriceId, type Plan } from "@/lib/plans";

export type Entitlement = {
  plan: Plan;
  /** True for Max as well — Max includes everything Pro has. */
  isPro: boolean;
  isMax: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Server-side source of truth for subscription entitlement. The frontend must
 * never be trusted to decide whether a user is subscribed.
 */
export const getEntitlement = cache(
  async (userId: string): Promise<Entitlement> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select(
        "status, price_id, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const status = data?.status ?? "free";
    const active =
      PRO_STATUSES.has(status) &&
      (!data?.current_period_end ||
        new Date(data.current_period_end).getTime() > Date.now() ||
        status !== "free");

    const plan: Plan = active
      ? planForPriceId(data?.price_id, {
          proMonthly: serverEnv.stripePriceProMonthly,
          proAnnual: serverEnv.stripePriceProAnnual,
          maxMonthly: serverEnv.stripePriceMaxMonthly,
        })
      : "free";

    return {
      plan,
      isPro: active,
      isMax: plan === "max",
      status,
      currentPeriodEnd: data?.current_period_end ?? null,
      cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    };
  },
);

/** Free-tier limits enforced server-side. */
export const FREE_LIMITS = {
  aiMessagesPerDay: 10,
  practiceQuestionsPerDay: 30,
};
