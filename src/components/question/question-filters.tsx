"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Topic = { id: string; name: string };
type SubjectOption = { id: string; name: string; topics: Topic[] };

const DIFFICULTIES = ["easy", "medium", "hard"];

export function QuestionFilters({
  subjects,
  years,
  papers,
}: {
  subjects: SubjectOption[];
  years: number[];
  papers: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [q, setQ] = React.useState(params.get("q") ?? "");

  const update = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      if (key === "subject") next.delete("topic");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q || null);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const subjectId = params.get("subject");
  const subject = subjects.find((s) => s.id === subjectId);
  const hasFilters = ["subject", "topic", "difficulty", "year", "paper", "q"].some(
    (k) => params.get(k),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-input bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search questions…"
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          label="Subject"
          value={subjectId ?? ""}
          onChange={(v) => update("subject", v || null)}
          options={subjects.map((s) => ({ value: s.id, label: s.name }))}
        />
        {subject && (
          <Select
            label="Topic"
            value={params.get("topic") ?? ""}
            onChange={(v) => update("topic", v || null)}
            options={subject.topics.map((t) => ({
              value: t.id,
              label: t.name,
            }))}
          />
        )}
        <Select
          label="Difficulty"
          value={params.get("difficulty") ?? ""}
          onChange={(v) => update("difficulty", v || null)}
          options={DIFFICULTIES.map((d) => ({
            value: d,
            label: d[0].toUpperCase() + d.slice(1),
          }))}
        />
        {years.length > 0 && (
          <Select
            label="Year"
            value={params.get("year") ?? ""}
            onChange={(v) => update("year", v || null)}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        )}
        {papers.length > 0 && (
          <Select
            label="Paper"
            value={params.get("paper") ?? ""}
            onChange={(v) => update("paper", v || null)}
            options={papers.map((p) => ({ value: p, label: p }))}
          />
        )}
        {hasFilters && (
          <button
            onClick={() => router.push(pathname)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
    </div>
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 rounded-lg border px-3 text-sm outline-none transition-colors focus:border-accent",
        value
          ? "border-accent bg-accent-soft text-accent"
          : "border-input bg-background text-foreground",
      )}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-background text-foreground">
          {o.label}
        </option>
      ))}
    </select>
  );
}
