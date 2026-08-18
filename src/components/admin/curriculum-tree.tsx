"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DESTRUCTIVE_LEVELS, type CurriculumLevel } from "@/lib/admin/curriculum";

export type Node = { id: string; name: string; slug: string };
export type CurriculumData = {
  subjects: Node[];
  themes: (Node & { subject_id: string })[];
  topics: (Node & { subject_id: string; theme_id: string | null })[];
  subtopics: (Node & { topic_id: string })[];
};

const LABEL: Record<CurriculumLevel, string> = {
  subjects: "Subjects",
  themes: "Themes",
  topics: "Topics",
  subtopics: "Subtopics",
};

type Pending = { level: CurriculumLevel; node: Node; affected: number } | null;

export function CurriculumTree({ data }: { data: CurriculumData }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(data.subjects[0]?.id ?? "");
  const [themeId, setThemeId] = React.useState<string | null>(null);
  const [topicId, setTopicId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Pending>(null);
  const [busy, setBusy] = React.useState(false);

  const themes = data.themes.filter((t) => t.subject_id === subjectId);
  const topics = data.topics.filter((t) =>
    themeId ? t.theme_id === themeId : t.subject_id === subjectId,
  );
  const subtopics = data.subtopics.filter((s) => s.topic_id === topicId);

  async function add(level: CurriculumLevel, parent: Record<string, string>) {
    const name = window.prompt(`New ${LABEL[level].slice(0, -1).toLowerCase()} name`);
    if (!name?.trim()) return;
    const res = await fetch(`/api/admin/curriculum/${level}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parent, name: name.trim(), slug: slugify(name) }),
    });
    if (!res.ok) {
      toast.error(`Could not add the ${LABEL[level].slice(0, -1).toLowerCase()}.`);
      return;
    }
    router.refresh();
  }

  async function askDelete(level: CurriculumLevel, node: Node) {
    const res = await fetch(`/api/admin/curriculum/${level}/${node.id}`);
    const affected = res.ok ? ((await res.json()).affected as number) : 0;
    setPending({ level, node, affected });
  }

  async function confirmDelete() {
    if (!pending) return;
    setBusy(true);
    const force = DESTRUCTIVE_LEVELS.includes(pending.level);
    const res = await fetch(
      `/api/admin/curriculum/${pending.level}/${pending.node.id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete.");
      return;
    }
    toast.success(`${pending.node.name} deleted`);
    setPending(null);
    router.refresh();
  }

  async function reorder(level: CurriculumLevel, ids: string[]) {
    const res = await fetch("/api/admin/curriculum/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, ids }),
    });
    if (!res.ok) toast.error("Could not save the new order.");
    router.refresh();
  }

  const destructive = pending && DESTRUCTIVE_LEVELS.includes(pending.level);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">
        Curriculum management
      </h1>

      <div className="grid gap-4 xl:grid-cols-4">
        <Column
          level="subjects"
          nodes={data.subjects}
          selected={subjectId}
          onSelect={(id) => {
            setSubjectId(id);
            setThemeId(null);
            setTopicId(null);
          }}
          onAdd={() => add("subjects", {})}
          onDelete={(n) => askDelete("subjects", n)}
          onReorder={(ids) => reorder("subjects", ids)}
        />
        <Column
          level="themes"
          nodes={themes}
          selected={themeId}
          onSelect={(id) => {
            setThemeId(id === themeId ? null : id);
            setTopicId(null);
          }}
          onAdd={
            subjectId ? () => add("themes", { subject_id: subjectId }) : undefined
          }
          onDelete={(n) => askDelete("themes", n)}
          onReorder={(ids) => reorder("themes", ids)}
        />
        <Column
          level="topics"
          nodes={topics}
          selected={topicId}
          onSelect={(id) => setTopicId(id === topicId ? null : id)}
          onAdd={
            subjectId
              ? () =>
                  add("topics", {
                    subject_id: subjectId,
                    ...(themeId ? { theme_id: themeId } : {}),
                  })
              : undefined
          }
          onDelete={(n) => askDelete("topics", n)}
          onReorder={(ids) => reorder("topics", ids)}
        />
        <Column
          level="subtopics"
          nodes={subtopics}
          selected={null}
          onSelect={() => {}}
          onAdd={topicId ? () => add("subtopics", { topic_id: topicId }) : undefined}
          onDelete={(n) => askDelete("subtopics", n)}
          onReorder={(ids) => reorder("subtopics", ids)}
        />
      </div>

      <Dialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pending?.node.name}?</DialogTitle>
            <DialogDescription>
              {pending && describeImpact(pending.level, pending.affected)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>
              {destructive && pending!.affected > 0
                ? `Delete anyway (${pending!.affected} questions)`
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function describeImpact(level: CurriculumLevel, affected: number) {
  if (level === "subtopics") {
    return affected > 0
      ? `${affected} question${affected === 1 ? "" : "s"} will lose their subtopic tag.`
      : "No questions are tagged with this subtopic.";
  }
  if (level === "themes") {
    return "Its topics stay, but lose their theme grouping. No questions are deleted.";
  }
  return affected > 0
    ? `${affected} question${affected === 1 ? "" : "s"} are attached and will be permanently deleted with it. This cannot be undone.`
    : "Nothing is attached to it.";
}

function Column({
  level,
  nodes,
  selected,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
}: {
  level: CurriculumLevel;
  nodes: Node[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  onDelete: (node: Node) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [order, setOrder] = React.useState(nodes);
  const dragging = React.useRef<string | null>(null);

  React.useEffect(() => setOrder(nodes), [nodes]);

  function onDrop(targetId: string) {
    const from = order.findIndex((n) => n.id === dragging.current);
    const to = order.findIndex((n) => n.id === targetId);
    dragging.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    onReorder(next.map((n) => n.id));
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {LABEL[level]}
          </span>
          {onAdd && (
            <Button variant="ghost" size="sm" onClick={onAdd} aria-label={`Add ${LABEL[level]}`}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ul className="flex flex-col gap-1">
          {order.map((n) => (
            <li
              key={n.id}
              draggable
              onDragStart={() => (dragging.current = n.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(n.id)}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                selected === n.id
                  ? "bg-surface-2 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-surface-2",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/60" />
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className="min-w-0 flex-1 truncate text-left"
              >
                {n.name}
              </button>
              {selected === n.id && <ChevronRight className="h-3.5 w-3.5" />}
              <button
                type="button"
                aria-label={`Delete ${n.name}`}
                onClick={() => onDelete(n)}
                className="opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {order.length === 0 && (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
