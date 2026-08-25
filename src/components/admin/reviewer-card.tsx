"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";

export type Review = {
  reviewer_name: string | null;
  reviewer_credential: string | null;
  reviewed_at: string | null;
};

/**
 * "Verified by" attribution. Saving stamps `reviewed_at` server-side, so it
 * lives apart from the main form: editing the prompt must not re-date a
 * review, and a review must not depend on the rest of the form validating.
 */
export function ReviewerCard({
  questionId,
  review,
}: {
  questionId: string;
  review: Review;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(review.reviewer_name ?? "");
  const [credential, setCredential] = React.useState(
    review.reviewer_credential ?? "",
  );
  const [pending, start] = React.useTransition();

  const dirty =
    name.trim() !== (review.reviewer_name ?? "") ||
    credential.trim() !== (review.reviewer_credential ?? "");

  const save = () =>
    start(async () => {
      const res = await fetch(`/api/questions/${questionId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_name: name.trim(),
          reviewer_credential: credential.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error ?? "Could not save the review.");
        return;
      }
      toast.success("Marked as reviewed");
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <BadgeCheck className="h-4 w-4 text-success" /> Verification
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {review.reviewed_at
              ? `Shown to students as "Reviewed by ${review.reviewer_name}". Last reviewed ${new Date(review.reviewed_at).toLocaleDateString()}.`
              : "Not yet reviewed. Add who checked this question and students will see the attribution."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviewer_name">Reviewer</Label>
            <Input
              id="reviewer_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr A. Lovelace"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reviewer_credential">Credential</Label>
            <Input
              id="reviewer_credential"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder="IB Maths AA examiner, 12 years"
              maxLength={200}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={save}
            disabled={pending || !dirty || !name.trim() || !credential.trim()}
          >
            {pending ? <Spinner /> : "Save review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
