import { AlertCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/misc";
import { StartSessionButton } from "@/components/app/start-session-button";
import {
  MistakeList,
  type MistakeRow,
} from "@/components/library/mistake-list";

export const metadata = { title: "Mistake notebook" };

export default async function MistakesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("mistakes")
    .select(
      "question_id, resolved, created_at, questions(prompt, topics(name))",
    )
    .eq("user_id", user.id)
    .order("resolved")
    .order("created_at", { ascending: false });

  const items: MistakeRow[] = (data ?? [])
    .map((m) => {
      const q = m.questions as {
        prompt: string;
        topics: { name: string } | null;
      } | null;
      if (!q) return null;
      return {
        questionId: m.question_id,
        prompt: q.prompt,
        topicName: q.topics?.name ?? null,
        resolved: m.resolved,
      };
    })
    .filter((x): x is MistakeRow => x !== null);

  const openCount = items.filter((i) => !i.resolved).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Mistake notebook
          </h1>
          <p className="mt-1 text-muted-foreground">
            {openCount > 0
              ? `${openCount} question${openCount === 1 ? "" : "s"} to master.`
              : "Every question you get wrong lands here to revisit."}
          </p>
        </div>
        {openCount > 0 && (
          <StartSessionButton
            input={{ includeMistakes: true, count: Math.min(openCount, 15), mode: "mistakes" }}
          >
            Practise my mistakes
          </StartSessionButton>
        )}
      </div>

      {items.length > 0 ? (
        <MistakeList items={items} />
      ) : (
        <EmptyState
          icon={AlertCircle}
          title="No mistakes yet"
          description="As you practise, questions you find difficult or get wrong will appear here so you can master them."
        />
      )}
    </div>
  );
}
