import { requireUser } from "@/lib/auth";
import { whiteboardService } from "@/lib/whiteboard/store";
import { WhiteboardGallery } from "./whiteboard-gallery";

export const metadata = { title: "Whiteboard" };

export default async function WhiteboardPage() {
  const user = await requireUser();
  const whiteboards = await whiteboardService().listFreeform(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Whiteboard</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          Scratch space for working through problems
        </p>
      </div>
      <WhiteboardGallery whiteboards={whiteboards} />
    </div>
  );
}
