import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CURRICULUM_LEVELS,
  SCHEMAS,
  deleteCurriculumNode,
  type CurriculumLevel,
} from "@/lib/admin/curriculum";
import { requireAdminApi } from "../../../auth";
import { curriculumTable } from "../../table";

type Db = ReturnType<typeof createAdminClient>;

function isLevel(value: string): value is CurriculumLevel {
  return (CURRICULUM_LEVELS as readonly string[]).includes(value);
}

/** Column on `questions` that ties a question to this level of the tree. */
const QUESTION_COLUMN: Record<CurriculumLevel, string | null> = {
  subjects: "subject_id",
  themes: null,
  topics: "topic_id",
  subtopics: "subtopic_id",
};

/** Impact preview: how many questions a delete at this node would touch. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ level: string; id: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { level, id } = await params;
  if (!isLevel(level)) {
    return NextResponse.json({ error: "Unknown level" }, { status: 404 });
  }

  const affected = await countQuestions(createAdminClient(), level, id);
  return NextResponse.json({ affected });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ level: string; id: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { level, id } = await params;
  if (!isLevel(level)) {
    return NextResponse.json({ error: "Unknown level" }, { status: 404 });
  }

  const parsed = SCHEMAS[level]
    .partial()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data, error } = await curriculumTable(level)
    .update(parsed.data as Record<string, unknown>)
    .eq("id", id)
    .select("id, name, sort_order")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ node: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ level: string; id: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { level, id } = await params;
  if (!isLevel(level)) {
    return NextResponse.json({ error: "Unknown level" }, { status: 404 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true";
  const supabase = createAdminClient();

  const outcome = await deleteCurriculumNode(level, id, force, {
    countQuestions: (lvl, nodeId) => countQuestions(supabase, lvl, nodeId),
    async remove(lvl, nodeId) {
      const { error } = await curriculumTable(lvl).delete().eq("id", nodeId);
      return { error: error?.message };
    },
  });

  if (outcome.status === "blocked") {
    return NextResponse.json(
      { error: "Questions attached", affected: outcome.affected },
      { status: 409 },
    );
  }
  if (outcome.status === "error") {
    return NextResponse.json({ error: outcome.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: id });
}

async function countQuestions(
  supabase: Db,
  level: CurriculumLevel,
  id: string,
): Promise<number> {
  const column = QUESTION_COLUMN[level];
  if (!column) return 0;
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  return count ?? 0;
}
