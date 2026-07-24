"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ArrowRight, ArrowLeft, Sparkles, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/logo";
import { Spinner } from "@/components/ui/misc";
import { GOALS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { completeOnboarding, skipOnboarding } from "@/lib/actions/onboarding";
import { toast } from "sonner";

type Level = { id: string; code: string; name: string };
type SubjectOption = {
  id: string;
  slug: string;
  name: string;
  group_name: string;
  color: string;
  levels: Level[];
};

const STEP_COUNT = 4;

export function OnboardingFlow({
  firstName,
  subjects,
}: {
  firstName: string | null;
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  // step 1: subject + level selection
  const [selected, setSelected] = React.useState<
    Record<string, string | null>
  >({});
  // step 2: exams
  const [exams, setExams] = React.useState<
    { subjectId: string; levelId: string | null; date: string }[]
  >([]);
  // step 3: goals
  const [goals, setGoals] = React.useState<string[]>([]);

  const selectedSubjects = subjects.filter((s) => s.id in selected);

  const toggleSubject = (s: SubjectOption) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (s.id in next) delete next[s.id];
      else next[s.id] = s.levels[0]?.id ?? null;
      return next;
    });
  };

  const finish = async () => {
    setSaving(true);
    try {
      await completeOnboarding({
        subjects: Object.entries(selected).map(([subjectId, levelId]) => ({
          subjectId,
          levelId,
        })),
        exams,
        goals,
      });
      toast.success("Your revision space is ready.");
      router.push("/app");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const skip = async () => {
    setSaving(true);
    await skipOnboarding();
    router.push("/app");
  };

  const canContinue = step === 0 ? selectedSubjects.length > 0 : true;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-6">
        <Logo />
        <button
          onClick={skip}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6">
        {/* progress */}
        <div className="mb-8 flex gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-accent" : "bg-surface-2",
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            {step === 0 && (
              <StepShell
                title="What subjects are you studying?"
                subtitle="Pick everything you're revising. You can change this later."
              >
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {subjects.map((s) => {
                    const isSel = s.id in selected;
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSubject(s)}
                        className={cn(
                          "group relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
                          isSel
                            ? "border-accent bg-accent-soft/60 shadow-sm"
                            : "border-border hover:border-border hover:bg-surface-2",
                        )}
                      >
                        <span className="flex w-full items-center justify-between">
                          <span className="text-sm font-medium">{s.name}</span>
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                              isSel
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border",
                            )}
                          >
                            {isSel && <Check className="h-3 w-3" />}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.group_name}
                        </span>
                        {isSel && s.levels.length > 1 && (
                          <div
                            className="mt-2 flex gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {s.levels.map((l) => (
                              <span
                                key={l.id}
                                role="button"
                                onClick={() =>
                                  setSelected((prev) => ({
                                    ...prev,
                                    [s.id]: l.id,
                                  }))
                                }
                                className={cn(
                                  "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                                  selected[s.id] === l.id
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-surface-2 text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {l.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell
                title="Do you have upcoming exams?"
                subtitle="Add exam dates to unlock countdowns and smarter planning. Optional."
              >
                <ExamStep
                  subjects={selectedSubjects}
                  selected={selected}
                  exams={exams}
                  setExams={setExams}
                />
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                title="What do you want help with?"
                subtitle="We'll tailor your dashboard and recommendations."
              >
                <div className="flex flex-col gap-2.5">
                  {GOALS.map((g) => {
                    const isSel = goals.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() =>
                          setGoals((prev) =>
                            isSel
                              ? prev.filter((x) => x !== g.id)
                              : [...prev, g.id],
                          )
                        }
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all",
                          isSel
                            ? "border-accent bg-accent-soft/60"
                            : "border-border hover:bg-surface-2",
                        )}
                      >
                        {g.label}
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border",
                            isSel
                              ? "border-accent bg-accent text-accent-foreground"
                              : "border-border",
                          )}
                        >
                          {isSel && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                  Your revision space is ready
                  {firstName ? `, ${firstName}` : ""}.
                </h1>
                <p className="mt-2 max-w-sm text-muted-foreground">
                  {selectedSubjects.length} subject
                  {selectedSubjects.length === 1 ? "" : "s"} added
                  {exams.length > 0
                    ? ` · ${exams.length} exam date${exams.length === 1 ? "" : "s"}`
                    : ""}
                  . Let&apos;s get practising.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-background py-6">
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}

          {step < STEP_COUNT - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={saving} size="lg">
              {saving ? <Spinner /> : "Go to dashboard"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ExamStep({
  subjects,
  selected,
  exams,
  setExams,
}: {
  subjects: SubjectOption[];
  selected: Record<string, string | null>;
  exams: { subjectId: string; levelId: string | null; date: string }[];
  setExams: React.Dispatch<
    React.SetStateAction<
      { subjectId: string; levelId: string | null; date: string }[]
    >
  >;
}) {
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [date, setDate] = React.useState("");

  const add = () => {
    if (!subjectId || !date) return;
    setExams((prev) => [
      ...prev,
      { subjectId, levelId: selected[subjectId] ?? null, date },
    ]);
    setDate("");
  };

  if (subjects.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select some subjects first to add exam dates.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="sm:w-44"
        />
        <Button variant="secondary" onClick={add} disabled={!date}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {exams.map((e, i) => {
          const s = subjects.find((x) => x.id === e.subjectId);
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm"
            >
              <span className="font-medium">{s?.name}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {new Date(e.date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                <button
                  onClick={() =>
                    setExams((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="text-muted-foreground hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
