import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whiteboardService } from "@/lib/whiteboard/store";
import { DEFAULT_PAGE_SIZE } from "@/lib/whiteboard/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { studentId } = await params;
  // The id in the path is checked against the session rather than trusted.
  if (studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const boards = await whiteboardService().listFreeform(user.id, {
    limit: Number.isFinite(limit) ? Math.min(limit, 100) : DEFAULT_PAGE_SIZE,
    offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
  });

  return NextResponse.json({ whiteboards: boards });
}
