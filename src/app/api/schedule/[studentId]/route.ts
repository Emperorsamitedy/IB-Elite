import { NextResponse } from "next/server";
import { getSchedule } from "@/lib/scheduler";
import { authorizeStudent } from "../auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const auth = await authorizeStudent(studentId);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const days = await getSchedule(studentId);
    return NextResponse.json({ days });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
