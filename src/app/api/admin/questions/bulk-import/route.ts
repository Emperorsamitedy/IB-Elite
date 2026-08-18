import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importQuestionRows, type QuestionInput } from "@/lib/admin/questions";
import { requireAdminApi } from "../../auth";

export async function POST(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body) ? body : (body?.rows ?? null);
  if (!Array.isArray(rows)) {
    return NextResponse.json(
      { error: "Expected an array of rows." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const result = await importQuestionRows(rows, {
    async subjectExists(id) {
      const { data } = await supabase
        .from("subjects")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      return Boolean(data);
    },
    async topicExists(id, subjectId) {
      const { data } = await supabase
        .from("topics")
        .select("id")
        .eq("id", id)
        .eq("subject_id", subjectId)
        .maybeSingle();
      return Boolean(data);
    },
    async insert(row: QuestionInput) {
      const { error } = await supabase.from("questions").insert(row);
      return { error: error?.message };
    },
  });

  return NextResponse.json(result);
}
