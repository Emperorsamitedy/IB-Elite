"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, Timer, Bookmark, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import { DIFFICULTIES, QUESTION_COUNT_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createSession } from "@/lib/actions/session";
import type { Difficulty } from "@/lib/types";

type Topic = { id: string; name: string; slug: string };
type SubjectOption = {
  id: string;
  slug: string;
  name: string;
  topics: Topic[];
};

export function PracticeCreator({ subjects }: { subjects: SubjectOption[] }) {
  const [subjectId, setSubjectId] = React.useState<string>(
    subjects[0]?.id ?? "",
  );
  const [topicIds, setTopicIds] = React.useState<string[]>([]);
  const [difficulty, setDifficulty] = React.useState<Difficulty | null>(null);
  const [count, setCount] = React.useState(10);
  const [timed, setTimed] = React.useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = React.useState(false);
  const [includeMistakes, setIncludeMistakes] = React.useState(false);
  const [pending, start] = React.useTransition();

  const subject = subjects.find((s) => s.id === subjectId);

  const toggleTopic = (id: string) =>
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = () =>
    start(async () => {
      const res = await createSession({
        subjectId: subjectId || undefined,
        topicIds: topicIds.length ? topicIds : undefined,
        difficulty,
        count,
        timed,
        onlyBookmarked,
        includeMistakes,
      });
      if (res?.error) toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-5">
      {/* Subject */}
      <Field label="Subject">
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <Chip
              key={s.id}
              active={s.id === subjectId}
              onClick={() => {
                setSubjectId(s.id);
                setTopicIds([]);
              }}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Topics */}
      {subject && subject.topics.length > 0 && (
        <Field
          label="Topics"
          hint={
            topicIds.length === 0 ? "All topics" : `${topicIds.length} selected`
          }
        >
          <div className="flex flex-wrap gap-2">
            {subject.topics.map((t) => (
              <Chip
                key={t.id}
                active={topicIds.includes(t.id)}
                onClick={() => toggleTopic(t.id)}
              >
                {t.name}
              </Chip>
            ))}
          </div>
        </Field>
      )}

      {/* Difficulty */}
      <Field label="Difficulty">
        <div className="flex flex-wrap gap-2">
          <Chip active={difficulty === null} onClick={() => setDifficulty(null)}>
            Mixed
          </Chip>
          {DIFFICULTIES.map((d) => (
            <Chip
              key={d.value}
              active={difficulty === d.value}
              onClick={() => setDifficulty(d.value)}
            >
              {d.label}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Count */}
      <Field label="Number of questions">
        <div className="flex flex-wrap gap-2">
          {QUESTION_COUNT_PRESETS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>
              {n}
            </Chip>
          ))}
        </div>
      </Field>

      {/* Options */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          <ToggleRow
            icon={Timer}
            label="Timed exam mode"
            description="~2 minutes per question with a countdown"
            checked={timed}
            onChange={setTimed}
          />
          <ToggleRow
            icon={Bookmark}
            label="Only bookmarked"
            description="Practise questions you've saved"
            checked={onlyBookmarked}
            onChange={(v) => {
              setOnlyBookmarked(v);
              if (v) setIncludeMistakes(false);
            }}
          />
          <ToggleRow
            icon={AlertCircle}
            label="Only my mistakes"
            description="Revisit questions you got wrong"
            checked={includeMistakes}
            onChange={(v) => {
              setIncludeMistakes(v);
              if (v) setOnlyBookmarked(false);
            }}
          />
        </CardContent>
      </Card>

      <Button size="lg" onClick={submit} disabled={pending}>
        {pending ? <Spinner /> : "Start practising"}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3.5 py-2 text-sm font-medium transition-all",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 p-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
