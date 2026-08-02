"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/actions/analytics";
import type { ConfidenceRating } from "@/lib/types";

export async function toggleBookmark(questionId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("bookmarks")
    .select("question_id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("question_id", questionId);
    revalidatePath("/bookmarks");
    return { bookmarked: false };
  }

  await supabase
    .from("bookmarks")
    .insert({ user_id: user.id, question_id: questionId });
  await logEvent("question_bookmarked", { question_id: questionId });
  revalidatePath("/bookmarks");
  return { bookmarked: true };
}

export async function addMistake(questionId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("questions")
    .select("topic_id")
    .eq("id", questionId)
    .single();
  await supabase.from("mistakes").upsert(
    {
      user_id: user.id,
      question_id: questionId,
      topic_id: q?.topic_id ?? null,
      resolved: false,
      resolved_at: null,
    },
    { onConflict: "user_id,question_id" },
  );
  await logEvent("question_marked_incorrect", { question_id: questionId });
  revalidatePath("/mistakes");
  return { ok: true };
}

export async function resolveMistake(questionId: string, resolved = true) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("mistakes")
    .update({
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("user_id", user.id)
    .eq("question_id", questionId);
  revalidatePath("/mistakes");
  return { ok: true };
}

export async function removeMistake(questionId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("mistakes")
    .delete()
    .eq("user_id", user.id)
    .eq("question_id", questionId);
  revalidatePath("/mistakes");
  return { ok: true };
}

export async function saveNote(questionId: string, body: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("notes")
    .select("id")
    .eq("user_id", user.id)
    .eq("question_id", questionId)
    .maybeSingle();

  if (!body.trim()) {
    if (existing) await supabase.from("notes").delete().eq("id", existing.id);
    return { ok: true };
  }

  if (existing) {
    await supabase.from("notes").update({ body }).eq("id", existing.id);
  } else {
    await supabase
      .from("notes")
      .insert({ user_id: user.id, question_id: questionId, body });
  }
  return { ok: true };
}

export async function rateQuestion(
  questionId: string,
  confidence: ConfidenceRating,
  timeSpent = 0,
) {
  const user = await requireUser();
  const supabase = await createClient();
  const isCorrect = confidence !== "wrong";

  await supabase.from("question_attempts").insert({
    user_id: user.id,
    question_id: questionId,
    confidence,
    is_correct: isCorrect,
    time_spent_seconds: timeSpent,
  });

  if (confidence === "wrong" || confidence === "difficult") {
    await addMistake(questionId);
  }

  await logEvent("question_completed", { question_id: questionId, confidence });
  return { ok: true, isCorrect };
}
