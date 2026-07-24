import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!serverEnv.stripeSecretKey) return null;
  if (!client) {
    client = new Stripe(serverEnv.stripeSecretKey, { typescript: true });
  }
  return client;
}
