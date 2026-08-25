"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MathText } from "@/components/ui/math-text";
import { MathField } from "@/components/admin/math-field";
import { COMMAND_TERMS } from "@/lib/admin/questions";
import { looksLikeUnmarkedMath } from "@/lib/math";
import { cn } from "@/lib/utils";
import type { ContentStatus, Difficulty } from "@/lib/types";
import { BulkImportDialog } from "./bulk-import-dialog";

export type BankTopic = {
  id: string;
  name: string;
  subject_id: string;
  subtopics: { id: string; name: string }[];
};
export type BankSubject = { id: string; name: string };
export type BankQuestion = {
  id: string;
  title: string | null;
  prompt: string;
  answer: string | null;
  solution: string | null;
  subject_id: string;
  topic_id: string;
  subtopic_id: string | null;
  command_term: string | null;
  difficulty: Difficulty;
  marks: number;
  question_type: string;
  status: ContentStatus;
  /** Present on the list view only; the quick editor never writes it. */
  answer_type?: string;
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const STATUSES: ContentStatus[] = ["published", "draft", "archived"];

const STATUS_VARIANT: Record<ContentStatus, "success" | "warning" | "outline"> =
  {
    published: "success",
    draft: "warning",
    archived: "outline",
  };

type Draft = Omit<BankQuestion, "id"> & { id?: string };

const EMPTY: Omit<Draft, "subject_id" | "topic_id"> = {
  title: "",
  prompt: "",
  answer: "",
  solution: "",
  subtopic_id: null,
  command_term: null,
  difficulty: "medium",
  marks: 1,
  question_type: "short-answer",
  status: "draft",
};

export function QuestionBank({
  subjects,
  topics,
  questions,
}: {
  subjects: BankSubject[];
  topics: BankTopic[];
  questions: BankQuestion[];
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [subjectFilter, setSubjectFilter] = React.useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] =
    React.useState<Difficulty | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<ContentStatus | null>(
    null,
  );
  const [termFilter, setTermFilter] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [deleting, setDeleting] = React.useState<BankQuestion | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const topicName = React.useCallback(
    (id: string) => topics.find((t) => t.id === id)?.name ?? "—",
    [topics],
  );
  const subjectName = React.useCallback(
    (id: string) => subjects.find((s) => s.id === id)?.name ?? "—",
    [subjects],
  );

  const rows = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return questions.filter(
      (q) =>
        (!subjectFilter || q.subject_id === subjectFilter) &&
        (!difficultyFilter || q.difficulty === difficultyFilter) &&
        (!statusFilter || q.status === statusFilter) &&
        (!termFilter || q.command_term === termFilter) &&
        (!needle ||
          (q.title ?? "").toLowerCase().includes(needle) ||
          q.prompt.toLowerCase().includes(needle)),
    );
  }, [
    questions,
    search,
    subjectFilter,
    difficultyFilter,
    statusFilter,
    termFilter,
  ]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const { id, ...body } = draft;
    const res = await fetch(
      id ? `/api/admin/questions/${id}` : "/api/admin/questions",
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save the question.");
      return;
    }
    toast.success(id ? "Question updated" : "Question created");
    setDraft(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await fetch(`/api/admin/questions/${deleting.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not archive the question.");
      return;
    }
    toast.success("Question archived");
    setDeleting(null);
    router.refresh();
  }

  const draftTopics = draft
    ? topics.filter((t) => t.subject_id === draft.subject_id)
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Question bank</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Bulk import
          </Button>
          <Button
            onClick={() =>
              setDraft({
                ...EMPTY,
                subject_id: subjects[0]?.id ?? "",
                topic_id:
                  topics.find((t) => t.subject_id === subjects[0]?.id)?.id ?? "",
              })
            }
          >
            <Plus className="h-4 w-4" /> New question
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterGroup
              values={subjects.map((s) => [s.id, s.name] as const)}
              active={subjectFilter}
              onSelect={setSubjectFilter}
            />
            <FilterGroup
              values={COMMAND_TERMS.map((t) => [t, t] as const)}
              active={termFilter}
              onSelect={setTermFilter}
            />
            <FilterGroup
              values={DIFFICULTIES.map((d) => [d, d] as const)}
              active={difficultyFilter}
              onSelect={(v) => setDifficultyFilter(v as Difficulty | null)}
            />
            <FilterGroup
              values={STATUSES.map((s) => [s, s] as const)}
              active={statusFilter}
              onSelect={(v) => setStatusFilter(v as ContentStatus | null)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5">Question</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Subject</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Topic</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Command term</th>
                <th className="px-4 py-2.5">Difficulty</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setDraft({ ...q })}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="max-w-xs px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <MathText as="span" className="line-clamp-1">
                        {q.title || q.prompt}
                      </MathText>
                      {looksLikeUnmarkedMath(q.prompt) && (
                        <Badge
                          variant="warning"
                          className="shrink-0"
                          title="Maths here is plain text, not LaTeX"
                        >
                          Plain maths
                        </Badge>
                      )}
                      {q.answer_type && q.answer_type !== "free" && (
                        <Badge
                          variant="success"
                          className="shrink-0"
                          title="Has a structured answer key — eligible for Ranked Duels"
                        >
                          Duel-ready
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {subjectName(q.subject_id)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                    {topicName(q.topic_id)}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                    {q.command_term ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-muted-foreground">
                    {q.difficulty}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={STATUS_VARIANT[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Delete question"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleting(q);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No questions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent className="max-w-xl overflow-y-auto p-6">
          {draft && (
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">
                {draft.id ? "Edit question" : "New question"}
              </h2>

              <Field label="Subject">
                <select
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  value={draft.subject_id}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      subject_id: e.target.value,
                      topic_id:
                        topics.find((t) => t.subject_id === e.target.value)
                          ?.id ?? "",
                      subtopic_id: null,
                    })
                  }
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Topic">
                <select
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  value={draft.topic_id}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      topic_id: e.target.value,
                      subtopic_id: null,
                    })
                  }
                >
                  {draftTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Subtopic">
                <select
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                  value={draft.subtopic_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, subtopic_id: e.target.value || null })
                  }
                >
                  <option value="">None</option>
                  {(
                    draftTopics.find((t) => t.id === draft.topic_id)?.subtopics ??
                    []
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Title">
                <Input
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>

              <MathField
                label="Prompt"
                rows={4}
                value={draft.prompt}
                onChange={(v) => setDraft({ ...draft, prompt: v })}
              />

              <MathField
                label="Answer"
                rows={3}
                value={draft.answer ?? ""}
                onChange={(v) => setDraft({ ...draft, answer: v })}
              />

              <MathField
                label="Solution"
                rows={3}
                value={draft.solution ?? ""}
                onChange={(v) => setDraft({ ...draft, solution: v })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Command term">
                  <select
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm"
                    value={draft.command_term ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        command_term: e.target.value || null,
                      })
                    }
                  >
                    <option value="">None</option>
                    {COMMAND_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Difficulty">
                  <select
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm capitalize"
                    value={draft.difficulty}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        difficulty: e.target.value as Difficulty,
                      })
                    }
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Marks">
                  <Input
                    type="number"
                    min={0}
                    value={draft.marks}
                    onChange={(e) =>
                      setDraft({ ...draft, marks: Number(e.target.value) })
                    }
                  />
                </Field>

                <Field label="Status">
                  <select
                    className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm capitalize"
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        status: e.target.value as ContentStatus,
                      })
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save question"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this question?</DialogTitle>
            <DialogDescription>
              {deleting?.title || deleting?.prompt} will be archived and hidden
              from students. Existing attempt history is kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => router.refresh()}
      />
    </div>
  );
}

function FilterGroup({
  values,
  active,
  onSelect,
}: {
  values: readonly (readonly [string, string])[];
  active: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <>
      {values.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={active === value}
          onClick={() => onSelect(active === value ? null : value)}
        >
          <Badge
            variant={active === value ? "accent" : "outline"}
            className={cn(
              "cursor-pointer capitalize",
              active !== value && "hover:border-foreground",
            )}
          >
            {label}
          </Badge>
        </button>
      ))}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
