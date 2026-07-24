"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PlanIntensity } from "@/lib/types";

export async function updateProfile(input: { fullName: string }) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ full_name: input.fullName.trim() || null })
    .eq("id", user.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updatePreferences(input: {
  intensity?: PlanIntensity;
  dailyTarget?: number;
  reduceMotion?: boolean;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const patch: {
    intensity?: PlanIntensity;
    daily_target?: number;
    reduce_motion?: boolean;
  } = {};
  if (input.intensity) patch.intensity = input.intensity;
  if (typeof input.dailyTarget === "number")
    patch.daily_target = input.dailyTarget;
  if (typeof input.reduceMotion === "boolean")
    patch.reduce_motion = input.reduceMotion;
  await supabase.from("user_preferences").update(patch).eq("user_id", user.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function addExamDate(input: {
  subjectId: string;
  date: string;
  label?: string;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("exam_dates").insert({
    user_id: user.id,
    subject_id: input.subjectId,
    exam_date: input.date,
    label: input.label ?? null,
  });
  revalidatePath("/settings");
  revalidatePath("/app");
  return { ok: true };
}

export async function deleteExamDate(id: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("exam_dates").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/settings");
  revalidatePath("/app");
  return { ok: true };
}

export async function toggleUserSubject(subjectId: string, add: boolean) {
  const user = await requireUser();
  const supabase = await createClient();
  if (add) {
    await supabase
      .from("user_subjects")
      .upsert(
        { user_id: user.id, subject_id: subjectId },
        { onConflict: "user_id,subject_id" },
      );
  } else {
    await supabase
      .from("user_subjects")
      .delete()
      .eq("user_id", user.id)
      .eq("subject_id", subjectId);
  }
  revalidatePath("/settings");
  revalidatePath("/app");
  return { ok: true };
}
