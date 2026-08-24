import { notFound } from "next/navigation";
import { Radio } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFlag } from "@/lib/flags";
import { calibrationAccuracy } from "@/lib/signal/rating";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import {
  CalibrationForm,
  SignalProfileControls,
} from "@/components/signal/signal-controls";
import {
  ContactRequests,
  type ContactRow,
} from "@/components/signal/contact-requests";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: messages.signal.title };

const t = messages.signal;

export default async function SignalPage() {
  if (!(await getFlag("signal"))) notFound();
  const user = await requireUser();
  const admin = createAdminClient();

  const [{ data: ratings }, { data: profile }, { data: reports }] =
    await Promise.all([
      admin
        .from("signal_ratings")
        .select(
          "subject_id, rating, confidence, sample_size, trajectory, verification_tier, subjects(name)",
        )
        .eq("user_id", user.id)
        .order("rating", { ascending: false }),
      admin
        .from("signal_profiles")
        .select("public, show_country, show_trajectory, show_history")
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("calibration_reports")
        .select("predicted_rating, official_grade"),
    ]);

  const accuracy = calibrationAccuracy(reports ?? []);
  const { data: contactRows } = await admin
    .from("contact_requests")
    .select("id, message, created_at, institutions(name)")
    .eq("student_id", user.id)
    .eq("status", "pending");
  const contacts: ContactRow[] = (contactRows ?? []).map((r) => ({
    id: r.id,
    institutionName:
      (r.institutions as unknown as { name?: string })?.name ?? "Institution",
    message: r.message,
    created_at: r.created_at,
  }));
  const subjects = (ratings ?? []).map((r) => ({
    id: r.subject_id,
    name: (r.subjects as unknown as { name?: string })?.name ?? "—",
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Radio className="h-5 w-5 text-accent" /> {t.title}
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {!ratings || ratings.length === 0 ? (
        <EmptyState title={t.title} description={t.empty} />
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 py-6">
            {ratings.map((row) => (
              <div key={row.subject_id} className="flex flex-col gap-1.5">
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
                  <Badge variant="outline">
                    {t.trajectory[row.trajectory as keyof typeof t.trajectory]}
                  </Badge>
                  <span className="text-muted-foreground">
                    {t.confidence}{" "}
                    {Math.round(Number(row.confidence) * 100)}% ·{" "}
                    {row.sample_size} {t.samples}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ContactRequests requests={contacts} />

      <SignalProfileControls
        userId={user.id}
        initial={{
          public: profile?.public ?? false,
          showCountry: profile?.show_country ?? false,
          showTrajectory: profile?.show_trajectory ?? true,
          showHistory: profile?.show_history ?? true,
        }}
      />

      <CalibrationForm subjects={subjects} />

      <p className="text-xs text-muted-foreground">
        {accuracy.withinOne !== null
          ? t.accuracy
              .replace("{pct}", String(accuracy.withinOne))
              .replace("{count}", String(accuracy.count))
          : t.accuracyNone}
      </p>
    </div>
  );
}
