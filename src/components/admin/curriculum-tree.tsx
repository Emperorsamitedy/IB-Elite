"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Pencil,
  Archive,
  ArchiveRestore,
  Merge,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DESTRUCTIVE_LEVELS,
  type CurriculumLevel,
  type CurriculumStatus,
} from "@/lib/admin/curriculum";

export type Node = {
  id: string;
  name: string;
  slug: string;
  /** Subjects have no status column; every other level does. */
  status?: CurriculumStatus;
};
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

const SINGULAR: Record<CurriculumLevel, string> = {
  subjects: "subject",
  themes: "theme",
  topics: "topic",
  subtopics: "subtopic",
};

type PendingDelete = {
  level: CurriculumLevel;
  node: Node;
  affected: number;
} | null;

type PendingMerge = { source: Node; targetId: string } | null;

export function CurriculumTree({ data }: { data: CurriculumData }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(data.subjects[0]?.id ?? "");
  const [themeId, setThemeId] = React.useState<string | null>(null);
  const [topicId, setTopicId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete>(null);
  const [pendingMerge, setPendingMerge] = React.useState<PendingMerge>(null);
  const [busy, setBusy] = React.useState(false);

  const themes = data.themes.filter((t) => t.subject_id === subjectId);
  const topics = data.topics.filter((t) =>
    themeId ? t.theme_id === themeId : t.subject_id === subjectId,
  );
  const subtopics = data.subtopics.filter((s) => s.topic_id === topicId);

  /** Live topics in the current subject that a merge could target. */
  const mergeTargets = data.topics.filter(
    (t) =>
      t.subject_id === subjectId &&
      t.id !== pendingMerge?.source.id &&
      t.status !== "archived",
  );

  async function add(
    level: CurriculumLevel,
    parent: Record<string, string>,
    name: string,
  ) {
    const res = await fetch(`/api/admin/curriculum/${level}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...parent, name, slug: slugify(name) }),
    });
    if (!res.ok) {
      toast.error(`Could not add the ${SINGULAR[level]}.`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function patch(
    level: CurriculumLevel,
    node: Node,
    body: Partial<Pick<Node, "name" | "slug" | "status">>,
    failure: string,
  ) {
    const res = await fetch(`/api/admin/curriculum/${level}/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(failure);
      return false;
    }
    router.refresh();
    return true;
  }

  const rename = (level: CurriculumLevel, node: Node, name: string) =>
    patch(level, node, { name }, `Could not rename the ${SINGULAR[level]}.`);

  async function setStatus(
    level: CurriculumLevel,
    node: Node,
    status: CurriculumStatus,
  ) {
    const verb = status === "archived" ? "archive" : "restore";
    const ok = await patch(
      level,
      node,
      { status },
      `Could not ${verb} the ${SINGULAR[level]}.`,
    );
    if (ok) toast.success(`${node.name} ${verb}d`);
  }

  async function askDelete(level: CurriculumLevel, node: Node) {
    const res = await fetch(`/api/admin/curriculum/${level}/${node.id}`);
    const affected = res.ok ? ((await res.json()).affected as number) : 0;
    setPendingDelete({ level, node, affected });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    const force = DESTRUCTIVE_LEVELS.includes(pendingDelete.level);
    const res = await fetch(
      `/api/admin/curriculum/${pendingDelete.level}/${pendingDelete.node.id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete.");
      return;
    }
    toast.success(`${pendingDelete.node.name} deleted`);
    setPendingDelete(null);
    router.refresh();
  }

  async function confirmMerge() {
    if (!pendingMerge?.targetId) return;
    setBusy(true);
    const res = await fetch("/api/admin/curriculum/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_id: pendingMerge.source.id,
        target_id: pendingMerge.targetId,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      toast.error(body?.error ?? "Could not merge.");
      return;
    }
    const { moved } = (await res.json()) as { moved: number };
    const target = mergeTargets.find((t) => t.id === pendingMerge.targetId);
    toast.success(
      `Moved ${moved} question${moved === 1 ? "" : "s"} into ${target?.name ?? "the target"}. ${pendingMerge.source.name} is archived.`,
    );
    setPendingMerge(null);
    if (topicId === pendingMerge.source.id) setTopicId(null);
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

  const destructive =
    pendingDelete && DESTRUCTIVE_LEVELS.includes(pendingDelete.level);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Curriculum management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag to reorder. Archived nodes stay in the database but disappear
          from the student-facing syllabus.
        </p>
      </div>

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
          onAdd={(name) => add("subjects", {}, name)}
          onRename={(n, name) => rename("subjects", n, name)}
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
            subjectId
              ? (name) => add("themes", { subject_id: subjectId }, name)
              : undefined
          }
          onRename={(n, name) => rename("themes", n, name)}
          onSetStatus={(n, s) => setStatus("themes", n, s)}
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
              ? (name) =>
                  add(
                    "topics",
                    {
                      subject_id: subjectId,
                      ...(themeId ? { theme_id: themeId } : {}),
                    },
                    name,
                  )
              : undefined
          }
          onRename={(n, name) => rename("topics", n, name)}
          onSetStatus={(n, s) => setStatus("topics", n, s)}
          onMerge={(n) => setPendingMerge({ source: n, targetId: "" })}
          onDelete={(n) => askDelete("topics", n)}
          onReorder={(ids) => reorder("topics", ids)}
        />
        <Column
          level="subtopics"
          nodes={subtopics}
          selected={null}
          onSelect={() => {}}
          onAdd={
            topicId
              ? (name) => add("subtopics", { topic_id: topicId }, name)
              : undefined
          }
          onRename={(n, name) => rename("subtopics", n, name)}
          onSetStatus={(n, s) => setStatus("subtopics", n, s)}
          onDelete={(n) => askDelete("subtopics", n)}
          onReorder={(ids) => reorder("subtopics", ids)}
        />
      </div>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.node.name}?</DialogTitle>
            <DialogDescription>
              {pendingDelete &&
                describeImpact(pendingDelete.level, pendingDelete.affected)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>
              {destructive && pendingDelete!.affected > 0
                ? `Delete anyway (${pendingDelete!.affected} questions)`
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingMerge)}
        onOpenChange={(o) => !o && setPendingMerge(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge {pendingMerge?.source.name} into…</DialogTitle>
            <DialogDescription>
              Every question and subtopic moves to the topic you pick, and{" "}
              {pendingMerge?.source.name} is archived. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          {mergeTargets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There is no other live topic in this subject to merge into.
            </p>
          ) : (
            <select
              aria-label="Target topic"
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
              value={pendingMerge?.targetId ?? ""}
              onChange={(e) =>
                setPendingMerge((m) => m && { ...m, targetId: e.target.value })
              }
            >
              <option value="" disabled>
                Choose a topic
              </option>
              {mergeTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingMerge(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmMerge}
              disabled={busy || !pendingMerge?.targetId}
            >
              Merge
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
  onRename,
  onSetStatus,
  onMerge,
  onDelete,
  onReorder,
}: {
  level: CurriculumLevel;
  nodes: Node[];
  selected: string | null;
  onSelect: (id: string) => void;
  onAdd?: (name: string) => Promise<boolean>;
  onRename: (node: Node, name: string) => Promise<boolean>;
  onSetStatus?: (node: Node, status: CurriculumStatus) => void;
  onMerge?: (node: Node) => void;
  onDelete: (node: Node) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [order, setOrder] = React.useState(nodes);
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const dragging = React.useRef<string | null>(null);

  React.useEffect(() => setOrder(nodes), [nodes]);

  function onDrop(targetId: string) {
    const from = order.findIndex((n) => n.id === dragging.current);
    const to = order.findIndex((n) => n.id === targetId);
    dragging.current = null;
    if (from < 0 || to < 0 || from === to) return;
    move(from, to);
  }

  /** Shared by drag-and-drop and the keyboard-reachable menu items. */
  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAdding(true)}
              aria-label={`Add ${SINGULAR[level]}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ul className="flex flex-col gap-1">
          {order.map((n) =>
            editingId === n.id ? (
              <li key={n.id} className="px-1 py-0.5">
                <NameInput
                  initial={n.name}
                  placeholder={`${SINGULAR[level]} name`}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (name) => {
                    if (name !== n.name) {
                      const ok = await onRename(n, name);
                      if (!ok) return;
                    }
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
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
                  n.status === "archived" && "opacity-60",
                )}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/60" />
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  onDoubleClick={() => setEditingId(n.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left",
                    n.status === "archived" && "line-through",
                  )}
                  title={
                    n.status === "archived"
                      ? "Archived — hidden from students"
                      : "Double-click to rename"
                  }
                >
                  {n.name}
                </button>
                {n.status === "draft" && (
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    draft
                  </span>
                )}
                {selected === n.id && <ChevronRight className="h-3.5 w-3.5" />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${n.name}`}
                      className="rounded p-0.5 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditingId(n.id)}>
                      <Pencil className="h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={order.indexOf(n) === 0}
                      onSelect={() => move(order.indexOf(n), order.indexOf(n) - 1)}
                    >
                      <ChevronUp className="h-3.5 w-3.5" /> Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={order.indexOf(n) === order.length - 1}
                      onSelect={() => move(order.indexOf(n), order.indexOf(n) + 1)}
                    >
                      <ChevronDown className="h-3.5 w-3.5" /> Move down
                    </DropdownMenuItem>
                    {onSetStatus &&
                      (n.status === "archived" ? (
                        <DropdownMenuItem
                          onSelect={() => onSetStatus(n, "published")}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => onSetStatus(n, "archived")}
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                      ))}
                    {onMerge && n.status !== "archived" && (
                      <DropdownMenuItem onSelect={() => onMerge(n)}>
                        <Merge className="h-3.5 w-3.5" /> Merge into…
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(n)}
                      className="text-accent"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ),
          )}
          {adding && onAdd && (
            <li className="px-1 py-0.5">
              <NameInput
                initial=""
                placeholder={`New ${SINGULAR[level]} name`}
                onCancel={() => setAdding(false)}
                onSubmit={async (name) => {
                  const ok = await onAdd(name);
                  if (ok) setAdding(false);
                }}
              />
            </li>
          )}
          {order.length === 0 && !adding && (
            <li className="px-2 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Single-line editor: Enter saves, Escape or blur cancels. */
function NameInput({
  initial,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  // Blur fires after Enter re-renders; this stops a save from being cancelled.
  const submitted = React.useRef(false);

  async function submit() {
    const name = value.trim();
    if (!name) {
      onCancel();
      return;
    }
    submitted.current = true;
    setSaving(true);
    await onSubmit(name);
    setSaving(false);
  }

  return (
    <Input
      autoFocus
      value={value}
      placeholder={placeholder}
      disabled={saving}
      className="h-8 text-sm"
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      onBlur={() => {
        if (!submitted.current) onCancel();
      }}
    />
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
