import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement, FREE_LIMITS } from "@/lib/subscription";
import {
  generateTutorReply,
  generateAssistantReply,
  AiUnavailableError,
} from "@/lib/ai";
import { featureFlags } from "@/lib/env";
import {
  buildAssistantContext,
  DEFAULT_PAGE_CONTEXT,
  type PageContext,
} from "@/lib/assistant";
import { loadStudyContext } from "@/lib/assistant-context";

const pageContextSchema = z.object({
  page: z.string().min(1).max(80),
  path: z.string().max(200).optional(),
  subject: z.string().max(120).nullish(),
  topic: z.string().max(120).nullish(),
  detail: z.string().max(200).nullish(),
});

const bodySchema = z.object({
  // Optional: the floating assistant is reachable from screens that have no
  // question at all.
  questionId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  hintLevel: z.number().int().min(0).max(4).default(0),
  context: pageContextSchema.optional(),
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

  // No question in view: answer from the screen the student is on.
  if (!questionId) {
    // The assistant is only offered when a real model can answer. It must never
    // dress scripted copy up as an AI reply.
    if (!featureFlags.ai) {
      return NextResponse.json(
        {
          error: "ai_unavailable",
          message: "The AI assistant isn't available right now.",
        },
        { status: 503 },
      );
    }

    const page: PageContext = parsed.data.context ?? DEFAULT_PAGE_CONTEXT;
    const study = await loadStudyContext(supabase, user.id);

    if (!conversationId) {
      const { data: conv } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: page.page })
        .select("id")
        .single();
      conversationId = conv?.id;
    }

    const priorMessages = conversationId
      ? ((
          await supabase
            .from("ai_messages")
            .select("role, content")
            .eq("conversation_id", conversationId)
            .order("created_at")
            .limit(20)
        ).data ?? [])
      : [];

    let reply: string;
    try {
      reply = await generateAssistantReply({
        context: buildAssistantContext(page, study),
        history: priorMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        message,
      });
    } catch (error) {
      if (error instanceof AiUnavailableError) {
        return NextResponse.json(
          {
            error: "ai_unavailable",
            message: "The AI assistant isn't available right now.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    if (conversationId) {
      await supabase.from("ai_messages").insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: message,
          hint_level: hintLevel,
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          hint_level: hintLevel,
        },
      ]);
    }

    return NextResponse.json({
      conversationId,
      reply,
      hintLevel,
      source: "model",
      remaining: entitlement.isPro
        ? null
        : Math.max(0, FREE_LIMITS.aiMessagesPerDay - usedToday - 1),
    });
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

  const { reply, source } = await generateTutorReply({
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
    source,
    hintLevel: nextHint,
    remaining: entitlement.isPro
      ? null
      : Math.max(0, FREE_LIMITS.aiMessagesPerDay - usedToday - 1),
  });
}
