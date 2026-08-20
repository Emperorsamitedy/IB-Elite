import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { serverEnv, env } from "@/lib/env";

const schema = z.object({
  interval: z.enum(["monthly", "annual"]),
  plan: z.enum(["pro", "max"]).default("pro"),
});

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured yet." },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Max is monthly only; an annual Max request has no price to charge.
  const priceId =
    parsed.data.plan === "max"
      ? parsed.data.interval === "monthly"
        ? serverEnv.stripePriceMaxMonthly
        : ""
      : parsed.data.interval === "annual"
        ? serverEnv.stripePriceProAnnual
        : serverEnv.stripePriceProMonthly;
  if (!priceId) {
    return NextResponse.json(
      { error: "No price configured for this plan." },
      { status: 503 },
    );
  }

  // Reuse an existing Stripe customer if we have one.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: sub?.stripe_customer_id ?? undefined,
    customer_email: sub?.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${env.siteUrl}/settings/billing?status=success`,
    cancel_url: `${env.siteUrl}/settings/billing?status=cancelled`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
