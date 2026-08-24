import { notFound } from "next/navigation";
import Link from "next/link";
import { Radio } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: "Signal profile" };

const t = messages.signal;

/**
 * Public, opt-in Signal profile. Renders the pseudonymous display name and
 * exactly the fields the student ticked — never real names, scanned work,
 * or contact details. Private profiles 404 rather than confirm existence.
 */
export default async function PublicSignalPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  if (!(await getFlag("signal"))) notFound();
  const { userId } = await params;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("signal_profiles")
    .select("public, show_country, show_trajectory, show_history, subject_ids")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.public) notFound();

  const [{ data: person }, { data: ratings }] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name, country")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("signal_ratings")
      .select(
        "subject_id, rating, confidence, sample_size, trajectory, verification_tier, subjects(name)",
      )
      .eq("user_id", userId)
      .order("rating", { ascending: false }),
  ]);

  const visible = (ratings ?? []).filter(
    (r) =>
      profile.subject_ids.length === 0 ||
      profile.subject_ids.includes(r.subject_id),
  );

  return (
    <div className="flex min-h-dvh flex-col items-center gap-8 px-6 py-12">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <Radio className="h-6 w-6 text-accent" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">
              {person?.display_name ?? "Student"}
            </h1>
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {t.title}
              {profile.show_country && person?.country
                ? ` · ${person.country}`
                : ""}
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          visible.map((row) => (
            <div
              key={row.subject_id}
              className="flex flex-col gap-1.5 border-t border-border pt-4 first:border-0 first:pt-0"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">
                  {(row.subjects as unknown as { name?: string })?.name}
                </span>
                <span className="font-mono text-2xl font-black tabular-nums">
                  {Number(row.rating)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant={
                    row.verification_tier === "verified" ? "success" : "outline"
                  }
                >
                  {t.tier[row.verification_tier as keyof typeof t.tier]}
                </Badge>
                {profile.show_trajectory && (
                  <Badge variant="outline">
                    {t.trajectory[row.trajectory as keyof typeof t.trajectory]}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  {t.confidence} {Math.round(Number(row.confidence) * 100)}%
                  {profile.show_history
                    ? ` · ${row.sample_size} ${t.samples}`
                    : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
