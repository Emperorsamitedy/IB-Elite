"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Check,
  Circle,
  Bookmark,
  Clock,
} from "lucide-react";

const STEPS = [
  "Choose subject",
  "Pick a topic",
  "Build session",
  "Practise",
  "Get guidance",
] as const;

export function ProductPreview() {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* glow */}
      <div className="absolute -inset-x-8 -top-8 -bottom-8 -z-10 rounded-[2rem] bg-accent/10 blur-3xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <div className="ml-3 flex-1">
            <div className="mx-auto h-6 w-full max-w-[16rem] rounded-md bg-surface-2" />
          </div>
        </div>

        {/* progress rail */}
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                className={`flex h-5 items-center gap-1.5 rounded-full px-2 text-[0.65rem] font-medium transition-colors ${
                  i === step
                    ? "bg-accent-soft text-accent"
                    : i < step
                      ? "text-success"
                      : "text-muted-foreground"
                }`}
              >
                {i < step ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" />
                )}
                <span className="hidden sm:inline">{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-border" />
              )}
            </div>
          ))}
        </div>

        <div className="relative h-[280px] p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-5"
            >
              {step === 0 && <SubjectStep />}
              {step === 1 && <TopicStep />}
              {step === 2 && <SessionStep />}
              {step === 3 && <QuestionStep />}
              {step === 4 && <TutorStep />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  active,
  meta,
}: {
  label: string;
  active?: boolean;
  meta?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3.5 py-3 text-sm ${
        active
          ? "border-accent/40 bg-accent-soft/60 text-foreground"
          : "border-border bg-surface"
      }`}
    >
      <span className="font-medium">{label}</span>
      {meta ? (
        <span className="text-xs text-muted-foreground">{meta}</span>
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function SubjectStep() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        What are you revising?
      </p>
      <Row label="Mathematics AA HL" active />
      <Row label="Physics HL" />
      <Row label="Chemistry SL" />
    </div>
  );
}

function TopicStep() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        Mathematics AA HL · topics
      </p>
      <Row label="Calculus" meta="42 questions" active />
      <Row label="Vectors" meta="28 questions" />
      <Row label="Probability" meta="35 questions" />
    </div>
  );
}

function SessionStep() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        Build your session
      </p>
      <div className="flex gap-2">
        {["Easy", "Medium", "Hard", "Mixed"].map((d, i) => (
          <span
            key={d}
            className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-medium ${
              i === 1
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border text-muted-foreground"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {[5, 10, 15, 20].map((n) => (
          <span
            key={n}
            className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs font-medium ${
              n === 15
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border text-muted-foreground"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground">
        Start practice <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

function QuestionStep() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Question 3 of 15
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> 12:04
        </span>
      </div>
      <div className="flex-1 rounded-lg border border-border bg-surface p-4">
        <p className="text-sm leading-relaxed">
          Find the equation of the tangent to{" "}
          <span className="font-mono text-accent">y = x²</span> at the point{" "}
          <span className="font-mono text-accent">(3, 9)</span>.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs">
          <Bookmark className="h-3.5 w-3.5" /> Bookmark
        </span>
        <span className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium text-accent">
          <Sparkles className="h-3.5 w-3.5" /> Ask AI tutor
        </span>
      </div>
    </div>
  );
}

function TutorStep() {
  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs font-medium text-accent">
        <Sparkles className="h-3.5 w-3.5" /> AI tutor
      </div>
      <div className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-xs text-accent-foreground">
        I&apos;m stuck on the tangent question.
      </div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-foreground">
        Let&apos;s start with a hint — what does the{" "}
        <span className="font-medium">derivative</span> tell you about the
        gradient at a point? Try differentiating y = x² first.
      </div>
      <div className="mt-auto flex gap-1.5">
        {["Hint", "Explain concept", "Next step"].map((c) => (
          <span
            key={c}
            className="rounded-full border border-border px-2.5 py-1 text-[0.65rem] font-medium text-muted-foreground"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
