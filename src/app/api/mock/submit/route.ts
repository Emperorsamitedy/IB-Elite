import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { submitEntry } from "@/lib/mock/service";
import { createSupabaseMockStore } from "@/lib/mock/supabase-store";
import { logEvent } from "@/lib/actions/analytics";
import { rateLimitOk, RATE_LIMITED_MESSAGE } from "@/lib/anti-abuse";
import { mockErrorResponse, requireMockUser } from "../util";

const schema = z.object({ sittingId: z.string().uuid() });

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
    const entry = await submitEntry(
      createSupabaseMockStore(),
      { sittingId: parsed.data.sittingId, userId: gate.user.id },
      new Date(),
    );
    await logEvent("mock_submitted", {
      sittingId: parsed.data.sittingId,
      late: entry.status === "late",
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return mockErrorResponse(error);
  }
}
