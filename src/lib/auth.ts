import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
});

/** Redirects to /login if there is no session. Returns the user. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Ensures the user has finished onboarding; otherwise redirects there. */
export async function requireOnboardedProfile() {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile?.onboarded) redirect("/onboarding");
  return { user, profile };
}

export async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/app");
  return profile;
}
