import { Bookmark } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/misc";
import { StartSessionButton } from "@/components/app/start-session-button";
import {
  BookmarkList,
  type BookmarkRow,
} from "@/components/library/bookmark-list";

export const metadata = { title: "Bookmarks" };

export default async function BookmarksPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("bookmarks")
    .select("question_id, created_at, questions(prompt, difficulty, topics(name))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items: BookmarkRow[] = (data ?? [])
    .map((b) => {
      const q = b.questions as {
        prompt: string;
        difficulty: BookmarkRow["difficulty"];
        topics: { name: string } | null;
      } | null;
      if (!q) return null;
      return {
        questionId: b.question_id,
        prompt: q.prompt,
        difficulty: q.difficulty,
        topicName: q.topics?.name ?? null,
      };
    })
    .filter((x): x is BookmarkRow => x !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Bookmarks</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length > 0
              ? `${items.length} saved question${items.length === 1 ? "" : "s"}.`
              : "Save questions to revisit them anytime."}
          </p>
        </div>
        {items.length > 0 && (
          <StartSessionButton
            input={{ onlyBookmarked: true, count: Math.min(items.length, 15) }}
          >
            Practise bookmarks
          </StartSessionButton>
        )}
      </div>

      {items.length > 0 ? (
        <BookmarkList items={items} />
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Tap the bookmark icon on any question to save it here for later."
        />
      )}
    </div>
  );
}
