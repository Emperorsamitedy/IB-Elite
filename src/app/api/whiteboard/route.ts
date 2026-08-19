import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { whiteboardService } from "@/lib/whiteboard/store";

const bodySchema = z.object({
  questionId: z.string().uuid().nullish(),
  title: z.string().trim().max(120).nullish(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // The owner comes from the session, never from the request body.
  const board = await whiteboardService().create({
    studentId: user.id,
    questionId: parsed.data.questionId ?? null,
    title: parsed.data.title ?? null,
  });

  return NextResponse.json({ id: board.id }, { status: 201 });
}
