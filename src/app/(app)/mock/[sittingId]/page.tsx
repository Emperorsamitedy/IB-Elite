import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { getEntitlement } from "@/lib/subscription";
import { sittingPhase } from "@/lib/mock/windows";
import { topDecileByCriterion } from "@/lib/mock/percentiles";
import { BAND_LABELS, type Criterion, type CriterionAward, type MockBand } from "@/lib/mock/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/mock/countdown";
import { EnterSittingButton } from "@/components/mock/enter-button";
import { MockRoom } from "@/components/mock/mock-room";
import {
  MockScriptViewer,
  type ScriptPage,
} from "@/components/mock/script-viewer";
import { createSupabaseScanStorage } from "@/lib/scans/supabase-store";
import { ShareCardButton } from "@/components/mock/share-card-button";
import { StartSessionButton } from "@/components/app/start-session-button";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: messages.mock.title };

const t = messages.mock;

export default async function MockSittingPage({
  params,
}: {
  params: Promise<{ sittingId: string }>;
}) {
  if (!(await getFlag("world_mock"))) notFound();
  const { sittingId } = await params;
  const user = await requireUser();
  const admin = createAdminClient();
  const now = new Date();

  const { data: sitting } = await admin
    .from("mock_sittings")
    .select(
      "id, paper_id, band, opens_at, closes_at, results_at, status, mock_papers!inner(id, subject_id, title, duration_minutes, markscheme, status, subjects(name))",
    )
    .eq("id", sittingId)
    .maybeSingle();
  if (!sitting) notFound();
  const paper = sitting.mock_papers as unknown as {
    id: string;
    subject_id: string;
    title: string;
    duration_minutes: number;
    markscheme: Criterion[];
    subjects: { name: string } | null;
  };

  const phase = sittingPhase(
    { ...sitting, status: sitting.status as "scheduled" | "cancelled" },
    now,
  );
  const { data: entry } = await admin
    .from("mock_entries")
    .select("id, status, started_at, submitted_at")
    .eq("sitting_id", sittingId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: result } = entry
    ? await admin
        .from("mock_results")
        .select(
          "entry_id, total_awarded, total_max, criteria, grader, global_percentile, country_percentile, country_rank, released",
        )
        .eq("entry_id", entry.id)
        .eq("released", true)
        .maybeSingle()
    : { data: null };

  const entitlement = await getEntitlement(user.id);

  // Pro extras: the annotated script pages and the top-decile comparison.
  let scriptPages: ScriptPage[] = [];
  let topDecile: Map<string, number> | null = null;
  if (result && entry && entitlement.isPro) {
    const { data: scripts } = await admin
      .from("mock_scripts")
      .select("page_index, image_path")
      .eq("entry_id", entry.id)
      .order("page_index");
    const storage = createSupabaseScanStorage();
    scriptPages = await Promise.all(
      (scripts ?? []).map(async (script) => ({
        pageIndex: script.page_index,
        url: await storage.signedUrl(script.image_path),
      })),
    );
  }
  if (result && entitlement.isPro) {
    const { data: cohort } = await admin
      .from("mock_results")
      .select("total_awarded, criteria, mock_entries!inner(sitting_id, mock_sittings!inner(paper_id))")
      .eq("released", true)
      .eq("mock_entries.mock_sittings.paper_id", paper.id);
    topDecile = topDecileByCriterion(
      (cohort ?? []).map((r) => ({
        total: r.total_awarded,
        criteria: (r.criteria as unknown as CriterionAward[]) ?? [],
      })),
    );
  }

  const awards = (result?.criteria as unknown as CriterionAward[]) ?? [];
  const criteriaMeta = new Map(
    (Array.isArray(paper.markscheme) ? paper.markscheme : []).map((c) => [c.id, c]),
  );
  const weakest = [...awards]
    .filter((a) => criteriaMeta.get(a.criterionId)?.topicId)
    .sort((a, b) => a.awarded / a.maxMarks - b.awarded / b.maxMarks)
    .slice(0, 3);

  const roomStatus =
    !entry || entry.status === "entered"
      ? "entered"
      : entry.status === "started"
        ? "started"
        : "done";
  const { count: pageCount } = entry
    ? await admin
        .from("mock_scripts")
        .select("id", { count: "exact", head: true })
        .eq("entry_id", entry.id)
    : { count: 0 };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/mock" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t.title}
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{paper.title}</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          {paper.subjects?.name} · {BAND_LABELS[sitting.band as MockBand]} ·{" "}
          {paper.duration_minutes} min
        </p>
      </div>

      {phase === "upcoming" && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-8">
            <p className="font-mono text-sm">
              {t.opensIn}{" "}
              <Countdown to={sitting.opens_at} reloadOnZero className="font-bold" />
            </p>
            {entry ? (
              <Badge variant="success">{t.entered}</Badge>
            ) : (
              <EnterSittingButton sittingId={sitting.id} />
            )}
          </CardContent>
        </Card>
      )}

      {phase === "open" && (
        <MockRoom
          sittingId={sitting.id}
          initialStatus={roomStatus}
          initialPages={pageCount ?? 0}
        />
      )}

      {phase === "open" && roomStatus === "done" && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {entry?.status === "late" ? t.submittedLate : t.submitted}
          </CardContent>
        </Card>
      )}

      {phase === "closed" && !result && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-8">
            {entry?.status === "quarantined" ? (
              <p className="text-sm text-muted-foreground">{t.quarantined}</p>
            ) : entry?.submitted_at ? (
              <p className="font-mono text-sm">
                {t.resultsIn}{" "}
                <Countdown to={sitting.results_at} reloadOnZero className="font-bold" />
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{t.none}</p>
            )}
          </CardContent>
        </Card>
      )}

      {result && entry && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 py-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-extrabold">
                  <Trophy className="h-4 w-4 text-accent" /> {t.resultTitle}
                </h2>
                <ShareCardButton entryId={entry.id} />
              </div>
              <p className="text-4xl font-black tracking-tight">
                {result.total_awarded}
                <span className="text-xl text-muted-foreground">
                  /{result.total_max}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {result.global_percentile !== null ? (
                  <Badge variant="accent">
                    Top {Math.max(1, 100 - result.global_percentile)}% {t.percentileGlobal}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t.cohortTooSmall}
                  </span>
                )}
                {result.country_percentile !== null && (
                  <Badge variant="outline">
                    Top {Math.max(1, 100 - result.country_percentile)}% {t.percentileCountry}
                  </Badge>
                )}
                {result.country_rank !== null && (
                  <Badge variant="outline">
                    {t.countryRank} #{result.country_rank}
                  </Badge>
                )}
                {result.grader === "keywords" && (
                  <Badge variant="warning">keyword-marked</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {entitlement.isPro ? (
            <>
              <Card>
                <CardContent className="flex flex-col gap-4 py-6">
                  <h3 className="text-sm font-semibold">{t.criteria}</h3>
                  {awards.map((award) => (
                    <div key={award.criterionId} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{award.title}</span>
                        <span className="font-mono text-xs">
                          {award.awarded}/{award.maxMarks}
                          {topDecile?.has(award.criterionId) && (
                            <span className="ml-2 text-muted-foreground">
                              {t.topDecile}: {topDecile.get(award.criterionId)}
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress value={(award.awarded / Math.max(1, award.maxMarks)) * 100} />
                      {award.comment && (
                        <p className="text-xs text-muted-foreground">{award.comment}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {scriptPages.length > 0 && (
                <Card>
                  <CardContent className="py-6">
                    <MockScriptViewer pages={scriptPages} awards={awards} />
                  </CardContent>
                </Card>
              )}

              {weakest.length > 0 && (
                <Card>
                  <CardContent className="flex flex-col gap-3 py-6">
                    <h3 className="text-sm font-semibold">{t.practicePlan}</h3>
                    <p className="text-xs text-muted-foreground">{t.practicePlanHint}</p>
                    {weakest.map((award) => (
                      <div
                        key={award.criterionId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{award.title}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {award.awarded}/{award.maxMarks}
                          </span>
                        </div>
                        <StartSessionButton
                          input={{
                            subjectId: paper.subject_id,
                            topicIds: [criteriaMeta.get(award.criterionId)!.topicId!],
                            count: 5,
                          }}
                          size="sm"
                          variant="secondary"
                        >
                          {t.practiceStart}
                        </StartSessionButton>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-between gap-4 py-6">
                <p className="text-sm text-muted-foreground">{t.proOnly}</p>
                <Button size="sm" asChild>
                  <Link href="/settings/billing">Upgrade</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
