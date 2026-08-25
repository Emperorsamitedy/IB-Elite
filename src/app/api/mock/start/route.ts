import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { startEntry } from "@/lib/mock/service";
import { createSupabaseMockStore } from "@/lib/mock/supabase-store";
import { logEvent } from "@/lib/actions/analytics";
import { rateLimitOk, RATE_LIMITED_MESSAGE } from "@/lib/anti-abuse";
import { mockErrorResponse, requireMockUser } from "../util";

const schema = z.object({ sittingId: z.string().uuid() });

/** Release-at-the-bell: the paper body only ever leaves through here. */
export async function POST(request: NextRequest) {
  const gate = await requireMockUser();
  if ("error" in gate) return gate.error;
  if (!(await rateLimitOk("mockAction", gate.user.id))) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const { entry, paper, deadline } = await startEntry(
      createSupabaseMockStore(),
      { sittingId: parsed.data.sittingId, userId: gate.user.id },
      new Date(),
    );
    await logEvent("mock_started", { sittingId: parsed.data.sittingId });
    return NextResponse.json({
      entry,
      deadline,
      paper: {
        title: paper.title,
        body: paper.body,
        durationMinutes: paper.duration_minutes,
      },
    });
  } catch (error) {
    return mockErrorResponse(error);
  }
}
