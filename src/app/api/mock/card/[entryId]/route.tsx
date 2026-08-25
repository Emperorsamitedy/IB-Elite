import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Shareable results card. Contains only what the student chooses to share
 * by sending the link: pseudonymous display name, mark, percentiles. The
 * entry id is an unguessable UUID and nothing renders before Results Day.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const admin = createAdminClient();

  const { data: result } = await admin
    .from("mock_results")
    .select("total_awarded, total_max, global_percentile, country_percentile, country_rank, released")
    .eq("entry_id", entryId)
    .maybeSingle();
  if (!result?.released) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: entry } = await admin
    .from("mock_entries")
    .select("user_id, mock_sittings(band, mock_papers(title, subjects(name)))")
    .eq("id", entryId)
    .maybeSingle();
  const sitting = entry?.mock_sittings as unknown as {
    mock_papers?: { title?: string; subjects?: { name?: string } };
  } | null;
  const paperTitle = sitting?.mock_papers?.title ?? "World Mock";
  const subjectName = sitting?.mock_papers?.subjects?.name ?? "";

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, country")
    .eq("id", entry?.user_id ?? "")
    .maybeSingle();

  const pct = result.global_percentile;
  const topShare = pct !== null ? Math.max(1, 100 - pct) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "#101014",
          color: "#f5f4f0",
          fontSize: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, letterSpacing: -1, fontSize: 34 }}>
            Atlas · World Mock
          </span>
          <span style={{ color: "#e4572e", fontWeight: 700 }}>
            {subjectName}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 30, color: "#b7b4ac" }}>{paperTitle}</span>
          <span style={{ fontSize: 96, fontWeight: 800 }}>
            {result.total_awarded}/{result.total_max}
          </span>
          {topShare !== null && (
            <span style={{ fontSize: 40, color: "#e4572e", fontWeight: 700 }}>
              Top {topShare}% worldwide
            </span>
          )}
          {result.country_rank !== null && profile?.country && (
            <span style={{ fontSize: 28, color: "#b7b4ac" }}>
              #{result.country_rank} in {profile.country}
            </span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#b7b4ac" }}>
            {profile?.display_name ?? "Student"}
          </span>
          <span style={{ color: "#b7b4ac" }}>Sit the next one free</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
