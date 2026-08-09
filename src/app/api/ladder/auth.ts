import { createClient } from "@/lib/supabase/server";

/** A player may only act as themselves. */
export async function authorizeSelf(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  if (user.id !== studentId) return { error: "Forbidden", status: 403 as const };
  return { userId: user.id };
}
