import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  QuestionForm,
  type AdminSubject,
} from "@/components/admin/question-form";

export const metadata = { title: "New question" };

export default async function NewQuestionPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("subjects")
    .select("id, name, levels(id, code, name), topics(id, name)")
    .order("sort_order");

  const subjects = (data ?? []) as AdminSubject[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/admin/questions" className="hover:text-foreground">
          Questions
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">New</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight">New question</h1>
      <QuestionForm subjects={subjects} />
    </div>
  );
}
