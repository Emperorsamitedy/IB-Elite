import { NextResponse, type NextRequest } from "next/server";
import {
  CURRICULUM_LEVELS,
  SCHEMAS,
  type CurriculumLevel,
} from "@/lib/admin/curriculum";
import { requireAdminApi } from "../../auth";
import { curriculumTable } from "../table";

function isLevel(value: string): value is CurriculumLevel {
  return (CURRICULUM_LEVELS as readonly string[]).includes(value);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ level: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { level } = await params;
  if (!isLevel(level)) {
    return NextResponse.json({ error: "Unknown level" }, { status: 404 });
  }

  const parsed = SCHEMAS[level].safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data, error } = await curriculumTable(level)
    .insert(parsed.data as Record<string, unknown>)
    .select("id, name, sort_order")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ node: data }, { status: 201 });
}
