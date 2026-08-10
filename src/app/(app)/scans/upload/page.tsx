import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ScanUploader } from "./scan-uploader";

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
    <ScanUploader
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
  );
}
