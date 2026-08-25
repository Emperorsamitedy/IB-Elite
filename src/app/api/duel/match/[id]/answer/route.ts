import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { submitAnswer } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { duelErrorResponse, requireUser } from "../../../util";
import { rateLimitOk, RATE_LIMITED_MESSAGE } from "@/lib/anti-abuse";

const bodySchema = z.object({
  questionIndex: z.number().int().min(0).max(50),
  answer: z.string().max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await rateLimitOk("duelAnswer", user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const result = await submitAnswer(
      createSupabaseDuelStore(),
      {
        matchId: id,
        userId: user.id,
        questionIndex: parsed.data.questionIndex,
        answer: parsed.data.answer,
      },
      new Date(),
    );
    return NextResponse.json(result);
  } catch (error) {
    return duelErrorResponse(error);
  }
}
