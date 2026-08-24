import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { sittingPhase } from "@/lib/mock/windows";
import { BAND_LABELS, type MockBand } from "@/lib/mock/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Countdown } from "@/components/mock/countdown";
import { EnterSittingButton } from "@/components/mock/enter-button";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: messages.mock.title };

const t = messages.mock;

export default async function MockIndexPage() {
  if (!(await getFlag("world_mock"))) notFound();
  const user = await requireUser();
  const admin = createAdminClient();
  const now = new Date();

  const [{ data: sittings }, { data: myEntries }] = await Promise.all([
    admin
      .from("mock_sittings")
      .select(
        "id, band, opens_at, closes_at, results_at, status, mock_papers!inner(id, title, duration_minutes, status, subjects(name))",
      )
      .eq("status", "scheduled")
      .eq("mock_papers.status", "scheduled")
      .gte("results_at", new Date(now.getTime() - 14 * 864e5).toISOString())
      .order("opens_at"),
    admin
      .from("mock_entries")
      .select("id, sitting_id, status")
      .eq("user_id", user.id),
  ]);

  const entryBySitting = new Map(
    (myEntries ?? []).map((e) => [e.sitting_id, e]),
  );
  const rows = (sittings ?? []).map((s) => {
    const paper = s.mock_papers as unknown as {
      title: string;
      duration_minutes: number;
      subjects: { name: string } | null;
    };
    return { ...s, paper, entry: entryBySitting.get(s.id) ?? null };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Globe className="h-5 w-5 text-accent" /> {t.title}
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t.title} description={t.none} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((s) => {
            const phase = sittingPhase(
              { ...s, status: s.status as "scheduled" | "cancelled" },
              now,
            );
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <Link
                      href={`/mock/${s.id}`}
                      className="font-bold tracking-tight hover:text-accent"
                    >
                      {s.paper.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {s.paper.subjects?.name} · {BAND_LABELS[s.band as MockBand]} ·{" "}
                      {s.paper.duration_minutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {phase === "upcoming" && (
                      <span className="font-mono text-sm">
                        {t.opensIn}{" "}
                        <Countdown to={s.opens_at} className="font-semibold" />
                      </span>
                    )}
                    {phase === "open" && (
                      <Badge variant="accent">
                        {t.closesIn}&nbsp;
                        <Countdown to={s.closes_at} />
                      </Badge>
                    )}
                    {phase === "closed" && (
                      <span className="font-mono text-sm text-muted-foreground">
                        {t.resultsIn}{" "}
                        <Countdown to={s.results_at} className="font-semibold" />
                      </span>
                    )}
                    {s.entry ? (
                      <Badge variant="success">{t.entered}</Badge>
                    ) : (
                      phase !== "closed" && <EnterSittingButton sittingId={s.id} />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
