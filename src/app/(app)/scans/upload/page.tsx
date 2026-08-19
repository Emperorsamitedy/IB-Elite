import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScanMarker } from "@/components/scans/scan-marker";

export const metadata = { title: "Scan a written answer" };

export default async function ScanUploadPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, title, prompt, marks, subjects(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Scan your answer
        </h1>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Upload a photo and we mark it against the mark scheme
        </p>
      </div>
      <ScanMarker
        questions={(questions ?? []).map((question) => {
          const subject = Array.isArray(question.subjects)
            ? question.subjects[0]
            : question.subjects;
          return {
            id: question.id,
            label: `${subject?.name ?? "Question"} · ${
              question.title ?? question.prompt.slice(0, 60)
            } [${question.marks}]`,
          };
        })}
      />
    </div>
  );
}
