"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Timer,
  Bookmark,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import { DIFFICULTIES, QUESTION_COUNT_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createSession } from "@/lib/actions/session";
import type { Difficulty } from "@/lib/types";

type Topic = {
  id: string;
  name: string;
  slug: string;
  theme_id?: string | null;
  sort_order?: number | null;
};
type Theme = { id: string; name: string; sort_order?: number | null };
type SubjectOption = {
  id: string;
  slug: string;
  name: string;
  topics: Topic[];
  themes?: Theme[];
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
  const [query, setQuery] = React.useState("");
  const [showDetails, setShowDetails] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [pending, start] = React.useTransition();

  const subject = subjects.find((s) => s.id === subjectId);

  const groups = React.useMemo(() => {
    if (!subject) return [];
    const needle = query.trim().toLowerCase();
    const match = (t: Topic) =>
      !needle || t.name.toLowerCase().includes(needle);
    const topics = [...subject.topics].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const themes = [...(subject.themes ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const out = themes.map((theme, i) => ({
      id: theme.id,
      name: `${i + 1}. ${theme.name}`,
      topics: topics.filter((t) => t.theme_id === theme.id && match(t)),
    }));
    const loose = topics.filter((t) => !t.theme_id && match(t));
    if (loose.length) {
      out.push({ id: "__other", name: "Other topics", topics: loose });
    }
    return out.filter((g) => g.topics.length > 0);
  }, [subject, query]);

  const toggleTopic = (id: string) =>
    setTopicIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleGroup = (id: string) =>
    setCollapsed((prev) =>
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
    <div className="flex flex-col gap-4">
      <Panel label="Subject">
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <Chip
              key={s.id}
              active={s.id === subjectId}
              onClick={() => {
                setSubjectId(s.id);
                setTopicIds([]);
                setQuery("");
              }}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </Panel>

      {subject && subject.topics.length > 0 && (
        <Panel
          label="Topics"
          hint={
            topicIds.length === 0 ? "All topics" : `${topicIds.length} selected`
          }
        >
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
              className="h-9 pr-9"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto rounded-md border border-border bg-background/40 p-2">
            <p className="px-1 pb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {subject.name}
            </p>
            {groups.length === 0 && (
              <p className="px-1 py-3 text-sm text-muted-foreground">
                No topics match “{query}”.
              </p>
            )}
            {groups.map((g) => {
              const open = !collapsed.includes(g.id);
              return (
                <div key={g.id} className="py-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-sm font-medium hover:bg-muted/50"
                  >
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {g.name}
                  </button>
                  {open && (
                    <div className="ml-5 flex flex-col">
                      {g.topics.map((t) => {
                        const active = topicIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTopic(t.id)}
                            aria-pressed={active}
                            className={cn(
                              "flex items-center justify-between rounded px-2 py-1 text-left text-sm transition-colors",
                              active
                                ? "bg-accent/10 font-medium text-accent"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                          >
                            {t.name}
                            {active && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Panel label="Session details">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Difficulty and number of questions
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {`${
                difficulty
                  ? DIFFICULTIES.find((d) => d.value === difficulty)?.label
                  : "Mixed"
              } · ${count} questions · ${timed ? "Timed" : "Untimed"}`}
            </p>
          </div>
          <Switch checked={showDetails} onCheckedChange={setShowDetails} />
        </label>

        {showDetails && (
          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Difficulty
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={difficulty === null}
                  onClick={() => setDifficulty(null)}
                >
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
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Number of questions
              </p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_COUNT_PRESETS.map((n) => (
                  <Chip key={n} active={count === n} onClick={() => setCount(n)}>
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            <ToggleRow
              icon={Timer}
              label="Timed exam mode"
              description="~2 minutes per question with a countdown"
              checked={timed}
              onChange={setTimed}
            />
          </div>
        )}
      </Panel>

      <Panel label="Advanced options">
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            icon={Bookmark}
            label="Only bookmarked"
            description="Practise questions you've saved"
            checked={onlyBookmarked}
            onChange={(v) => {
              setOnlyBookmarked(v);
              if (v) setIncludeMistakes(false);
            }}
            boxed
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
            boxed
          />
        </div>
      </Panel>

      <Button
        size="lg"
        onClick={submit}
        disabled={pending}
        className="w-full py-6 text-base"
      >
        {pending ? (
          <Spinner />
        ) : (
          <>
            {`Start practice (${count} questions, ${timed ? "Timed" : "Untimed"})`}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

function Panel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="flex-1" />
        {hint && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
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
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  boxed,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  boxed?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3",
        boxed && "rounded-lg border border-border p-3",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
