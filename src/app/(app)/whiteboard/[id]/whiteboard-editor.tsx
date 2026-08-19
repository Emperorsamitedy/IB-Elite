"use client";

import dynamic from "next/dynamic";
import type { CanvasData } from "@/lib/whiteboard/types";

// Fabric touches `window` on import, so the canvas is client-only.
const WhiteboardCanvas = dynamic(
  () => import("@/components/whiteboard/whiteboard-canvas"),
  {
    ssr: false,
    loading: () => (
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
        Loading whiteboard…
      </p>
    ),
  },
);

export function WhiteboardEditor({
  whiteboardId,
  initialCanvas,
}: {
  whiteboardId: string;
  initialCanvas: CanvasData | null;
}) {
  return (
    <WhiteboardCanvas
      whiteboardId={whiteboardId}
      initialCanvas={initialCanvas}
    />
  );
}
