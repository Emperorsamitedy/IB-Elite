import { NextResponse, type NextRequest } from "next/server";
import { getLeaderboard } from "@/lib/ladder/leaderboard";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const country = params.get("country") ?? undefined;
  const school = params.get("school") ?? undefined;
  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)
    : 50;

  try {
    const rows = await getLeaderboard(createSupabaseLadderStore(), {
      country,
      school,
      limit,
    });
    return NextResponse.json({ leaderboard: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
