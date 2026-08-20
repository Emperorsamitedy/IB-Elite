import "server-only";
import OpenAI from "openai";
import { serverEnv, featureFlags } from "@/lib/env";

export type TutorQuestion = {
  prompt: string;
  answer: string | null;
  solution: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string;
};

const HINT_LADDER_SYSTEM = `You are Atlas, a patient IB revision tutor. You help students understand questions through the Socratic method.

Rules:
- Never give the full final answer unless the student has already made a genuine attempt AND explicitly asks, or the hint level is 3+.
- Give ONE progressive hint at a time. Each reply should move the student one small step forward.
- Reference the underlying concept and method, not just the numbers.
- Keep replies concise (2-4 sentences). Encourage the student.
- If the student is clearly stuck, offer the next concrete step.
- Use plain language. Format any maths inline with simple notation.`;

export function buildTutorContext(q: TutorQuestion, hintLevel: number) {
  return `Question (${q.subject ?? "IB"} · ${q.topic ?? "topic"} · ${q.difficulty}):
"""
${q.prompt}
"""
${q.answer ? `Correct answer (never reveal verbatim unless appropriate): ${q.answer}` : ""}
${q.solution ? `Worked solution (use to guide, do not paste wholesale): ${q.solution}` : ""}

Current hint level: ${hintLevel} (0 = gentle nudge, 3 = detailed walkthrough).`;
}

export async function generateTutorReply(params: {
  question: TutorQuestion;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  hintLevel: number;
}): Promise<string> {
  if (featureFlags.ai && serverEnv.openaiApiKey) {
    try {
      const client = new OpenAI({ apiKey: serverEnv.openaiApiKey });
      const completion = await client.chat.completions.create({
        model: serverEnv.openaiModel,
        temperature: 0.4,
        max_tokens: 350,
        messages: [
          { role: "system", content: HINT_LADDER_SYSTEM },
          {
            role: "system",
            content: buildTutorContext(params.question, params.hintLevel),
          },
          ...params.history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          { role: "user", content: params.message },
        ],
      });
      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
    } catch {
      // fall through to heuristic tutor
    }
  }

  return heuristicHint(params.question, params.hintLevel);
}

const ASSISTANT_SYSTEM = `You are Atlas, an IB revision assistant embedded in the student's revision app. You can be opened from any screen, so always ground your reply in the screen context you are given.

Rules:
- Use the context block: refer to the subject, topic or question the student is actually looking at rather than asking them where they are.
- Answer the question they asked. General study, planning and concept questions are all in scope, not just hints.
- When a specific exam question is in view, coach rather than hand over the answer.
- Be concise (2-5 sentences unless they ask for a walkthrough) and concrete.
- If you genuinely don't have the information, say so plainly instead of inventing IB specifics.`;

/**
 * Thrown when the assistant cannot produce a genuine model reply. The dock
 * never substitutes canned text for a real answer: a student must not be shown
 * scripted copy under an "AI" label.
 */
export class AiUnavailableError extends Error {
  constructor(message = "AI provider unavailable") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Free-form assistant reply for the floating dock. Unlike `generateTutorReply`
 * this needs no question — the grounding is the screen the student is on.
 *
 * Throws `AiUnavailableError` rather than falling back to a heuristic.
 */
export async function generateAssistantReply(params: {
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}): Promise<string> {
  if (!featureFlags.ai || !serverEnv.openaiApiKey) {
    throw new AiUnavailableError("No AI provider is configured.");
  }

  const client = new OpenAI({ apiKey: serverEnv.openaiApiKey });
  const completion = await client.chat.completions
    .create({
      model: serverEnv.openaiModel,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM },
        { role: "system", content: params.context },
        ...params.history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: params.message },
      ],
    })
    .catch((error: unknown) => {
      throw new AiUnavailableError(
        error instanceof Error ? error.message : "AI request failed.",
      );
    });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new AiUnavailableError("Empty reply from the AI provider.");
  return text;
}

/**
 * Deterministic fallback tutor used when no AI provider is configured. Produces
 * genuinely useful, progressively-more-detailed guidance derived from the
 * question's own solution metadata.
 */
export function heuristicHint(q: TutorQuestion, hintLevel: number): string {
  const topic = q.topic ?? "this topic";
  const solutionSteps = (q.solution ?? "")
    .split(/\n|(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (Math.min(hintLevel, 3)) {
    case 0:
      return `Let's break it down. First, identify exactly what the question is asking and which ${topic} concept applies. What information are you given, and what are you trying to find?`;
    case 1:
      return solutionSteps[0]
        ? `Good — here's a nudge in the right direction: ${solutionSteps[0]}. Try taking that first step yourself before moving on.`
        : `Think about the standard method for ${topic}. Write down the relevant formula or definition first, then substitute what you know.`;
    case 2:
      return solutionSteps[1]
        ? `You're close. The next step is: ${solutionSteps.slice(0, 2).join(" ")} Keep going from there.`
        : `Set up your working step by step. Substitute the given values into the formula and simplify carefully — check your units and signs as you go.`;
    default:
      return q.solution
        ? `Here's the full method:\n\n${q.solution}${q.answer ? `\n\nFinal answer: ${q.answer}` : ""}\n\nGo back through each line and make sure you understand *why* each step follows.`
        : q.answer
          ? `The key result is: ${q.answer}. Work backwards from it to see how each step connects, and note where you got stuck for next time.`
          : `Review the underlying concept for ${topic}, then re-attempt from the first principle. Save this question to revisit later.`;
  }
}
