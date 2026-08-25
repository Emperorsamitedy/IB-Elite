import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMockGrader } from "@/lib/mock/grade";
import {
  gradeBatch,
  releaseDueResults,
  requeueStuckEntries,
} from "@/lib/mock/service";
import { createSupabaseMockStore } from "@/lib/mock/supabase-store";
import { createScanOcr, isScanOcrConfigured } from "@/lib/scans/ocr";
import { createSupabaseScanStorage } from "@/lib/scans/supabase-store";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * The World Mock heartbeat: grades a batch of submitted scripts, then
 * releases any paper whose Results Day has arrived. Idempotent — schedule
 * it every 10 minutes (Vercel cron, pg_cron via pg_net, or curl) and run
 * it repeatedly overnight until the queue drains. Authenticated by
 * CRON_SECRET, or an admin session for manual runs.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-secret");
  let authorized = Boolean(secret) && header === secret;
  if (!authorized) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      authorized = profile?.role === "admin";
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const store = createSupabaseMockStore();
  const storage = createSupabaseScanStorage();
  const readScript = isScanOcrConfigured()
    ? (path: string) => createScanOcr(storage).read(path)
    : async () => ({ text: "", words: [] });

  // Recover entries a crashed worker left claimed, then grade.
  const { requeued } = await requeueStuckEntries(store, new Date());

  // Grade in slices until the time budget is nearly spent.
  const startedAt = Date.now();
  let graded = 0;
  let quarantined = 0;
  while (Date.now() - startedAt < 200_000) {
    const out = await gradeBatch(store, createMockGrader(), readScript, 5, new Date());
    graded += out.graded;
    quarantined += out.quarantined;
    if (out.graded === 0) break;
  }

  // Candidate papers: any scheduled paper with a due, unreleased sitting.
  const { data: due } = await createAdminClient()
    .from("mock_sittings")
    .select("paper_id")
    .eq("status", "scheduled")
    .lte("results_at", new Date().toISOString());
  const paperIds = [...new Set((due ?? []).map((s) => s.paper_id))];
  const released = await releaseDueResults(store, paperIds, new Date());

  return NextResponse.json({ requeued, graded, quarantined, ...released });
}
