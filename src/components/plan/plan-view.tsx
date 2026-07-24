"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarRange, Sparkles, Check, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/misc";
import { StartSessionButton } from "@/components/app/start-session-button";
import { cn, daysUntil } from "@/lib/utils";
import { generateStudyPlan, togglePlanItem } from "@/lib/actions/plan";
import type { PlanIntensity } from "@/lib/types";

export type PlanItem = {
  id: string;
  day: string;
  title: string;
  subjectId: string | null;
  topicId: string | null;
  questionCount: number;
  estimatedMinutes: number;
  completed: boolean;
};

const INTENSITIES: { value: PlanIntensity; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "1 topic / day" },
  { value: "balanced", label: "Balanced", desc: "2 topics / day" },
  { value: "intense", label: "Intense", desc: "3 topics / day" },
];

export function PlanGenerator({ hasPlan }: { hasPlan: boolean }) {
  const [intensity, setIntensity] = React.useState<PlanIntensity>("balanced");
  const [pending, start] = React.useTransition();

  const generate = () =>
    start(async () => {
      const res = await generateStudyPlan(intensity);
      if (res?.error) toast.error(res.error);
      else toast.success("Study plan ready");
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="font-semibold">
            {hasPlan ? "Regenerate your plan" : "Generate your study plan"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          We&apos;ll build a day-by-day plan around your subjects, exam dates and
          weak topics.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map((i) => (
            <button
              key={i.value}
              onClick={() => setIntensity(i.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                intensity === i.value
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:bg-surface-2",
              )}
            >
              <p className="text-sm font-medium">{i.label}</p>
              <p className="text-xs text-muted-foreground">{i.desc}</p>
            </button>
          ))}
        </div>
        <Button onClick={generate} disabled={pending}>
          {pending ? <Spinner /> : hasPlan ? "Regenerate plan" : "Generate plan"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PlanItemRow({ item }: { item: PlanItem }) {
  const [completed, setCompleted] = React.useState(item.completed);
  const [pending, start] = React.useTransition();

  const toggle = () =>
    start(async () => {
      setCompleted((c) => !c);
      await togglePlanItem(item.id, !completed);
    });

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3",
        completed && "opacity-60",
      )}
    >
      <button
        onClick={toggle}
        disabled={pending}
        aria-label="Toggle complete"
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          completed
            ? "border-success bg-success text-white"
            : "border-border hover:border-accent",
        )}
      >
        {completed && <Check className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            completed && "line-through",
          )}
        >
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {item.questionCount} questions · ~{item.estimatedMinutes} min
        </p>
      </div>
      <StartSessionButton
        variant="ghost"
        size="icon-sm"
        aria-label="Start"
        input={{
          subjectId: item.subjectId ?? undefined,
          topicIds: item.topicId ? [item.topicId] : undefined,
          count: item.questionCount,
        }}
      >
        <Play className="h-4 w-4" />
      </StartSessionButton>
    </div>
  );
}

export function PlanDay({ day, items }: { day: string; items: PlanItem[] }) {
  const d = new Date(day);
  const left = daysUntil(day);
  const label =
    left === 0
      ? "Today"
      : left === 1
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
  const done = items.every((i) => i.completed);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{label}</span>
        {done && <Badge variant="success">Done</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((i) => (
          <PlanItemRow key={i.id} item={i} />
        ))}
      </div>
    </div>
  );
}
