import { createClient } from "@/lib/supabase/server";

/**
 * A student may only touch their own schedule; admins may touch anyone's.
 */
export async function authorizeStudent(studentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  if (user.id === studentId) return { userId: user.id };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: "Forbidden", status: 403 as const };
  }
  return { userId: user.id };
}
