import { NextResponse, type NextRequest } from "next/server";
import { schoolHeartbeat } from "@/lib/school/service";
import { getFlag } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * School Wars heartbeat: seasonal scores, rivalry scoreboards and lead
 * notifications, new pairings, season snapshots. Idempotent — schedule
 * alongside the mock heartbeat. CRON_SECRET or an admin session.
 */
export async function POST(request: NextRequest) {
  if (!(await getFlag("school_wars"))) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  const secret = process.env.CRON_SECRET;
  let authorized =
    Boolean(secret) && request.headers.get("x-cron-secret") === secret;
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

  const result = await schoolHeartbeat(new Date());
  return NextResponse.json(result);
}
