"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/misc";
import {
  createQuestion,
  updateQuestion,
  type QuestionFormValues,
} from "@/lib/actions/admin";
import type { Difficulty, ContentStatus } from "@/lib/types";

type Level = { id: string; code: string; name: string };
type Topic = { id: string; name: string };
export type AdminSubject = {
  id: string;
  name: string;
  levels: Level[];
  topics: Topic[];
};

export function QuestionForm({
  subjects,
  questionId,
  initial,
}: {
  subjects: AdminSubject[];
  questionId?: string;
  initial?: Partial<QuestionFormValues>;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  const [subjectId, setSubjectId] = React.useState(
    initial?.subjectId ?? subjects[0]?.id ?? "",
  );
  const [topicId, setTopicId] = React.useState(initial?.topicId ?? "");
  const [levelId, setLevelId] = React.useState<string | null>(
    initial?.levelId ?? null,
  );
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [prompt, setPrompt] = React.useState(initial?.prompt ?? "");
  const [answer, setAnswer] = React.useState(initial?.answer ?? "");
  const [solution, setSolution] = React.useState(initial?.solution ?? "");
  const [difficulty, setDifficulty] = React.useState<Difficulty>(
    initial?.difficulty ?? "medium",
  );
  const [marks, setMarks] = React.useState(initial?.marks ?? 1);
  const [questionType, setQuestionType] = React.useState(
    initial?.questionType ?? "short-answer",
  );
  const [calculator, setCalculator] = React.useState<boolean | null>(
    initial?.calculator ?? null,
  );
  const [year, setYear] = React.useState<number | null>(initial?.year ?? null);
  const [paper, setPaper] = React.useState(initial?.paper ?? "");
  const [source, setSource] = React.useState(initial?.source ?? "");
  const [license, setLicense] = React.useState(initial?.license ?? "");
  const [status, setStatus] = React.useState<ContentStatus>(
    initial?.status ?? "draft",
  );

  const subject = subjects.find((s) => s.id === subjectId);

  React.useEffect(() => {
    if (subject && !subject.topics.some((t) => t.id === topicId)) {
      setTopicId(subject.topics[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  const submit = () => {
    if (!subjectId || !topicId || prompt.trim().length < 3) {
      toast.error("Subject, topic and a prompt are required.");
      return;
    }
    const values: QuestionFormValues = {
      subjectId,
      topicId,
      levelId,
      title: title || null,
      prompt,
      answer: answer || null,
      solution: solution || null,
      difficulty,
      marks,
      questionType,
      calculator,
      year,
      paper: paper || null,
      source: source || null,
      license: license || null,
      status,
    };
    start(async () => {
      const res = questionId
        ? await updateQuestion(questionId, values)
        : await createQuestion(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(questionId ? "Question updated" : "Question created");
      router.push("/admin/questions");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onChange={setSubjectId}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Topic</Label>
            <Select value={topicId} onChange={setTopicId}>
              <option value="">Select topic…</option>
              {subject?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <Select
              value={levelId ?? ""}
              onChange={(v) => setLevelId(v || null)}
            >
              <option value="">None</option>
              {subject?.levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as ContentStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1.5">
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="The question text…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Answer (optional)</Label>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Worked solution (optional)</Label>
            <Textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Difficulty</Label>
            <Select
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Marks</Label>
            <Input
              type="number"
              min={0}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Question type</Label>
            <Input
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Year</Label>
            <Input
              type="number"
              value={year ?? ""}
              onChange={(e) =>
                setYear(e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Paper</Label>
            <Input value={paper} onChange={(e) => setPaper(e.target.value)} />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm">Calculator allowed</span>
            <Switch
              checked={calculator === true}
              onCheckedChange={(v) => setCalculator(v)}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>License</Label>
            <Input
              value={license}
              onChange={(e) => setLicense(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Spinner /> : questionId ? "Save changes" : "Create question"}
        </Button>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-accent"
    >
      {children}
    </select>
  );
}
