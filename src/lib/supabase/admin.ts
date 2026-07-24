import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client that bypasses RLS. NEVER expose to the browser.
 * Use only in trusted server code (webhooks, admin operations, seeding).
 */
export function createAdminClient() {
  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  return createSupabaseClient<Database>(
    env.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
