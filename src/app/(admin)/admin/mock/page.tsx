import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MockManager,
  type AdminMockPaper,
  type SubjectOption,
} from "@/components/admin/mock-manager";
import type { Criterion, MockBand } from "@/lib/mock/types";

export const metadata = { title: "World Mock" };

export default async function AdminMockPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: papers }, { data: subjects }] = await Promise.all([
    admin
      .from("mock_papers")
      .select(
        "id, subject_id, level_code, title, body, duration_minutes, markscheme, status, mock_sittings(band, opens_at, closes_at, results_at, status, mock_entries(id))",
      )
      .order("created_at", { ascending: false }),
    admin
      .from("subjects")
      .select("id, name, topics(id, name)")
      .order("sort_order"),
  ]);

  const rows: AdminMockPaper[] = (papers ?? []).map((p) => {
    const sittings = (p.mock_sittings ?? []) as unknown as {
      band: MockBand;
      opens_at: string;
      closes_at: string;
      results_at: string;
      status: string;
      mock_entries?: { id: string }[];
    }[];
    return {
      id: p.id,
      subject_id: p.subject_id,
      level_code: p.level_code as "SL" | "HL",
      title: p.title,
      body: p.body,
      duration_minutes: p.duration_minutes,
      markscheme: (Array.isArray(p.markscheme)
        ? p.markscheme
        : []) as unknown as Criterion[],
      status: p.status,
      sittings: sittings.map((s) => ({
        band: s.band,
        opens_at: s.opens_at,
        closes_at: s.closes_at,
        results_at: s.results_at,
        status: s.status,
      })),
      entries: sittings.reduce(
        (sum, s) => sum + (s.mock_entries?.length ?? 0),
        0,
      ),
    };
  });

  const subjectOptions: SubjectOption[] = (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    topics: (s.topics ?? []) as { id: string; name: string }[],
  }));

  return <MockManager papers={rows} subjects={subjectOptions} />;
}
