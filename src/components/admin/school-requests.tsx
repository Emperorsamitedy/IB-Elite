"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reviewSchoolRequest } from "@/lib/actions/school";

export type RequestRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  requester: string;
  created_at: string;
};

export function SchoolRequests({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const review = (id: string, approve: boolean) =>
    start(async () => {
      const res = await reviewSchoolRequest(id, approve);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">
        School requests
      </h1>
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing pending — new school requests land here for verification.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{request.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[request.city, request.country].filter(Boolean).join(", ")}{" "}
                    · requested by {request.requester} ·{" "}
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => review(request.id, true)}
                  >
                    <Check className="mr-1.5 size-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => review(request.id, false)}
                  >
                    <X className="mr-1.5 size-3.5" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
