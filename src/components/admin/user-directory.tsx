"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Gauge } from "@/components/ui/gauge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { AdminUserRow } from "@/lib/admin/users";

const PAGE_SIZE = 25;

export function UserDirectory({
  rows,
  total,
  page,
  search,
}: {
  rows: AdminUserRow[];
  total: number;
  page: number;
  search: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(search);
  const [selected, setSelected] = React.useState<AdminUserRow | null>(null);

  function navigate(next: { page?: number; search?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.search !== undefined) {
      if (next.search) sp.set("q", next.search);
      else sp.delete("q");
      sp.delete("page");
    }
    if (next.page !== undefined) sp.set("page", String(next.page));
    router.push(`/admin/users?${sp.toString()}`);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">User directory</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: query });
        }}
        className="relative max-w-sm"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="h-9 pl-9"
        />
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-2.5">Name</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Email</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">
                  Current standing
                </th>
                <th className="hidden px-4 py-2.5 md:table-cell">Signed up</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5">{u.name ?? "—"}</td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                    {u.email}
                  </td>
                  <td className="hidden px-4 py-2.5 lg:table-cell">
                    <div className="flex flex-wrap items-end gap-3">
                      {u.subjects.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {u.subjects.slice(0, 3).map((s) => (
                        <div key={s.subjectId} className="w-20">
                          <p className="truncate text-[11px] text-muted-foreground">
                            {s.name}
                          </p>
                          <Gauge
                            size="sm"
                            value={s.grade}
                            showNumbers={false}
                            animate={false}
                          />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {new Date(u.signedUpAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={u.plan === "free" ? "outline" : "success"}
                      className="capitalize"
                    >
                      {u.plan}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {u.lastActiveAt
                      ? new Date(u.lastActiveAt).toLocaleDateString()
                      : "Never"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No users match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} user{total === 1 ? "" : "s"} · page {page} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => navigate({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent className="max-w-md overflow-y-auto p-6">
          {selected && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold">{selected.name ?? "—"}</h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Plan" value={selected.plan} />
                <Detail
                  label="Signed up"
                  value={new Date(selected.signedUpAt).toLocaleDateString()}
                />
                <Detail
                  label="Last active"
                  value={
                    selected.lastActiveAt
                      ? new Date(selected.lastActiveAt).toLocaleString()
                      : "Never"
                  }
                />
                <Detail
                  label="Subjects"
                  value={String(selected.subjects.length)}
                />
              </dl>

              <div className="flex flex-col gap-3">
                {selected.subjects.map((s) => (
                  <div
                    key={s.subjectId}
                    className="rounded-lg border border-border bg-surface-2 p-3"
                  >
                    <p className="text-sm font-medium">
                      {s.name}
                      {s.level ? ` · ${s.level}` : ""}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {s.attempts} attempt{s.attempts === 1 ? "" : "s"}
                    </p>
                    <Gauge className="mt-2" size="sm" value={s.grade} />
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Read-only. User records cannot be edited or deleted here.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 capitalize">{value}</dd>
    </div>
  );
}
