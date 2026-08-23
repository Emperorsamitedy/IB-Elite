import { NextResponse, type NextRequest } from "next/server";
import { getMatchState } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { duelErrorResponse, requireUser } from "../../util";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const state = await getMatchState(
      createSupabaseDuelStore(),
      id,
      user.id,
      new Date(),
    );

    // Public-safe opponent identity: pseudonymous display name only.
    let opponentName: string | null = null;
    if (state.opponent) {
      const { data } = await createAdminClient()
        .from("profiles")
        .select("display_name")
        .eq("id", state.opponent.studentId)
        .maybeSingle();
      opponentName = data?.display_name ?? null;
    }

    return NextResponse.json({
      ...state,
      opponent: state.opponent
        ? { ...state.opponent, studentId: undefined, displayName: opponentName }
        : null,
      you: { ...state.you, studentId: undefined },
    });
  } catch (error) {
    return duelErrorResponse(error);
  }
}
