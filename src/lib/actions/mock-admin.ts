"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMockGrader } from "@/lib/mock/grade";
import type { Criterion } from "@/lib/mock/types";
import type { Json } from "@/lib/supabase/database.types";

const criterionSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  maxMarks: z.number().int().min(1).max(50),
  topicId: z.string().uuid().nullable().optional(),
});

const paperSchema = z.object({
  subjectId: z.string().uuid(),
  levelCode: z.enum(["SL", "HL"]),
  title: z.string().min(3).max(200),
  body: z.string().max(60_000),
  durationMinutes: z.number().int().min(10).max(300),
  markscheme: z.array(criterionSchema).max(30),
});

export type MockPaperFormValues = z.infer<typeof paperSchema>;

export async function saveMockPaper(
  id: string | null,
  input: MockPaperFormValues,
) {
  await requireAdmin();
  const parsed = paperSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the paper details." };
  const v = parsed.data;
  const row = {
    subject_id: v.subjectId,
    level_code: v.levelCode,
    title: v.title,
    body: v.body,
    duration_minutes: v.durationMinutes,
    markscheme: v.markscheme as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  const admin = createAdminClient();
  const { data, error } = id
    ? await admin.from("mock_papers").update(row).eq("id", id).select("id").single()
    : await admin.from("mock_papers").insert(row).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/mock");
  return { ok: true, id: data.id };
}

export async function setMockPaperStatus(
  id: string,
  status: "draft" | "calibration" | "scheduled" | "cancelled",
) {
  await requireAdmin();
  const admin = createAdminClient();

  if (status === "scheduled") {
    // A paper cannot go live without a markscheme and its sittings.
    const { data: paper } = await admin
      .from("mock_papers")
      .select("markscheme")
      .eq("id", id)
      .single();
    const criteria = (paper?.markscheme ?? []) as unknown as Criterion[];
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return { error: "Add a markscheme before scheduling." };
    }
    const { count } = await admin
      .from("mock_sittings")
      .select("id", { count: "exact", head: true })
      .eq("paper_id", id)
      .eq("status", "scheduled");
    if (!count) return { error: "Schedule the sittings first." };
  }

  const { error } = await admin
    .from("mock_papers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/mock");
  return { ok: true };
}

const sittingSchema = z.object({
  band: z.enum(["americas", "emea", "apac"]),
  opensAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  closesAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  resultsAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
});

export async function scheduleMockSittings(
  paperId: string,
  sittings: z.infer<typeof sittingSchema>[],
) {
  await requireAdmin();
  const parsed = z.array(sittingSchema).min(1).max(3).safeParse(sittings);
  if (!parsed.success) return { error: "Check the sitting times." };
  for (const s of parsed.data) {
    if (new Date(s.closesAt) <= new Date(s.opensAt)) {
      return { error: `${s.band}: closes before it opens.` };
    }
    if (new Date(s.resultsAt) < new Date(s.closesAt)) {
      return { error: `${s.band}: results before the window closes.` };
    }
  }
  const admin = createAdminClient();
  const { error } = await admin.from("mock_sittings").upsert(
    parsed.data.map((s) => ({
      paper_id: paperId,
      band: s.band,
      opens_at: s.opensAt,
      closes_at: s.closesAt,
      results_at: s.resultsAt,
      status: "scheduled",
    })),
    { onConflict: "paper_id,band" },
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/mock");
  return { ok: true };
}

/**
 * Kill-switch: pushes every not-yet-closed sitting of the paper back by
 * `hours`, entrants notified. Cancelling instead is `setMockPaperStatus`.
 */
export async function delayMockPaper(paperId: string, hours: number) {
  await requireAdmin();
  if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 14) {
    return { error: "Delay must be between 1 hour and 14 days." };
  }
  const admin = createAdminClient();
  const { data: sittings } = await admin
    .from("mock_sittings")
    .select("id, closes_at, opens_at, results_at")
    .eq("paper_id", paperId)
    .eq("status", "scheduled");
  const shift = hours * 3600_000;
  const now = Date.now();
  let shifted = 0;
  for (const s of sittings ?? []) {
    if (new Date(s.closes_at).getTime() < now) continue; // already sat
    await admin
      .from("mock_sittings")
      .update({
        opens_at: new Date(new Date(s.opens_at).getTime() + shift).toISOString(),
        closes_at: new Date(new Date(s.closes_at).getTime() + shift).toISOString(),
        results_at: new Date(new Date(s.results_at).getTime() + shift).toISOString(),
      })
      .eq("id", s.id);
    shifted += 1;

    const { data: entrants } = await admin
      .from("mock_entries")
      .select("user_id")
      .eq("sitting_id", s.id);
    for (const e of entrants ?? []) {
      await admin.from("notifications").insert({
        user_id: e.user_id,
        category: "mock",
        title: `Sitting delayed by ${hours}h`,
        href: `/mock/${s.id}`,
      });
    }
  }
  revalidatePath("/admin/mock");
  return { ok: true, shifted };
}

/** Calibration: mark a sample transcript and show the grader's output. */
export async function calibrateMockPaper(paperId: string, sample: string) {
  await requireAdmin();
  if (!sample.trim()) return { error: "Paste a sample transcript first." };
  const admin = createAdminClient();
  const { data: paper } = await admin
    .from("mock_papers")
    .select("markscheme")
    .eq("id", paperId)
    .single();
  const criteria = (paper?.markscheme ?? []) as unknown as Criterion[];
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return { error: "Add a markscheme first." };
  }
  try {
    const outcome = await createMockGrader().grade(sample, criteria);
    return { ok: true, outcome };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Calibration failed",
    };
  }
}
