import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PracticeCreator } from "@/components/practice/practice-creator";

export const metadata = { title: "New practice session" };

export default async function PracticePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: subjects }, { data: userSubjects }] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, slug, name, topics(id, name, slug)")
      .order("sort_order"),
    supabase
      .from("user_subjects")
      .select("subject_id")
      .eq("user_id", user.id),
  ]);

  const mine = new Set((userSubjects ?? []).map((u) => u.subject_id));
  const ordered = (subjects ?? []).sort((a, b) => {
    const am = mine.has(a.id) ? 0 : 1;
    const bm = mine.has(b.id) ? 0 : 1;
    return am - bm;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Build a practice session
        </h1>
        <p className="mt-1 text-muted-foreground">
          Pick what to focus on. Start practising in seconds.
        </p>
      </div>
      <PracticeCreator subjects={ordered} />
    </div>
  );
}
