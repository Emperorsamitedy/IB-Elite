"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  Library,
  FolderOpen,
  FileQuestion,
  Home,
  Dumbbell,
  Bookmark,
  AlertCircle,
  Sparkles,
  CalendarRange,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Results = {
  subjects: { id: string; slug: string; name: string; group_name: string }[];
  topics: {
    id: string;
    slug: string;
    name: string;
    subjects: { slug: string; name: string } | null;
  }[];
  questions: {
    id: string;
    title: string | null;
    prompt: string;
    topics: { slug: string; subjects: { slug: string } | null } | null;
  }[];
};

const QUICK_LINKS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/practice", label: "New practice session", icon: Dumbbell },
  { href: "/subjects", label: "Subjects", icon: Library },
  { href: "/mistakes", label: "Mistake notebook", icon: AlertCircle },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/tutor", label: "AI tutor", icon: Sparkles },
  { href: "/plan", label: "Study plan", icon: CalendarRange },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Results>({
    subjects: [],
    topics: [],
    questions: [],
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    const listener = () => setOpen(true);
    window.addEventListener("open-command-palette", listener);
    return () => window.removeEventListener("open-command-palette", listener);
  }, []);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ subjects: [], topics: [], questions: [] });
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasResults =
    results.subjects.length + results.topics.length + results.questions.length >
    0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="max-w-xl gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search subjects, topics, questions…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-[22rem] overflow-y-auto p-2">
            {!query && (
              <Command.Group heading="Jump to">
                {QUICK_LINKS.map((l) => (
                  <Item key={l.href} onSelect={() => go(l.href)}>
                    <l.icon className="h-4 w-4 text-muted-foreground" />
                    {l.label}
                  </Item>
                ))}
              </Command.Group>
            )}

            {query.length >= 2 && !loading && !hasResults && (
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
                No results for “{query}”.
              </Command.Empty>
            )}

            {results.subjects.length > 0 && (
              <Command.Group heading="Subjects">
                {results.subjects.map((s) => (
                  <Item
                    key={s.id}
                    onSelect={() => go(`/subjects/${s.slug}`)}
                  >
                    <Library className="h-4 w-4 text-muted-foreground" />
                    {s.name}
                  </Item>
                ))}
              </Command.Group>
            )}

            {results.topics.length > 0 && (
              <Command.Group heading="Topics">
                {results.topics.map((t) => (
                  <Item
                    key={t.id}
                    onSelect={() =>
                      go(`/subjects/${t.subjects?.slug}/${t.slug}`)
                    }
                  >
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span>{t.name}</span>
                    {t.subjects && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t.subjects.name}
                      </span>
                    )}
                  </Item>
                ))}
              </Command.Group>
            )}

            {results.questions.length > 0 && (
              <Command.Group heading="Questions">
                {results.questions.map((qn) => (
                  <Item
                    key={qn.id}
                    onSelect={() => go(`/questions/${qn.id}`)}
                  >
                    <FileQuestion className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {qn.title || qn.prompt.slice(0, 70)}
                    </span>
                  </Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs text-muted-foreground">
            <span>Search across your revision space</span>
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono">
              esc
            </kbd>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-surface-2"
    >
      {children}
    </Command.Item>
  );
}
