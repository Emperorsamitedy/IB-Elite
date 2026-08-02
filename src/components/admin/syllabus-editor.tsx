"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, ArrowUp, ArrowDown, Archive, Undo2, Merge } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveTheme,
  saveTopic,
  saveSubtopic,
  setSyllabusStatus,
  moveSyllabusNode,
  mergeTopics,
} from "@/lib/actions/admin";
import type { ContentStatus } from "@/lib/types";

export type AdminSubtopic = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  status: ContentStatus;
};
export type AdminTopic = {
  id: string;
  slug: string;
  name: string;
  levelCode: string | null;
  sortOrder: number;
  status: ContentStatus;
  questionCount: number;
  subtopics: AdminSubtopic[];
};
export type AdminTheme = {
  id: string;
  slug: string;
  name: string;
  levelCode: string | null;
  sortOrder: number;
  status: ContentStatus;
  topics: AdminTopic[];
};
export type AdminSyllabusSubject = {
  id: string;
  slug: string;
  name: string;
  themes: AdminTheme[];
  looseTopics: AdminTopic[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function SyllabusEditor({
  subjects,
}: {
  subjects: AdminSyllabusSubject[];
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  const subject = subjects.find((s) => s.id === subjectId);

  const run = (fn: () => Promise<{ error?: string; ok?: boolean }>, done: string) =>
    start(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(done);
      router.refresh();
    });

  if (!subject) return null;

  const themes = [
    ...subject.themes,
    ...(subject.looseTopics.length > 0
      ? [
          {
            id: "unfiled",
            slug: "unfiled",
            name: "Unfiled topics",
            levelCode: null,
            sortOrder: 999,
            status: "published" as ContentStatus,
            topics: subject.looseTopics,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Subject</Label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="h-10 border border-input bg-surface px-3 text-sm outline-none focus:border-accent"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <NewNodeForm
          label="New theme"
          fields={["name"]}
          disabled={pending}
          onSubmit={({ name }) =>
            run(
              () =>
                saveTheme(null, {
                  subjectId: subject.id,
                  slug: slugify(name),
                  name,
                  sortOrder: subject.themes.length + 1,
                }),
              "Theme added",
            )
          }
        />
      </div>

      <div className="divide-y divide-border border-y border-border">
        {themes.map((theme, ti) => {
          const expanded = open[theme.id] ?? ti === 0;
          const unfiled = theme.id === "unfiled";
          return (
            <section key={theme.id}>
              <div className="flex flex-wrap items-center gap-2 py-3">
                <button
                  onClick={() =>
                    setOpen((o) => ({ ...o, [theme.id]: !expanded }))
                  }
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      !expanded && "-rotate-90",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-bold tracking-tight">
                      {theme.name}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {theme.slug} · {theme.topics.length} topics · {theme.status}
                    </span>
                  </span>
                </button>

                {!unfiled && (
                  <div className="flex items-center gap-1">
                    <RenameButton
                      label="Rename theme"
                      initial={theme.name}
                      disabled={pending}
                      onSubmit={(name) =>
                        run(
                          () =>
                            saveTheme(theme.id, {
                              subjectId: subject.id,
                              slug: theme.slug,
                              name,
                              levelCode:
                                (theme.levelCode as "SL" | "HL" | null) ?? null,
                              sortOrder: theme.sortOrder,
                            }),
                          "Theme renamed",
                        )
                      }
                    />
                    <IconButton
                      label="Move theme up"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            moveSyllabusNode("themes", theme.id, Math.max(0, theme.sortOrder - 1)),
                          "Theme moved",
                        )
                      }
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label="Move theme down"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => moveSyllabusNode("themes", theme.id, theme.sortOrder + 1),
                          "Theme moved",
                        )
                      }
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      label={theme.status === "archived" ? "Restore theme" : "Archive theme"}
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            setSyllabusStatus(
                              "themes",
                              theme.id,
                              theme.status === "archived" ? "published" : "archived",
                            ),
                          theme.status === "archived" ? "Theme restored" : "Theme archived",
                        )
                      }
                    >
                      {theme.status === "archived" ? (
                        <Undo2 className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </IconButton>
                  </div>
                )}
              </div>

              {expanded && (
                <div className="pb-4 pl-6">
                  {!unfiled && (
                    <NewNodeForm
                      label="New topic"
                      fields={["name"]}
                      disabled={pending}
                      onSubmit={({ name }) =>
                        run(
                          () =>
                            saveTopic(null, {
                              subjectId: subject.id,
                              themeId: theme.id,
                              slug: slugify(name),
                              name,
                              sortOrder: theme.topics.length + 1,
                            }),
                          "Topic added",
                        )
                      }
                    />
                  )}

                  <ul className="mt-3 flex flex-col gap-2">
                    {theme.topics.map((topic) => (
                      <li key={topic.id} className="border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {topic.name}
                              {topic.levelCode && (
                                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                                  {topic.levelCode}
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                              {topic.slug} · {topic.questionCount} questions ·{" "}
                              {topic.subtopics.length} subtopics · {topic.status}
                            </span>
                          </span>
                          <RenameButton
                            label="Rename topic"
                            initial={topic.name}
                            disabled={pending}
                            onSubmit={(name) =>
                              run(
                                () =>
                                  saveTopic(topic.id, {
                                    subjectId: subject.id,
                                    themeId: unfiled ? null : theme.id,
                                    slug: topic.slug,
                                    name,
                                    levelCode:
                                      (topic.levelCode as "SL" | "HL" | null) ?? null,
                                    sortOrder: topic.sortOrder,
                                  }),
                                "Topic renamed",
                              )
                            }
                          />
                          <IconButton
                            label="Move topic up"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  moveSyllabusNode(
                                    "topics",
                                    topic.id,
                                    Math.max(0, topic.sortOrder - 1),
                                  ),
                                "Topic moved",
                              )
                            }
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            label="Move topic down"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  moveSyllabusNode("topics", topic.id, topic.sortOrder + 1),
                                "Topic moved",
                              )
                            }
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </IconButton>
                          <MergeButton
                            topic={topic}
                            subject={subject}
                            disabled={pending}
                            onSubmit={(targetId) =>
                              run(
                                () => mergeTopics(topic.id, targetId),
                                "Topics merged",
                              )
                            }
                          />
                          <IconButton
                            label={
                              topic.status === "archived" ? "Restore topic" : "Archive topic"
                            }
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  setSyllabusStatus(
                                    "topics",
                                    topic.id,
                                    topic.status === "archived" ? "published" : "archived",
                                  ),
                                topic.status === "archived"
                                  ? "Topic restored"
                                  : "Topic archived",
                              )
                            }
                          >
                            {topic.status === "archived" ? (
                              <Undo2 className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </IconButton>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                          {topic.subtopics.map((st) => (
                            <span
                              key={st.id}
                              className={cn(
                                "flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em]",
                                st.status === "archived" && "text-muted-foreground line-through",
                              )}
                            >
                              {st.name}
                              <button
                                aria-label={
                                  st.status === "archived"
                                    ? `Restore ${st.name}`
                                    : `Archive ${st.name}`
                                }
                                disabled={pending}
                                onClick={() =>
                                  run(
                                    () =>
                                      setSyllabusStatus(
                                        "subtopics",
                                        st.id,
                                        st.status === "archived" ? "published" : "archived",
                                      ),
                                    "Subtopic updated",
                                  )
                                }
                                className="text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {st.status === "archived" ? (
                                  <Undo2 className="h-3 w-3" />
                                ) : (
                                  <Archive className="h-3 w-3" />
                                )}
                              </button>
                            </span>
                          ))}
                          <NewNodeForm
                            label="Subtopic"
                            compact
                            fields={["name"]}
                            disabled={pending}
                            onSubmit={({ name }) =>
                              run(
                                () =>
                                  saveSubtopic(null, {
                                    topicId: topic.id,
                                    slug: slugify(name),
                                    name,
                                    sortOrder: topic.subtopics.length + 1,
                                  }),
                                "Subtopic added",
                              )
                            }
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="border border-border p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function NewNodeForm({
  label,
  onSubmit,
  disabled,
  compact,
}: {
  label: string;
  fields: "name"[];
  onSubmit: (values: { name: string }) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [name, setName] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name: name.trim() });
        setName("");
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={label}
        aria-label={label}
        className={compact ? "h-7 w-40 text-xs" : "h-10 w-56"}
      />
      <Button
        type="submit"
        variant="secondary"
        size={compact ? "sm" : "md"}
        disabled={disabled || !name.trim()}
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </form>
  );
}

function RenameButton({
  label,
  initial,
  onSubmit,
  disabled,
}: {
  label: string;
  initial: string;
  onSubmit: (name: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(initial);

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        disabled={disabled}
        className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Rename
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name.trim());
        setEditing(false);
      }}
      className="flex items-center gap-1.5"
    >
      <Input
        autoFocus
        value={name}
        aria-label={label}
        onChange={(e) => setName(e.target.value)}
        className="h-8 w-48 text-sm"
      />
      <Button type="submit" size="sm" disabled={disabled || !name.trim()}>
        Save
      </Button>
    </form>
  );
}

function MergeButton({
  topic,
  subject,
  onSubmit,
  disabled,
}: {
  topic: AdminTopic;
  subject: AdminSyllabusSubject;
  onSubmit: (targetId: string) => void;
  disabled?: boolean;
}) {
  const [target, setTarget] = React.useState("");
  const options = [
    ...subject.themes.flatMap((t) => t.topics),
    ...subject.looseTopics,
  ].filter((t) => t.id !== topic.id);

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label={`Merge ${topic.name} into`}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="h-7 max-w-[10rem] border border-input bg-surface px-1.5 font-mono text-[10px] uppercase outline-none focus:border-accent"
      >
        <option value="">Merge into…</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <IconButton
        label={`Merge ${topic.name}`}
        disabled={disabled || !target}
        onClick={() => target && onSubmit(target)}
      >
        <Merge className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
