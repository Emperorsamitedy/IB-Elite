import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { whiteboardService } from "@/lib/whiteboard/store";
import { WhiteboardEditor } from "./whiteboard-editor";

export const metadata = { title: "Whiteboard" };

export default async function WhiteboardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const board = await whiteboardService().get(id, user.id);
  if (!board) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/whiteboard"
        className="flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All whiteboards
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">
        {board.title ?? "Untitled whiteboard"}
      </h1>
      <WhiteboardEditor
        whiteboardId={board.id}
        initialCanvas={board.canvas_data}
      />
    </div>
  );
}
