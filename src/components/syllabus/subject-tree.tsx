"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Search, X } from "lucide-react";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StartSessionButton } from "@/components/app/start-session-button";
import type { SubjectTree as Tree, ThemeNode, TopicNode } from "@/lib/syllabus";

const LEVELS = ["SL", "HL"] as const;

export function SubjectTree({
  tree,
  subjectSlug,
  subjectId,
}: {
  tree: Tree;
  subjectSlug: string;
  subjectId: string;
}) {
  const [query, setQuery] = React.useState("");
  const [level, setLevel] = React.useState<(typeof LEVELS)[number] | null>(null);
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(tree.themes.map((t, i) => [t.id, i === 0])),
  );

  const needle = query.trim().toLowerCase();

  const matches = React.useCallback(
    (t: TopicNode) => {
      if (level && t.levelCode && t.levelCode !== level) return false;
      if (!needle) return true;
      return t.name.toLowerCase().includes(needle);
    },
    [needle, level],
  );

  const groups: (ThemeNode & { visible: TopicNode[] })[] = React.useMemo(() => {
    const themed = tree.themes.map((th) => ({
      ...th,
      visible: th.topics.filter(matches),
    }));
    if (tree.looseTopics.length > 0) {
      themed.push({
        id: "unfiled",
        slug: "unfiled",
        name: "Other topics",
        description: null,
        levelCode: null,
        topics: tree.looseTopics,
        visible: tree.looseTopics.filter(matches),
      });
    }
    return themed.filter((th) => th.visible.length > 0);
  }, [tree, matches]);

  const searching = needle.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5 rounded-md border border-input bg-surface px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search topics in ${tree.subject.name}…`}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex overflow-hidden rounded-md border border-border">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(level === l ? null : l)}
              aria-pressed={level === l}
              className={cn(
                "border-r border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                level === l
                  ? "bg-ink text-ink-foreground dark:bg-foreground dark:text-background"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No topics match “{query}” in {tree.subject.name}.
        </p>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {groups.map((th) => {
            const expanded = searching || open[th.id] !== false;
            const questions = th.visible.reduce((s, t) => s + t.questionCount, 0);
            return (
              <section key={th.id}>
                <h2>
                  <button
                    onClick={() =>
                      setOpen((o) => ({ ...o, [th.id]: !(o[th.id] !== false) }))
                    }
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                        !expanded && "-rotate-90",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold tracking-tight">
                        {th.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {th.visible.length} topics · {questions} questions
                        {th.levelCode ? ` · ${th.levelCode} only` : ""}
                      </span>
                    </span>
                  </button>
                </h2>

                {expanded && (
                  <ul className="grid gap-2 pb-5 sm:grid-cols-2">
                    {th.visible.map((t) => (
                      <li key={t.id}>
                        <TopicCard
                          topic={t}
                          subjectId={subjectId}
                          subjectSlug={subjectSlug}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopicCard({
  topic,
  subjectSlug,
  subjectId,
}: {
  topic: TopicNode;
  subjectSlug: string;
  subjectId: string;
}) {
  return (
    <div className="group h-full border border-border bg-surface transition-[transform,border-color] hover:-translate-y-0.5 hover:border-foreground/40 active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none">
      <Link
        href={`/subjects/${subjectSlug}/${topic.slug}`}
        className="flex items-start gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ProgressRing value={topic.completion} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight group-hover:text-accent">
              {topic.name}
            </span>
            {topic.levelCode && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                {topic.levelCode}
              </span>
            )}
          </span>
          <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            {topic.questionCount} q
            {topic.subtopicCount > 0 ? ` · ${topic.subtopicCount} subtopics` : ""}
            {topic.accuracy !== null
              ? ` · ${Math.round(topic.accuracy * 100)}% acc`
              : ""}
            {topic.estimatedMinutes > 0
              ? ` · ~${formatDuration(topic.estimatedMinutes)}`
              : ""}
          </span>
          <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground/70">
            {topic.lastPracticed
              ? `Last practised ${formatRelativeTime(topic.lastPracticed)}`
              : "Not started"}
          </span>
        </span>
      </Link>
      <div className="border-t border-border px-4 py-2">
        <StartSessionButton
          variant="ghost"
          size="sm"
          input={{
            subjectId,
            topicIds: [topic.id],
            count: Math.min(topic.questionCount || 10, 10),
          }}
          disabled={topic.questionCount === 0}
        >
          Start practice
        </StartSessionButton>
      </div>
    </div>
  );
}
