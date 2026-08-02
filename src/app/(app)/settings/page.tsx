import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const [{ data: prefs }, { data: subjects }, { data: userSubjects }, { data: exams }] =
    await Promise.all([
      supabase
        .from("user_preferences")
        .select("intensity, daily_target, reduce_motion")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("subjects").select("id, name, group_name").order("sort_order"),
      supabase.from("user_subjects").select("subject_id").eq("user_id", user.id),
      supabase
        .from("exam_dates")
        .select("id, exam_date, subjects(name)")
        .eq("user_id", user.id)
        .order("exam_date"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your profile, subjects and revision preferences.
        </p>
      </div>

      <SettingsView
        profile={{
          fullName: profile?.full_name ?? "",
          email: user.email ?? "",
        }}
        preferences={{
          intensity: prefs?.intensity ?? "balanced",
          dailyTarget: prefs?.daily_target ?? 15,
          reduceMotion: prefs?.reduce_motion ?? false,
        }}
        subjects={subjects ?? []}
        userSubjectIds={(userSubjects ?? []).map((u) => u.subject_id)}
        exams={(exams ?? []).map((e) => ({
          id: e.id,
          subjectName:
            (e.subjects as { name: string } | null)?.name ?? "Exam",
          date: e.exam_date,
        }))}
      />

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Billing & subscription</p>
              <p className="text-xs text-muted-foreground">
                Manage your plan and payment details.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings/billing">Manage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
