import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AdminGate =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Every /api/admin route funnels through here: anything but an authenticated
 * profile with role 'admin' gets a 403.
 */
export async function requireAdminApi(): Promise<AdminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
