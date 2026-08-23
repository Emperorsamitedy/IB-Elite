import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { DuelError } from "@/lib/duel/service";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export function duelErrorResponse(error: unknown) {
  if (error instanceof DuelError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Server-side analytics that also works for logged-out visitors. */
export async function track(
  name: string,
  userId: string | null,
  props: Record<string, Json> = {},
) {
  try {
    await createAdminClient()
      .from("analytics_events")
      .insert({ user_id: userId, name, props });
  } catch {
    // analytics must never break a flow
  }
}
