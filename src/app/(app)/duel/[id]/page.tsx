import { requireUser } from "@/lib/auth";
import { DuelRunner } from "@/components/duel/duel-runner";
import { messages } from "@/lib/i18n/en";

export const metadata = { title: messages.duel.title };

export default async function DuelMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {messages.duel.title}
      </h1>
      <DuelRunner matchId={id} />
    </div>
  );
}
