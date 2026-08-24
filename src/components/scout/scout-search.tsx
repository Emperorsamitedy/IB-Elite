"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { requestContact, scoutSearch, type ScoutHit } from "@/lib/actions/scout";

export function ScoutSearch({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [subjectId, setSubjectId] = React.useState("");
  const [minRating, setMinRating] = React.useState(60);
  const [trajectory, setTrajectory] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [hits, setHits] = React.useState<ScoutHit[] | null>(null);
  const [pending, start] = React.useTransition();

  const search = () =>
    start(async () => {
      const res = await scoutSearch({
        subjectId: subjectId || undefined,
        minRating,
        trajectory: (trajectory || undefined) as
          | "improving"
          | "stable"
          | "declining"
          | undefined,
        country: country ? country.toUpperCase() : undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setHits(res.hits ?? []);
    });

  const contact = (studentId: string) =>
    start(async () => {
      const res = await requestContact(studentId, "");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request sent — the student decides.");
      setHits(
        (prev) =>
          prev?.map((h) =>
            h.userId === studentId ? { ...h, contactStatus: "pending" } : h,
          ) ?? null,
      );
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-5">
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={0}
            max={100}
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value) || 0)}
            placeholder="Min rating"
          />
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={trajectory}
            onChange={(e) => setTrajectory(e.target.value)}
          >
            <option value="">Any trajectory</option>
            <option value="improving">Improving</option>
            <option value="stable">Stable</option>
            <option value="declining">Declining</option>
          </select>
          <Input
            maxLength={2}
            className="uppercase"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
          />
          <Button onClick={search} disabled={pending}>
            {pending ? <Spinner /> : <Search className="mr-2 size-4" />}
            Search
          </Button>
        </CardContent>
      </Card>

      {hits !== null && (
        <Card>
          <CardContent className="p-0">
            {hits.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No opted-in students match those filters.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Student</th>
                    <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                    <th className="px-4 py-2.5 text-right font-medium">Rating</th>
                    <th className="px-4 py-2.5 text-left font-medium">Signal</th>
                    <th className="px-4 py-2.5 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {hits.map((hit) => (
                    <tr
                      key={`${hit.userId}:${hit.subjectName}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        {hit.displayName}
                        {hit.country && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {hit.country}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{hit.subjectName}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        {hit.rating}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={hit.tier === "verified" ? "success" : "outline"}
                          >
                            {hit.tier}
                          </Badge>
                          <Badge variant="outline">{hit.trajectory}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(hit.confidence * 100)}% · n=
                            {hit.sampleSize}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {hit.contactStatus ? (
                          <Badge variant="outline">{hit.contactStatus}</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() => contact(hit.userId)}
                          >
                            <Send className="mr-1.5 size-3.5" /> Request contact
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
