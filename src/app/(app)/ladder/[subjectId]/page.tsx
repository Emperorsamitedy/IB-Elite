import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LadderMatchup } from "./ladder-matchup";

export const metadata = { title: "World Ladder" };

export default async function LadderPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) notFound();

  return (
    <LadderMatchup
      studentId={user.id}
      subjectId={subject.id}
      subjectName={subject.name}
      pusherKey={process.env.PUSHER_KEY ?? ""}
      pusherCluster={process.env.PUSHER_CLUSTER ?? ""}
    />
  );
}
