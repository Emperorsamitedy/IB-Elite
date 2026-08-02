"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/actions/analytics";

export type OnboardingInput = {
  subjects: { subjectId: string; levelId: string | null }[];
  exams: { subjectId: string; levelId: string | null; date: string }[];
  goals: string[];
};

export async function completeOnboarding(input: OnboardingInput) {
  const user = await requireUser();
  const supabase = await createClient();

  if (input.subjects.length > 0) {
    await supabase.from("user_subjects").upsert(
      input.subjects.map((s) => ({
        user_id: user.id,
        subject_id: s.subjectId,
        level_id: s.levelId,
      })),
      { onConflict: "user_id,subject_id" },
    );
  }

  if (input.exams.length > 0) {
    await supabase.from("exam_dates").insert(
      input.exams.map((e) => ({
        user_id: user.id,
        subject_id: e.subjectId,
        level_id: e.levelId,
        exam_date: e.date,
      })),
    );
  }

  await supabase
    .from("user_preferences")
    .update({ goals: input.goals })
    .eq("user_id", user.id);

  await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);

  await logEvent("account_onboarded", {
    subjects: input.subjects.length,
    goals: input.goals,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function skipOnboarding() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
