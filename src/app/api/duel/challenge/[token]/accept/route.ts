import { NextResponse, type NextRequest } from "next/server";
import { acceptDuelChallenge } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { duelErrorResponse, requireUser, track } from "../../../util";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await params;

  try {
    const match = await acceptDuelChallenge(
      createSupabaseDuelStore(),
      { token, userId: user.id },
      new Date(),
    );
    // Attribution: an account younger than an hour accepting a link means
    // the challenge converted a signup.
    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const isNewSignup = Date.now() - createdAt < 60 * 60 * 1000;
    await track("challenge_accepted", user.id, {
      token,
      matchId: match.id,
      convertedSignup: isNewSignup,
    });
    return NextResponse.json({ matchId: match.id });
  } catch (error) {
    return duelErrorResponse(error);
  }
}
