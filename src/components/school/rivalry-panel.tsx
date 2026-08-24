"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Megaphone, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Countdown } from "@/components/mock/countdown";
import { sendRivalryBanner } from "@/lib/actions/school";
import { BANNER_PRESETS } from "@/lib/school/rivalry";
import { messages } from "@/lib/i18n/en";
import { cn } from "@/lib/utils";

const t = messages.school;

export type RivalrySide = {
  schoolId: string;
  name: string;
  crest: string;
  score: number;
  activeMembers: number;
};

export type BannerRow = {
  id: string;
  preset_key: string;
  schoolName: string;
  displayName: string;
};

export function RivalryPanel({
  rivalryId,
  mine,
  theirs,
  endsAt,
  finished,
  banners,
  isMember,
  inviteUrl,
}: {
  rivalryId: string;
  mine: RivalrySide;
  theirs: RivalrySide;
  endsAt: string;
  finished: boolean;
  banners: BannerRow[];
  isMember: boolean;
  inviteUrl: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const total = mine.score + theirs.score;
  const share = total > 0 ? (mine.score / total) * 100 : 50;
  const gap = theirs.activeMembers - mine.activeMembers;

  const send = (key: string) =>
    start(async () => {
      const res = await sendRivalryBanner(rivalryId, key);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl).catch(() => {});
    toast.success(t.inviteCopied);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <Swords className="h-4 w-4 text-accent" /> {t.rivalryTitle}
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {finished ? (
              t.rivalryFinished
            ) : (
              <>
                {t.rivalryEnds} <Countdown to={endsAt} className="font-semibold" />
              </>
            )}
          </span>
        </div>

        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold">
            {mine.crest} {mine.name}
          </span>
          <span className="font-mono text-xs uppercase text-muted-foreground">
            {t.rivalryVs}
          </span>
          <span className="font-bold">
            {theirs.name} {theirs.crest}
          </span>
        </div>
        <Progress value={share} />
        <div className="flex justify-between font-mono text-sm tabular-nums">
          <span className={cn(mine.score >= theirs.score && "text-accent font-bold")}>
            {mine.score}
          </span>
          <span className={cn(theirs.score > mine.score && "text-accent font-bold")}>
            {theirs.score}
          </span>
        </div>

        {!finished && gap > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-highlight bg-highlight/10 px-4 py-3">
            <p className="text-sm">
              {t.participationGap
                .replace("{them}", String(theirs.activeMembers))
                .replace("{you}", String(mine.activeMembers))}
            </p>
            <Button size="sm" variant="secondary" onClick={() => void copyInvite()}>
              <Copy className="mr-2 size-4" /> {t.inviteCta}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" /> {t.banners}
          </p>
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
            {banners.map((banner) => (
              <li key={banner.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {banner.schoolName}
                </span>{" "}
                · {BANNER_PRESETS[banner.preset_key] ?? "…"}
              </li>
            ))}
            {banners.length === 0 && (
              <li className="text-xs text-muted-foreground">—</li>
            )}
          </ul>
          {isMember && !finished && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BANNER_PRESETS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => send(key)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface-2"
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
