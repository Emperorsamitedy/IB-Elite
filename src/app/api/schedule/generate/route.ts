import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generatePlan } from "@/lib/scheduler";
import { authorizeStudent } from "../auth";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dailyCapMinutes: z.number().int().min(15).max(960).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { studentId, examDate, dailyCapMinutes } = parsed.data;
  const auth = await authorizeStudent(studentId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const blocks = await generatePlan(studentId, examDate, { dailyCapMinutes });
    return NextResponse.json({ blocks }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
