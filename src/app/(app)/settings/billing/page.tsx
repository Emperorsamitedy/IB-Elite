import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/subscription";
import { featureFlags } from "@/lib/env";
import { BillingView } from "@/components/settings/billing-view";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const user = await requireUser();
  const entitlement = await getEntitlement(user.id);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Billing</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Billing & subscription
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your Atlas plan and payment details.
        </p>
      </div>

      <BillingView
        isPro={entitlement.isPro}
        status={entitlement.status}
        currentPeriodEnd={entitlement.currentPeriodEnd}
        cancelAtPeriodEnd={entitlement.cancelAtPeriodEnd}
        stripeConfigured={featureFlags.stripe}
      />
    </div>
  );
}
