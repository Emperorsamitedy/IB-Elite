"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setNotificationOptout } from "@/lib/actions/profile";

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "duels", label: "Duels", hint: "Match found, challenges, results" },
  { key: "mock", label: "World Mock", hint: "Sittings, delays, Results Day" },
  { key: "school", label: "School Wars", hint: "Rivalries and lead changes" },
  { key: "season", label: "Seasons", hint: "Season endings and placements" },
  { key: "system", label: "Platform", hint: "Everything else that matters" },
];

/** A category is ON unless the student has opted out. */
export function NotificationPrefs({ mutedCategories }: { mutedCategories: string[] }) {
  const router = useRouter();
  const [muted, setMuted] = React.useState(new Set(mutedCategories));
  const [pending, start] = React.useTransition();

  const toggle = (key: string, on: boolean) => {
    setMuted((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key);
      else next.add(key);
      return next;
    });
    start(async () => {
      const res = await setNotificationOptout(key, !on);
      if (res?.error) toast.error(res.error);
      router.refresh();
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <h2 className="text-sm font-semibold">Preferences</h2>
        {CATEGORIES.map((category) => (
          <label
            key={category.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>
              <span className="font-medium">{category.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {category.hint}
              </span>
            </span>
            <Switch
              checked={!muted.has(category.key)}
              disabled={pending}
              onCheckedChange={(v) => toggle(category.key, v)}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
