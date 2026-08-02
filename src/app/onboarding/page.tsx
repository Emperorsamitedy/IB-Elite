import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata = { title: "Set up your revision space" };

export default async function OnboardingPage() {
  await requireUser();
  const profile = await getProfile();
  if (profile?.onboarded) redirect("/app");

  const supabase = await createClient();
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, slug, name, group_name, color, levels(id, code, name)")
    .order("sort_order");

  return (
    <OnboardingFlow
      firstName={profile?.full_name?.split(" ")[0] ?? null}
      subjects={subjects ?? []}
    />
  );
}
