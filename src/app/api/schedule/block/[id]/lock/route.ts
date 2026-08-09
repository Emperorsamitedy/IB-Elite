import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setBlockLock } from "@/lib/scheduler";
import { authorizeStudent } from "../../../auth";

const bodySchema = z.object({ isLocked: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: block } = await supabase
    .from("study_blocks")
    .select("student_id")
    .eq("id", id)
    .maybeSingle();
  if (!block) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await authorizeStudent(block.student_id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const updated = await setBlockLock(id, parsed.data.isLocked);
    return NextResponse.json({ block: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update block";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
