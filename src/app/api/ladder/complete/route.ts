import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeSide } from "@/lib/ladder/complete";
import { createPusherPublisher } from "@/lib/ladder/pusher";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";
import { authorizeSelf } from "../auth";

const bodySchema = z.object({
  matchId: z.string().uuid(),
  studentId: z.string().uuid(),
  finalScore: z.number().int().min(0),
  // `profiles` has no country/school columns, so the client supplies them.
  country: z.string().max(64).optional(),
  school: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { matchId, studentId, finalScore, country, school } = parsed.data;
  const auth = await authorizeSelf(studentId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await completeSide(
      createSupabaseLadderStore(),
      createPusherPublisher(),
      {
        matchId,
        studentId,
        finalScore,
        identity: { country, school },
      },
    );
    return NextResponse.json({
      match: result.match,
      matchComplete: result.matchComplete,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete match";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
