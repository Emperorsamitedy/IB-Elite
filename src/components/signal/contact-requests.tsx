"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { respondToContact } from "@/lib/actions/scout";

export type ContactRow = {
  id: string;
  institutionName: string;
  message: string | null;
  created_at: string;
};

/** Institutional contact requests: nothing moves until the student says so. */
export function ContactRequests({ requests }: { requests: ContactRow[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (requests.length === 0) return null;

  const respond = (id: string, approve: boolean) =>
    start(async () => {
      const res = await respondToContact(id, approve);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6">
        <h2 className="text-sm font-semibold">Contact requests</h2>
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="text-sm">
              <p className="font-medium">{request.institutionName}</p>
              <p className="text-xs text-muted-foreground">
                Approving shares your name with this institution only. Your
                scanned work is never shared.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => respond(request.id, true)}>
                <Check className="mr-1.5 size-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => respond(request.id, false)}
              >
                <X className="mr-1.5 size-3.5" /> Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
