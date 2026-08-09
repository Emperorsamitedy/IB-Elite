import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { queueForMatch } from "@/lib/ladder/queue";
import { createSupabaseLadderStore } from "@/lib/ladder/supabase-store";
import { authorizeSelf } from "../auth";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  paperRef: z.string().max(64).nullable().optional(),
  paperYear: z.number().int().min(1990).max(2100).nullable().optional(),
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
    const result = await queueForMatch(createSupabaseLadderStore(), parsed.data);
    return NextResponse.json({
      matchId: result.matchId,
      status: result.status,
      match: result.match,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
