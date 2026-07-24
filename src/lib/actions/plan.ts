"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/actions/analytics";
import type { PlanIntensity } from "@/lib/types";

const ITEMS_PER_DAY: Record<PlanIntensity, number> = {
  light: 1,
  balanced: 2,
  intense: 3,
};

function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export async function generateStudyPlan(intensity: PlanIntensity = "balanced") {
  const user = await requireUser();
  const supabase = await createClient();

  // Archive existing active plans.
  await supabase
    .from("study_plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");

  // Gather subjects + topics the user is studying (fallback: all subjects).
  const { data: userSubjects } = await supabase
    .from("user_subjects")
    .select("subject_id")
    .eq("user_id", user.id);
  const subjectIds = (userSubjects ?? []).map((u) => u.subject_id);

  let topicsQuery = supabase
    .from("topics")
    .select("id, name, subject_id, subjects(name)")
    .order("sort_order");
  if (subjectIds.length > 0)
    topicsQuery = topicsQuery.in("subject_id", subjectIds);
  const { data: topics } = await topicsQuery;

  if (!topics || topics.length === 0) {
    return { error: "Add some subjects first to generate a plan." };
  }

  // Prioritise weak topics.
  const { data: attempts } = await supabase
    .from("question_attempts")
    .select("is_correct, questions(topic_id)")
    .eq("user_id", user.id)
    .limit(400);
  const perf = new Map<string, { total: number; correct: number }>();
  for (const a of attempts ?? []) {
    const q = a.questions as { topic_id: string } | null;
    if (!q) continue;
    const s = perf.get(q.topic_id) ?? { total: 0, correct: 0 };
    s.total += 1;
    if (a.is_correct) s.correct += 1;
    perf.set(q.topic_id, s);
  }
  const ordered = [...topics].sort((a, b) => {
    const pa = perf.get(a.id);
    const pb = perf.get(b.id);
    const aAcc = pa && pa.total ? pa.correct / pa.total : 0.5;
    const bAcc = pb && pb.total ? pb.correct / pb.total : 0.5;
    return aAcc - bAcc;
  });

  // Horizon: nearest exam, else 14 days.
  const today = new Date();
  const { data: nextExam } = await supabase
    .from("exam_dates")
    .select("exam_date")
    .eq("user_id", user.id)
    .gte("exam_date", today.toISOString().slice(0, 10))
    .order("exam_date")
    .limit(1)
    .maybeSingle();
  const end = nextExam ? new Date(nextExam.exam_date) : addDays(today, 14);
  const totalDays = Math.min(
    28,
    Math.max(3, Math.ceil((end.getTime() - today.getTime()) / 86400000)),
  );

  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({
      user_id: user.id,
      title: "My revision plan",
      intensity,
      start_date: today.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error || !plan) return { error: "Could not create plan." };

  const perDay = ITEMS_PER_DAY[intensity];
  const items: {
    plan_id: string;
    day: string;
    subject_id: string;
    topic_id: string;
    title: string;
    estimated_minutes: number;
    question_count: number;
    sort_order: number;
  }[] = [];

  let ti = 0;
  for (let d = 0; d < totalDays; d++) {
    const day = addDays(today, d).toISOString().slice(0, 10);
    for (let k = 0; k < perDay; k++) {
      const topic = ordered[ti % ordered.length];
      ti++;
      const subj = topic.subjects as { name: string } | null;
      items.push({
        plan_id: plan.id,
        day,
        subject_id: topic.subject_id,
        topic_id: topic.id,
        title: `${subj?.name ?? "Practice"}: ${topic.name}`,
        estimated_minutes: 25,
        question_count: 10,
        sort_order: k,
      });
    }
  }

  await supabase.from("study_plan_items").insert(items);
  await logEvent("study_plan_generated", { intensity, days: totalDays });

  revalidatePath("/plan");
  return { ok: true };
}

export async function togglePlanItem(itemId: string, completed: boolean) {
  await requireUser();
  const supabase = await createClient();
  await supabase
    .from("study_plan_items")
    .update({ completed })
    .eq("id", itemId);
  revalidatePath("/plan");
  return { ok: true };
}
