"use client";

import * as React from "react";
import { MathText } from "@/components/ui/math-text";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandStamp, commandTermFor } from "@/components/ui/stamp";
import type { TopicDetail, TopicQuestion } from "@/lib/syllabus";

type Sort = "newest" | "oldest" | "attempted" | "bookmarked";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "attempted", label: "Most attempted" },
  { value: "bookmarked", label: "Most bookmarked" },
];

/** Topic-scoped question list: searches and filters only within this topic. */
export function TopicQuestionBrowser({
  detail,
  topicName,
}: {
  detail: TopicDetail;
  topicName: string;
}) {
  const { questions, subtopics, facets } = detail;

  const [query, setQuery] = React.useState("");
  const [subtopic, setSubtopic] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("");
  const [paper, setPaper] = React.useState("");
  const [calculator, setCalculator] = React.useState("");
  const [marks, setMarks] = React.useState("");
  const [year, setYear] = React.useState("");
  const [type, setType] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("newest");

  const marksBands = [
    { value: "1-3", label: "1–3 marks" },
    { value: "4-6", label: "4–6 marks" },
    { value: "7+", label: "7+ marks" },
  ];

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = questions.filter((q) => {
      if (needle && !`${q.title ?? ""} ${q.prompt}`.toLowerCase().includes(needle))
        return false;
      if (subtopic && q.subtopicId !== subtopic) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (paper && q.paper !== paper) return false;
      if (calculator && String(q.calculator ?? "") !== calculator) return false;
      if (year && String(q.year ?? "") !== year) return false;
      if (type && q.questionType !== type) return false;
      if (marks === "1-3" && q.marks > 3) return false;
      if (marks === "4-6" && (q.marks < 4 || q.marks > 6)) return false;
      if (marks === "7+" && q.marks < 7) return false;
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "attempted") return b.attemptCount - a.attemptCount;
      if (sort === "bookmarked") return b.bookmarkCount - a.bookmarkCount;
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return sorted;
  }, [questions, query, subtopic, difficulty, paper, calculator, marks, year, type, sort]);

  const active =
    Boolean(query || subtopic || difficulty || paper || calculator || marks || year || type) ||
    sort !== "newest";

  const clear = () => {
    setQuery("");
    setSubtopic("");
    setDifficulty("");
    setPaper("");
    setCalculator("");
    setMarks("");
    setYear("");
    setType("");
    setSort("newest");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-md border border-input bg-surface px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search questions in ${topicName}…`}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {subtopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!subtopic} onClick={() => setSubtopic("")}>
            All subtopics
          </Chip>
          {subtopics.map((s) => (
            <Chip
              key={s.id}
              active={subtopic === s.id}
              onClick={() => setSubtopic(subtopic === s.id ? "" : s.id)}
            >
              {s.name} · {s.questionCount}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={DIFFICULTIES.map((d) => ({
            value: d,
            label: d[0].toUpperCase() + d.slice(1),
          }))}
        />
        {facets.papers.length > 0 && (
          <Select
            label="Paper"
            value={paper}
            onChange={setPaper}
            options={facets.papers.map((p) => ({ value: p, label: p }))}
          />
        )}
        <Select
          label="Calculator"
          value={calculator}
          onChange={setCalculator}
          options={[
            { value: "true", label: "Calculator" },
            { value: "false", label: "Non-calculator" },
          ]}
        />
        <Select label="Marks" value={marks} onChange={setMarks} options={marksBands} />
        {facets.years.length > 0 && (
          <Select
            label="Year"
            value={year}
            onChange={setYear}
            options={facets.years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
        {facets.types.length > 0 && (
          <Select
            label="Type"
            value={type}
            onChange={setType}
            options={facets.types.map((t) => ({ value: t, label: t }))}
          />
        )}
        <Select
          label="Sort"
          value={sort}
          onChange={(v) => setSort((v || "newest") as Sort)}
          options={SORTS}
        />
        {active && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 border border-border px-3 py-2 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {filtered.length} of {questions.length} questions
      </p>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No questions in this topic match those filters yet.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {filtered.map((q) => (
            <li key={q.id}>
              <QuestionRow question={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionRow({ question: q }: { question: TopicQuestion }) {
  const term = commandTermFor(q.prompt);
  return (
    <Link
      href={`/questions/${q.id}`}
      className="flex gap-4 py-4 pr-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="w-14 shrink-0 border-r border-border pr-3 text-right font-mono text-xs text-muted-foreground">
        [{q.marks}]
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {term && <CommandStamp term={term} />}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {[
              q.subtopicName,
              q.paper,
              q.year ? String(q.year) : null,
              q.calculator === false ? "No calc" : null,
              q.difficulty,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <MathText
          as="span"
          className="mt-1.5 block line-clamp-2 font-serif text-[15px] leading-snug"
        >
          {q.title || q.prompt}
        </MathText>
      </span>
      <span className="hidden w-24 shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:block">
        {q.attempted ? (q.correct ? "Correct" : "Missed") : `~${q.estimatedMinutes} min`}
      </span>
    </Link>
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
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 border px-2.5 font-mono text-xs uppercase tracking-[0.06em] outline-none transition-colors focus:border-accent focus-visible:ring-2 focus-visible:ring-ring",
        value
          ? "border-accent bg-accent-soft text-accent"
          : "border-input bg-surface text-foreground",
      )}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-surface text-foreground">
          {o.label}
        </option>
      ))}
    </select>
  );
}
