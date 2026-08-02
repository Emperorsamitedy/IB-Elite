"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Records a product analytics event for the current user. Best-effort —
 * failures never block the calling action.
 */
export async function logEvent(
  name: string,
  props: Record<string, Json> = {},
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("analytics_events").insert({
      user_id: user?.id ?? null,
      name,
      props,
    });
  } catch {
    // swallow — analytics must never break a user flow
  }
}
