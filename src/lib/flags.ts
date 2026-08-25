import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-checked rollout flags (`app_flags` table). Defaults to OFF when the
 * row is missing so a half-run migration can never expose an unfinished
 * pillar.
 */
export const getFlag = cache(async (key: string): Promise<boolean> => {
  const { data } = await createAdminClient()
    .from("app_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return data?.enabled ?? false;
});
