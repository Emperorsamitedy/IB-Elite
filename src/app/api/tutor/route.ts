import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement, FREE_LIMITS } from "@/lib/subscription";
import { generateTutorReply } from "@/lib/ai";

const bodySchema = z.object({
  questionId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  hintLevel: z.number().int().min(0).max(4).default(0),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { questionId, message, hintLevel } = parsed.data;
  let conversationId = parsed.data.conversationId;

  // Server-side entitlement + rate limiting.
  const entitlement = await getEntitlement(user.id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: convIds } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("user_id", user.id);
  const ids = (convIds ?? []).map((c) => c.id);
  let usedToday = 0;
  if (ids.length > 0) {
    const { count } = await supabase
      .from("ai_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .eq("role", "user")
      .gte("created_at", since);
    usedToday = count ?? 0;
  }
  if (!entitlement.isPro && usedToday >= FREE_LIMITS.aiMessagesPerDay) {
    return NextResponse.json(
      {
        error: "daily_limit",
        message: `You've used your ${FREE_LIMITS.aiMessagesPerDay} free tutor messages today. Upgrade to Pro for unlimited help.`,
      },
      { status: 429 },
    );
  }

  // Load question context.
  const { data: q } = await supabase
    .from("questions")
    .select(
      "id, prompt, answer, solution, difficulty, topics(name, subjects(name))",
    )
    .eq("id", questionId)
    .eq("status", "published")
    .single();
  if (!q) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  const topics = q.topics as {
    name: string;
    subjects: { name: string } | null;
  } | null;

  // Ensure a conversation exists (RLS enforces ownership).
  if (!conversationId) {
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, question_id: questionId })
      .select("id")
      .single();
    if (error || !conv) {
      return NextResponse.json(
        { error: "Could not start conversation." },
        { status: 500 },
      );
    }
    conversationId = conv.id;
  }

  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .limit(20);

  const priorHistory = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    hint_level: hintLevel,
  });

  const reply = await generateTutorReply({
    question: {
      prompt: q.prompt,
      answer: q.answer,
      solution: q.solution,
      difficulty: q.difficulty,
      subject: topics?.subjects?.name ?? null,
      topic: topics?.name ?? null,
    },
    history: priorHistory,
    message,
    hintLevel,
  });

  const nextHint = Math.min(hintLevel + 1, 4);
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply,
    hint_level: nextHint,
  });

  return NextResponse.json({
    conversationId,
    reply,
    hintLevel: nextHint,
    remaining: entitlement.isPro
      ? null
      : Math.max(0, FREE_LIMITS.aiMessagesPerDay - usedToday - 1),
  });
}
