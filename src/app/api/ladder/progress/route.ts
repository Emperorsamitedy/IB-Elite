import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordProgress } from "@/lib/ladder/progress";
import { createPublisher } from "@/lib/ladder/pusher";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";
import { authorizeSelf } from "../auth";

const bodySchema = z.object({
  matchId: z.string().uuid(),
  studentId: z.string().uuid(),
  questionIndex: z.number().int().min(0),
  isCorrect: z.boolean(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const auth = await authorizeSelf(parsed.data.studentId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const event = await recordProgress(
      createSupabaseLadderStore(),
      createPublisher(),
      parsed.data,
    );
    return NextResponse.json({ progress: event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
