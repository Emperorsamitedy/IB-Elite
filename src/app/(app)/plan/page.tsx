import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  PlanGenerator,
  PlanDay,
  type PlanItem,
} from "@/components/plan/plan-view";

export const metadata = { title: "Study plan" };

export default async function PlanPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("study_plans")
    .select("id, title, intensity, start_date, end_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let itemsByDay: [string, PlanItem[]][] = [];
  if (plan) {
    const { data: items } = await supabase
      .from("study_plan_items")
      .select(
        "id, day, title, subject_id, topic_id, question_count, estimated_minutes, completed, sort_order",
      )
      .eq("plan_id", plan.id)
      .order("day")
      .order("sort_order");

    const map = new Map<string, PlanItem[]>();
    for (const it of items ?? []) {
      const row: PlanItem = {
        id: it.id,
        day: it.day,
        title: it.title,
        subjectId: it.subject_id,
        topicId: it.topic_id,
        questionCount: it.question_count,
        estimatedMinutes: it.estimated_minutes,
        completed: it.completed,
      };
      const arr = map.get(it.day) ?? [];
      arr.push(row);
      map.set(it.day, arr);
    }
    itemsByDay = [...map.entries()];
  }

  const completed =
    itemsByDay.reduce(
      (s, [, items]) => s + items.filter((i) => i.completed).length,
      0,
    ) ?? 0;
  const totalItems = itemsByDay.reduce((s, [, items]) => s + items.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Study plan</h1>
        <p className="mt-1 text-muted-foreground">
          {plan
            ? `${completed}/${totalItems} sessions complete.`
            : "A personalised, day-by-day path to your exams."}
        </p>
      </div>

      <PlanGenerator hasPlan={Boolean(plan)} />

      {itemsByDay.length > 0 && (
        <div className="flex flex-col gap-6">
          {itemsByDay.map(([day, items]) => (
            <PlanDay key={day} day={day} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}
