import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { isPlan, planForPriceId } from "@/lib/plans";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe || !serverEnv.stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      serverEnv.stripeWebhookSecret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  const prices = {
    proMonthly: serverEnv.stripePriceProMonthly,
    proAnnual: serverEnv.stripePriceProAnnual,
    maxMonthly: serverEnv.stripePriceMaxMonthly,
  };

  /** Tier stamped at checkout, falling back to the price lookup. */
  const planOf = (sub: Stripe.Subscription) => {
    const stamped = sub.metadata?.plan;
    return isPlan(stamped) && stamped !== "free"
      ? stamped
      : planForPriceId(sub.items.data[0]?.price.id, prices);
  };

  /**
   * Who owns this subscription. Metadata on the subscription is set at
   * checkout; the customer's metadata and our own stored subscription ID
   * cover subscriptions created or edited outside that flow.
   */
  const resolveUserId = async (sub: Stripe.Subscription) => {
    const fromSub = sub.metadata?.user_id as string | undefined;
    if (fromSub) return fromSub;
    const customerMeta =
      typeof sub.customer !== "string" && !sub.customer.deleted
        ? sub.customer.metadata?.user_id
        : undefined;
    if (customerMeta) return customerMeta;
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    return data?.user_id;
  };

  const upsertFromSubscription = async (sub: Stripe.Subscription) => {
    const userId = await resolveUserId(sub);
    if (!userId) return;
    await admin
      .from("subscriptions")
      .update({
        stripe_customer_id:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan: planOf(sub),
        price_id: sub.items.data[0]?.price.id ?? null,
        current_period_end: new Date(
          sub.items.data[0].current_period_end * 1000,
        ).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId =
        session.client_reference_id ??
        (session.metadata?.user_id as string | undefined);
      if (userId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await admin
          .from("subscriptions")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: sub.id,
            status: sub.status,
            plan: planOf(sub),
            price_id: sub.items.data[0]?.price.id ?? null,
            current_period_end: new Date(
              sub.items.data[0].current_period_end * 1000,
            ).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      // A cancellation must always land: a miss here leaves the user on Pro
      // forever, so resolve the owner every way we can.
      const sub = event.data.object;
      const userId = await resolveUserId(sub);
      if (userId) {
        await admin
          .from("subscriptions")
          .update({
            status: "free",
            plan: "free",
            stripe_subscription_id: null,
            price_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
