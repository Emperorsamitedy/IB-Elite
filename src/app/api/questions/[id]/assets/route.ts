import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { questionAssetViews } from "@/lib/questions/asset-store";

/**
 * Figures for a published question. Storage is private, so the URLs are signed
 * here at read time rather than stored on the row.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: question } = await supabase
    .from("questions")
    .select("id")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ assets: await questionAssetViews(id) });
}
