import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileNav } from "@/components/app/mobile-nav";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { AssistantProvider } from "@/components/assistant/assistant-provider";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { redirect } from "next/navigation";
import { requireUser, getProfile } from "@/lib/auth";
import { featureFlags } from "@/lib/env";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile?.onboarded) redirect("/onboarding");
  const isAdmin = profile.role === "admin";

  return (
    <AssistantProvider>
      <div className="min-h-dvh">
        <AppSidebar isAdmin={isAdmin} />
        <div className="md:pl-60">
          <AppTopbar
            name={profile?.full_name ?? null}
            email={user.email ?? null}
            avatarUrl={profile?.avatar_url ?? null}
          />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
            {children}
          </main>
        </div>
        <MobileNav />
        <CommandPalette />
        {/* Only offered when a real model can answer — never a canned stand-in. */}
        {featureFlags.ai && <AssistantDock />}
      </div>
    </AssistantProvider>
  );
}
