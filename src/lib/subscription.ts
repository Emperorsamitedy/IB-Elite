import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Entitlement = {
  plan: "free" | "pro";
  isPro: boolean;
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
        "status, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const status = data?.status ?? "free";
    const active =
      PRO_STATUSES.has(status) &&
      (!data?.current_period_end ||
        new Date(data.current_period_end).getTime() > Date.now() ||
        status !== "free");

    return {
      plan: active ? "pro" : "free",
      isPro: active,
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
