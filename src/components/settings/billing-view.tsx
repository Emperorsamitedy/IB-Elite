"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/misc";
import { PRICING } from "@/lib/constants";

const PRO_FEATURES = [
  "Unlimited practice sessions",
  "AI tutor with progressive hints",
  "Personalised study plans",
  "Full mistake analytics",
  "Unlimited exam countdowns",
];

export function BillingView({
  isPro,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  stripeConfigured,
}: {
  isPro: boolean;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}) {
  const [pending, setPending] = React.useState<string | null>(null);

  const checkout = async (interval: "monthly" | "annual") => {
    setPending(interval);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setPending(null);
    }
  };

  const portal = async () => {
    setPending("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">Current plan</p>
              <Badge variant={isPro ? "accent" : "outline"}>
                {isPro ? "Pro" : "Free"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPro
                ? cancelAtPeriodEnd && currentPeriodEnd
                  ? `Cancels on ${new Date(currentPeriodEnd).toLocaleDateString()}`
                  : currentPeriodEnd
                    ? `Renews on ${new Date(currentPeriodEnd).toLocaleDateString()}`
                    : `Status: ${status}`
                : "Upgrade to unlock the full toolkit."}
            </p>
          </div>
          {isPro && stripeConfigured && (
            <Button variant="outline" onClick={portal} disabled={!!pending}>
              {pending === "portal" ? <Spinner /> : "Manage billing"}
            </Button>
          )}
        </CardContent>
      </Card>

      {!isPro && (
        <Card className="border-accent/30">
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex items-center gap-2">
              <span className="rounded-[3px] bg-accent px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
                Pro
              </span>
              <div>
                <p className="font-semibold">Atlas Pro</p>
                <p className="text-sm text-muted-foreground">
                  From £{PRICING.monthly.amount}/month
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>

            {stripeConfigured ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => checkout("monthly")}
                  disabled={!!pending}
                >
                  {pending === "monthly" ? (
                    <Spinner />
                  ) : (
                    `£${PRICING.monthly.amount}/month`
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => checkout("annual")}
                  disabled={!!pending}
                >
                  {pending === "annual" ? (
                    <Spinner />
                  ) : (
                    `£${PRICING.annual.amount}/year · save 33%`
                  )}
                </Button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Payments aren&apos;t configured in this environment yet. Add your
                Stripe keys to enable checkout.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
