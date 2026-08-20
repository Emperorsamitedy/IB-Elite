import { describe, expect, it, vi, beforeEach } from "vitest";

const QUESTION = "33333333-3333-4333-8333-333333333333";
const CONVERSATION = "44444444-4444-4444-8444-444444444444";

const tutorReply = vi.fn(async (params: unknown) => {
  void params;
  return "hint";
});
const assistantReply = vi.fn(
  async (params: { context: string; message: string }) => {
    void params;
    return "assistant answer";
  },
);
const inserted: { table: string; row: unknown }[] = [];

let questionRow: Record<string, unknown> | null;
let aiEnabled: boolean;
let isPro: boolean;
let messagesUsedToday: number;

class AiUnavailableError extends Error {}

function mockModules() {
  vi.doMock("@/lib/env", () => ({
    get featureFlags() {
      return { ai: aiEnabled, stripe: false };
    },
    serverEnv: { openaiApiKey: "", openaiModel: "gpt-4o-mini" },
  }));

  vi.doMock("@/lib/ai", () => ({
    generateTutorReply: tutorReply,
    generateAssistantReply: assistantReply,
    AiUnavailableError,
  }));

  vi.doMock("@/lib/subscription", () => ({
    getEntitlement: async () => ({ plan: isPro ? "pro" : "free", isPro }),
    FREE_LIMITS: { aiMessagesPerDay: 10 },
  }));

  vi.doMock("@/lib/assistant-context", () => ({
    loadStudyContext: async () => ({
      subjects: ["Physics HL"],
      weakTopics: ["Kinematics"],
      unresolvedMistakes: 2,
    }),
  }));

  vi.doMock("@/lib/supabase/server", () => ({
    createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: (table: string) => {
        const builder = {
          select: (_cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) {
              // Rate-limit count query.
              return {
                in: () => ({
                  eq: () => ({
                    gte: async () => ({ count: messagesUsedToday }),
                  }),
                }),
              };
            }
            return {
              eq: () => ({
                eq: () => ({ single: async () => ({ data: questionRow }) }),
                order: () => ({ limit: async () => ({ data: [] }) }),
                // Awaited directly by the rate-limit lookup.
                async then(resolve: (v: unknown) => void) {
                  resolve({ data: [{ id: CONVERSATION }] });
                },
              }),
            };
          },
          insert: (row: unknown) => {
            inserted.push({ table, row });
            return {
              select: () => ({
                single: async () => ({ data: { id: CONVERSATION } }),
              }),
              async then(resolve: (v: unknown) => void) {
                resolve({ data: null, error: null });
              },
            };
          },
        };
        return builder;
      },
    }),
  }));
}

function req(body: unknown) {
  return new Request("http://localhost/api/tutor", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/tutor", () => {
  beforeEach(() => {
    vi.resetModules();
    tutorReply.mockClear();
    assistantReply.mockClear();
    inserted.length = 0;
    aiEnabled = true;
    isPro = true;
    messagesUsedToday = 0;
    questionRow = {
      id: QUESTION,
      prompt: "Find dy/dx",
      answer: "2x",
      solution: "Differentiate term by term.",
      difficulty: "medium",
      topics: { name: "Calculus", subjects: { name: "Maths AA HL" } },
    };
    mockModules();
  });

  // Regression: making questionId optional must not change the existing
  // per-question Tutor sheet in any way.
  it("still routes a question payload through the hint-ladder tutor", async () => {
    const { POST } = await import("@/app/api/tutor/route");
    const res = await POST(
      req({ questionId: QUESTION, message: "help", hintLevel: 0 }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(assistantReply).not.toHaveBeenCalled();
    expect(tutorReply).toHaveBeenCalledTimes(1);
    expect(tutorReply).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({
          prompt: "Find dy/dx",
          answer: "2x",
          solution: "Differentiate term by term.",
          topic: "Calculus",
          subject: "Maths AA HL",
        }),
        hintLevel: 0,
      }),
    );
    expect(body.hintLevel).toBe(1);
    expect(body.reply).toBe("hint");
  });

  it("reuses an existing conversation rather than opening another", async () => {
    const { POST } = await import("@/app/api/tutor/route");
    await POST(
      req({
        questionId: QUESTION,
        conversationId: CONVERSATION,
        message: "help",
      }),
    );
    expect(
      inserted.filter((i) => i.table === "ai_conversations"),
    ).toHaveLength(0);
  });

  it("still 404s an unknown question instead of answering generally", async () => {
    questionRow = null;
    const { POST } = await import("@/app/api/tutor/route");
    const res = await POST(req({ questionId: QUESTION, message: "help" }));

    expect(res.status).toBe(404);
    expect(assistantReply).not.toHaveBeenCalled();
    expect(tutorReply).not.toHaveBeenCalled();
  });

  it("answers from page context when no question is in view", async () => {
    const { POST } = await import("@/app/api/tutor/route");
    const res = await POST(
      req({
        message: "what should I revise?",
        context: {
          page: "Practice session",
          subject: "Physics HL",
          topic: "Kinematics",
          detail: "Question 3 of 10",
        },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(tutorReply).not.toHaveBeenCalled();
    expect(assistantReply).toHaveBeenCalledTimes(1);
    const context = assistantReply.mock.calls[0][0].context;
    expect(context).toContain("Practice session");
    expect(context).toContain("Kinematics");
    expect(context).toContain("Unresolved mistakes in their notebook: 2");
    expect(body.reply).toBe("assistant answer");
  });

  // The launch gate: no model, no assistant — and no canned stand-in either.
  it("503s the assistant when no AI provider is configured", async () => {
    aiEnabled = false;
    const { POST } = await import("@/app/api/tutor/route");
    const res = await POST(req({ message: "hello" }));

    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "ai_unavailable" });
    expect(assistantReply).not.toHaveBeenCalled();
    expect(tutorReply).not.toHaveBeenCalled();
  });

  it("503s rather than replying when the provider fails mid-request", async () => {
    assistantReply.mockRejectedValueOnce(new AiUnavailableError("no quota"));
    const { POST } = await import("@/app/api/tutor/route");
    const res = await POST(req({ message: "hello" }));

    expect(res.status).toBe(503);
    expect(
      inserted.filter((i) => i.table === "ai_messages"),
    ).toHaveLength(0);
  });

  it("429s a free student at the daily limit on both paths", async () => {
    isPro = false;
    messagesUsedToday = 10;
    const { POST } = await import("@/app/api/tutor/route");

    const withQuestion = await POST(
      req({ questionId: QUESTION, message: "help" }),
    );
    const withoutQuestion = await POST(req({ message: "help" }));

    expect(withQuestion.status).toBe(429);
    expect(withoutQuestion.status).toBe(429);
    expect(tutorReply).not.toHaveBeenCalled();
    expect(assistantReply).not.toHaveBeenCalled();
  });
});
