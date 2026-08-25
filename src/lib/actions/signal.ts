"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({
  public: z.boolean(),
  showCountry: z.boolean(),
  showTrajectory: z.boolean(),
  showHistory: z.boolean(),
  subjectIds: z.array(z.string().uuid()).max(12),
});

/** The student controls exactly what their public Signal page shows. */
export async function updateSignalProfile(
  input: z.infer<typeof profileSchema>,
) {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the profile settings." };
  const { error } = await createAdminClient().from("signal_profiles").upsert({
    user_id: user.id,
    public: parsed.data.public,
    show_country: parsed.data.showCountry,
    show_trajectory: parsed.data.showTrajectory,
    show_history: parsed.data.showHistory,
    subject_ids: parsed.data.subjectIds,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/signal");
  return { ok: true };
}

const reportSchema = z.object({
  subjectId: z.string().uuid(),
  officialGrade: z.number().int().min(1).max(7),
  examSession: z.string().min(4).max(20),
});

/**
 * Voluntary official-result report. The current Signal is frozen into the
 * report so the published accuracy stats can never be retro-fitted.
 */
export async function submitCalibrationReport(
  input: z.infer<typeof reportSchema>,
) {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the report details." };
  const admin = createAdminClient();

  const { data: rating } = await admin
    .from("signal_ratings")
    .select("rating, confidence")
    .eq("user_id", user.id)
    .eq("subject_id", parsed.data.subjectId)
    .maybeSingle();
  if (!rating) return { error: "No Signal rating for that subject yet." };

  const { error } = await admin.from("calibration_reports").insert({
    user_id: user.id,
    subject_id: parsed.data.subjectId,
    predicted_rating: rating.rating,
    predicted_confidence: rating.confidence,
    official_grade: parsed.data.officialGrade,
    exam_session: parsed.data.examSession.trim(),
  });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "You already reported this session."
        : error.message,
    };
  }
  revalidatePath("/signal");
  return { ok: true };
}
