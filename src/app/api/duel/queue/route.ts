import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { queueForDuel, tryPair } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import {
  ipHashFromHeaders,
  rateLimitOk,
  RATE_LIMITED_MESSAGE,
} from "@/lib/anti-abuse";
import { duelErrorResponse, requireUser, track } from "../util";

const bodySchema = z.object({
  subjectId: z.string().uuid(),
  mode: z.enum(["ranked", "friendly"]).default("ranked"),
});

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await rateLimitOk("duelQueue", user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const outcome = await queueForDuel(
      createSupabaseDuelStore(),
      {
        userId: user.id,
        subjectId: parsed.data.subjectId,
        mode: parsed.data.mode,
        ipHash: ipHashFromHeaders(request.headers),
      },
      new Date(),
    );
    await track("duel_queued", user.id, {
      subjectId: parsed.data.subjectId,
      mode: parsed.data.mode,
      matched: outcome.status === "matched",
    });
    return NextResponse.json(outcome);
  } catch (error) {
    return duelErrorResponse(error);
  }
}

/** Poll while waiting: re-runs pairing so widening windows eventually meet. */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }
  try {
    const outcome = await tryPair(
      createSupabaseDuelStore(),
      user.id,
      subjectId,
      new Date(),
    );
    return NextResponse.json(outcome);
  } catch (error) {
    return duelErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }
  await createSupabaseDuelStore().dequeue(user.id, subjectId);
  return NextResponse.json({ ok: true });
}
