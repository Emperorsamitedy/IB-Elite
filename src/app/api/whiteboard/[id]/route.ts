import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { whiteboardService } from "@/lib/whiteboard/store";

const patchSchema = z.object({
  canvas_data: z.record(z.string(), z.unknown()),
  /** Data URL of the rendered canvas; optional so autosave can skip it. */
  thumbnail: z.string().startsWith("data:image/png;base64,").nullish(),
});

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const board = await whiteboardService().get(id, user.id);
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: board.id,
    title: board.title,
    questionId: board.question_id,
    canvasData: board.canvas_data,
    updatedAt: board.updated_at,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id } = await params;
  const board = await whiteboardService().save(id, user.id, {
    canvasData: parsed.data.canvas_data,
    thumbnail: parsed.data.thumbnail,
  });
  if (!board) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id: board.id, updatedAt: board.updated_at });
}
