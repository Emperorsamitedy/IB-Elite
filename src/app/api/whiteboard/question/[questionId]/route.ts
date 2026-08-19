import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { whiteboardService } from "@/lib/whiteboard/store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = new URL(request.url).searchParams.get("studentId");
  if (studentId && studentId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { questionId } = await params;
  const boards = await whiteboardService().listForQuestion(user.id, questionId);

  return NextResponse.json({ whiteboards: boards });
}
