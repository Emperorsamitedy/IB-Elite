"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import {
  joinRegionalTeam,
  joinSchool,
  requestSchool,
} from "@/lib/actions/school";
import { messages } from "@/lib/i18n/en";

const t = messages.school;

export type SchoolHit = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  crest_emoji: string;
  members: number;
};

export function SchoolJoin({
  schools,
  country,
  inviterId,
}: {
  schools: SchoolHit[];
  country: string | null;
  inviterId?: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [requesting, setRequesting] = React.useState(false);
  const [requestName, setRequestName] = React.useState("");
  const [requestCity, setRequestCity] = React.useState("");
  const [requestCountry, setRequestCountry] = React.useState(country ?? "");
  const [pending, start] = React.useTransition();

  const hits = schools.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const join = (schoolId: string) =>
    start(async () => {
      const res = await joinSchool(schoolId, inviterId ?? null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  const submitRequest = () =>
    start(async () => {
      const res = await requestSchool({
        name: requestName,
        city: requestCity || undefined,
        country: requestCountry.toUpperCase(),
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t.requestPending);
      setRequesting(false);
      setRequestName("");
    });

  const joinRegional = () =>
    start(async () => {
      const code = (country ?? requestCountry).toUpperCase();
      const res = await joinRegionalTeam(code);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <Input
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {hits.slice(0, 30).map((school) => (
            <li
              key={school.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm">
                <span className="mr-2">{school.crest_emoji}</span>
                <span className="font-medium">{school.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {[school.city, school.country].filter(Boolean).join(", ")} ·{" "}
                  {school.members} {t.members}
                </span>
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => join(school.id)}
              >
                {t.join}
              </Button>
            </li>
          ))}
          {hits.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">
              {t.requestTitle}
            </li>
          )}
        </ul>

        {requesting ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Input
              placeholder="School name"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="City"
                value={requestCity}
                onChange={(e) => setRequestCity(e.target.value)}
              />
              <Input
                placeholder="Country (e.g. ET)"
                maxLength={2}
                className="w-28 uppercase"
                value={requestCountry}
                onChange={(e) => setRequestCountry(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRequesting(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitRequest}
                disabled={pending || requestName.trim().length < 3}
              >
                {pending ? <Spinner /> : t.requestCta}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setRequesting(true)}>
              <School className="mr-2 size-4" /> {t.requestTitle} {t.requestCta}
            </Button>
            {country ? (
              <Button variant="ghost" size="sm" onClick={joinRegional} disabled={pending}>
                <Flag className="mr-2 size-4" /> {t.joinRegional} {country}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">{t.countryFirst}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
