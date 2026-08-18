import { NextResponse, type NextRequest } from "next/server";
import { persistOrder, reorderSchema } from "@/lib/admin/curriculum";
import { requireAdminApi } from "../../auth";
import { curriculumTable } from "../table";

export async function PATCH(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { error } = await persistOrder(
    parsed.data.level,
    parsed.data.ids,
    async (level, id, sortOrder) => {
      const { error: e } = await curriculumTable(level)
        .update({ sort_order: sortOrder })
        .eq("id", id);
      return { error: e?.message };
    },
  );

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true, count: parsed.data.ids.length });
}
