import { NextResponse, type NextRequest } from "next/server";
import { assetInputSchema } from "@/lib/questions/assets";
import {
  createQuestionAsset,
  questionAssetViews,
} from "@/lib/questions/asset-store";
import { requireAdminApi } from "../../auth";

export async function GET(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const questionId = request.nextUrl.searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  return NextResponse.json({ assets: await questionAssetViews(questionId) });
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const parsed = assetInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const asset = await createQuestionAsset(parsed.data);
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
