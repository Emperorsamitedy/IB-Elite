import Link from "next/link";
import { notFound } from "next/navigation";
import { Binoculars } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { ScoutSearch } from "@/components/scout/scout-search";

export const metadata = { title: "Scout portal" };

/**
 * Institutional portal (feature-flagged off at launch). Search covers
 * opted-in public Signal profiles only, results stay pseudonymous, and
 * identities move only through student-approved contact requests. Every
 * action lands in the immutable institution audit log.
 */
export default async function ScoutPortalPage() {
  if (!(await getFlag("scout_portal"))) notFound();
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("institution_members")
    .select("institution_id, institutions!inner(name, approved)")
    .eq("user_id", user.id)
    .maybeSingle();
  const institution = membership?.institutions as unknown as {
    name: string;
    approved: boolean;
  } | null;
  if (!institution?.approved) notFound();

  const [{ data: subjects }, { data: approved }] = await Promise.all([
    admin.from("subjects").select("id, name").order("sort_order"),
    admin
      .from("contact_requests")
      .select("student_id, responded_at, profiles:student_id(full_name, display_name)")
      .eq("institution_id", membership!.institution_id)
      .eq("status", "approved"),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {institution.name}
        </span>
      </div>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Binoculars className="h-5 w-5 text-accent" /> Scout portal
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pseudonymous Signal search over students who opted in. Identity is
          revealed only when a student approves your contact request. All
          activity is audited.
        </p>
      </div>

      <ScoutSearch subjects={subjects ?? []} />

      {(approved ?? []).length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 py-5">
            <h2 className="text-sm font-semibold">Approved connections</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {(approved ?? []).map((row) => {
                const person = row.profiles as unknown as {
                  full_name: string | null;
                  display_name: string;
                };
                return (
                  <li key={row.student_id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {person.full_name ?? person.display_name}
                    </span>{" "}
                    · approved{" "}
                    {row.responded_at
                      ? new Date(row.responded_at).toLocaleDateString()
                      : ""}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
