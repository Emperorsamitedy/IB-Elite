import { NextResponse, type NextRequest } from "next/server";
import { deleteQuestionAsset } from "@/lib/questions/asset-store";
import { requireAdminApi } from "../../../auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const removed = await deleteQuestionAsset(id);
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
