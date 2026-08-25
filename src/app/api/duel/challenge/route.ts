import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createDuelChallenge } from "@/lib/duel/service";
import { createSupabaseDuelStore } from "@/lib/duel/supabase-store";
import { env } from "@/lib/env";
import {
  ipHashFromHeaders,
  rateLimitOk,
  RATE_LIMITED_MESSAGE,
} from "@/lib/anti-abuse";
import { duelErrorResponse, requireUser, track } from "../util";

const bodySchema = z.object({
  subjectId: z.string().uuid(),
  mode: z.enum(["ranked", "friendly"]).default("friendly"),
  opponentId: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await rateLimitOk("challengeCreate", user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const { token } = await createDuelChallenge(createSupabaseDuelStore(), {
      creatorId: user.id,
      subjectId: parsed.data.subjectId,
      mode: parsed.data.mode,
      opponentId: parsed.data.opponentId ?? null,
      token: randomBytes(16).toString("hex"),
      ipHash: ipHashFromHeaders(request.headers),
    });
    await track("challenge_created", user.id, {
      subjectId: parsed.data.subjectId,
      mode: parsed.data.mode,
      direct: Boolean(parsed.data.opponentId),
    });
    return NextResponse.json({
      token,
      url: `${env.siteUrl}/duel/challenge/${token}`,
    });
  } catch (error) {
    return duelErrorResponse(error);
  }
}
