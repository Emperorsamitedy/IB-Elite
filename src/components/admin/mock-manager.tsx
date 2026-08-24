"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, FlaskConical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import {
  calibrateMockPaper,
  delayMockPaper,
  saveMockPaper,
  scheduleMockSittings,
  setMockPaperStatus,
  type MockPaperFormValues,
} from "@/lib/actions/mock-admin";
import {
  BAND_LABELS,
  type Criterion,
  type GradeOutcome,
  type MockBand,
} from "@/lib/mock/types";

export type AdminMockPaper = {
  id: string;
  subject_id: string;
  level_code: "SL" | "HL";
  title: string;
  body: string;
  duration_minutes: number;
  markscheme: Criterion[];
  status: string;
  sittings: {
    band: MockBand;
    opens_at: string;
    closes_at: string;
    results_at: string;
    status: string;
  }[];
  entries: number;
};

export type SubjectOption = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

const BANDS: MockBand[] = ["americas", "emea", "apac"];

export function MockManager({
  papers,
  subjects,
}: {
  papers: AdminMockPaper[];
  subjects: SubjectOption[];
}) {
  const [editing, setEditing] = React.useState<AdminMockPaper | "new" | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">World Mock</h1>
        {editing === null && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 size-4" /> New paper
          </Button>
        )}
      </div>

      {editing !== null ? (
        <PaperEditor
          paper={editing === "new" ? null : editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {papers.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No papers yet. Author one, add its markscheme, schedule the
                three bands, then set it live.
              </CardContent>
            </Card>
          )}
          {papers.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper}
              onEdit={() => setEditing(paper)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PaperRow({
  paper,
  onEdit,
}: {
  paper: AdminMockPaper;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const act = async (fn: () => Promise<{ error?: string } | undefined>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={onEdit}
              className="font-bold tracking-tight hover:text-accent"
            >
              {paper.title}
            </button>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {paper.level_code} · {paper.duration_minutes} min ·{" "}
              {paper.markscheme.length} criteria · {paper.entries} entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                paper.status === "scheduled"
                  ? "success"
                  : paper.status === "cancelled"
                    ? "danger"
                    : "outline"
              }
            >
              {paper.status}
            </Badge>
            {paper.status !== "scheduled" && paper.status !== "cancelled" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void act(() => setMockPaperStatus(paper.id, "scheduled"))
                }
              >
                Set live
              </Button>
            )}
            {paper.status === "scheduled" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void act(() => delayMockPaper(paper.id, 24))}
                >
                  <AlertTriangle className="mr-1.5 size-3.5" /> Delay 24h
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    void act(() => setMockPaperStatus(paper.id, "cancelled"))
                  }
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
        {paper.sittings.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {paper.sittings.map((s) => (
              <span
                key={s.band}
                className="rounded-md border border-border px-2 py-1 font-mono"
              >
                {BAND_LABELS[s.band]}:{" "}
                {new Date(s.opens_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PaperEditor({
  paper,
  subjects,
  onClose,
}: {
  paper: AdminMockPaper | null;
  subjects: SubjectOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(
    paper?.subject_id ?? subjects[0]?.id ?? "",
  );
  const [levelCode, setLevelCode] = React.useState<"SL" | "HL">(
    paper?.level_code ?? "SL",
  );
  const [title, setTitle] = React.useState(paper?.title ?? "");
  const [body, setBody] = React.useState(paper?.body ?? "");
  const [duration, setDuration] = React.useState(paper?.duration_minutes ?? 90);
  const [criteria, setCriteria] = React.useState<Criterion[]>(
    paper?.markscheme ?? [],
  );
  const [sittings, setSittings] = React.useState(() =>
    BANDS.map((band) => {
      const existing = paper?.sittings.find((s) => s.band === band);
      return {
        band,
        opensAt: existing ? toLocal(existing.opens_at) : "",
        closesAt: existing ? toLocal(existing.closes_at) : "",
        resultsAt: existing ? toLocal(existing.results_at) : "",
      };
    }),
  );
  const [sample, setSample] = React.useState("");
  const [calibration, setCalibration] = React.useState<GradeOutcome | null>(
    null,
  );
  const [pending, start] = React.useTransition();

  const subject = subjects.find((s) => s.id === subjectId);

  const save = () =>
    start(async () => {
      const values: MockPaperFormValues = {
        subjectId,
        levelCode,
        title,
        body,
        durationMinutes: duration,
        markscheme: criteria,
      };
      const res = await saveMockPaper(paper?.id ?? null, values);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const filled = sittings.filter(
        (s) => s.opensAt && s.closesAt && s.resultsAt,
      );
      if (filled.length > 0 && res.id) {
        const scheduled = await scheduleMockSittings(
          res.id,
          filled.map((s) => ({
            band: s.band,
            opensAt: new Date(s.opensAt).toISOString(),
            closesAt: new Date(s.closesAt).toISOString(),
            resultsAt: new Date(s.resultsAt).toISOString(),
          })),
        );
        if (scheduled.error) {
          toast.error(scheduled.error);
          return;
        }
      }
      toast.success("Paper saved");
      onClose();
      router.refresh();
    });

  const calibrate = () =>
    start(async () => {
      if (!paper) {
        toast.error("Save the paper first, then calibrate.");
        return;
      }
      const res = await calibrateMockPaper(paper.id, sample);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setCalibration(res.outcome ?? null);
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={levelCode}
              onChange={(e) => setLevelCode(e.target.value as "SL" | "HL")}
            >
              <option value="SL">SL</option>
              <option value="HL">HL</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={10}
              max={300}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 90)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Paper body (markdown + $LaTeX$)</Label>
            <textarea
              className="min-h-48 rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Markscheme criteria</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setCriteria((prev) => [
                  ...prev,
                  {
                    id: `c${prev.length + 1}`,
                    title: "",
                    description: "",
                    maxMarks: 4,
                    topicId: null,
                  },
                ])
              }
            >
              <Plus className="mr-1.5 size-3.5" /> Criterion
            </Button>
          </div>
          {criteria.map((criterion, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_2fr_6rem_1fr_auto]"
            >
              <Input
                placeholder="Title"
                value={criterion.title}
                onChange={(e) =>
                  updateAt(setCriteria, i, { title: e.target.value })
                }
              />
              <Input
                placeholder="What earns the marks"
                value={criterion.description}
                onChange={(e) =>
                  updateAt(setCriteria, i, { description: e.target.value })
                }
              />
              <Input
                type="number"
                min={1}
                max={50}
                value={criterion.maxMarks}
                onChange={(e) =>
                  updateAt(setCriteria, i, {
                    maxMarks: Number(e.target.value) || 1,
                  })
                }
              />
              <select
                className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
                value={criterion.topicId ?? ""}
                onChange={(e) =>
                  updateAt(setCriteria, i, { topicId: e.target.value || null })
                }
              >
                <option value="">No practice topic</option>
                {subject?.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCriteria((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4" /> Sittings (times in your local
            timezone)
          </h2>
          {sittings.map((sitting, i) => (
            <div
              key={sitting.band}
              className="grid gap-2 sm:grid-cols-[8rem_1fr_1fr_1fr]"
            >
              <span className="self-center font-mono text-xs uppercase text-muted-foreground">
                {BAND_LABELS[sitting.band]}
              </span>
              <Input
                type="datetime-local"
                value={sitting.opensAt}
                onChange={(e) =>
                  updateAt(setSittings, i, { opensAt: e.target.value })
                }
              />
              <Input
                type="datetime-local"
                value={sitting.closesAt}
                onChange={(e) =>
                  updateAt(setSittings, i, { closesAt: e.target.value })
                }
              />
              <Input
                type="datetime-local"
                value={sitting.resultsAt}
                onChange={(e) =>
                  updateAt(setSittings, i, { resultsAt: e.target.value })
                }
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Columns: opens · closes · results day. Leave a band empty to skip
            it.
          </p>
        </CardContent>
      </Card>

      {paper && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="size-4" /> Calibration
            </h2>
            <textarea
              className="min-h-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Paste a sample student transcript and see how the grader marks it…"
              value={sample}
              onChange={(e) => setSample(e.target.value)}
            />
            <Button
              variant="secondary"
              className="self-start"
              onClick={calibrate}
              disabled={pending}
            >
              {pending ? <Spinner /> : "Run calibration"}
            </Button>
            {calibration && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold">
                  {calibration.totalAwarded}/{calibration.totalMax}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({calibration.grader})
                  </span>
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {calibration.criteria.map((c) => (
                    <li key={c.criterionId} className="text-muted-foreground">
                      {c.title}: {c.awarded}/{c.maxMarks}
                      {c.comment ? ` — ${c.comment}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Back
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? <Spinner /> : "Save paper"}
        </Button>
      </div>
    </div>
  );
}

function updateAt<T>(
  set: React.Dispatch<React.SetStateAction<T[]>>,
  index: number,
  patch: Partial<T>,
) {
  set((prev) =>
    prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
  );
}

function toLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
