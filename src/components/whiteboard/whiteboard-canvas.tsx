"use client";

import * as React from "react";
import { Canvas, PencilBrush, Line, classRegistry, type TPointerEventInfo } from "fabric";
import { EraserBrush, ClippingGroup } from "@erase2d/fabric";
import { Pen, Eraser, Minus, Trash2, Undo2, Redo2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  canRedo,
  canUndo,
  createHistory,
  current,
  push,
  redo,
  undo,
  type History,
} from "@/lib/whiteboard/history";
import type { CanvasData } from "@/lib/whiteboard/types";

// Erased strokes are stored as clipping groups; the class must be known to
// fabric before a saved canvas can be reloaded.
classRegistry.setClass(ClippingGroup);

type Tool = "pen" | "eraser" | "line";

const COLORS = ["#111827", "#DC2626", "#2563EB", "#16A34A"];
const WIDTHS: { label: string; value: number }[] = [
  { label: "Thin", value: 2 },
  { label: "Medium", value: 4 },
  { label: "Thick", value: 8 },
];
const AUTOSAVE_MS = 5000;

const toolButton =
  "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors";

export default function WhiteboardCanvas({
  whiteboardId,
  initialCanvas,
  height = 460,
  autosave = true,
  onSave,
}: {
  whiteboardId?: string;
  initialCanvas?: CanvasData | null;
  height?: number;
  /** Off for one-shot uses, e.g. drawing a question diagram in the admin. */
  autosave?: boolean;
  /** Takes over persistence; the canvas PATCH is used when it is absent. */
  onSave?: (canvasData: CanvasData, pngDataUrl: string) => Promise<void>;
}) {
  const elementRef = React.useRef<HTMLCanvasElement | null>(null);
  const canvasRef = React.useRef<Canvas | null>(null);
  const historyRef = React.useRef<History>(createHistory({}));
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set while we replay a snapshot, so restoring doesn't record new history.
  const restoringRef = React.useRef(false);

  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState(COLORS[0]);
  const [width, setWidth] = React.useState(WIDTHS[1].value);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [, forceRender] = React.useReducer((n: number) => n + 1, 0);

  const snapshot = React.useCallback((): CanvasData => {
    const canvas = canvasRef.current;
    return canvas ? (canvas.toObject(["erasable"]) as CanvasData) : {};
  }, []);

  const save = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      if (onSave) {
        await onSave(
          snapshot(),
          canvas.toDataURL({ format: "png", multiplier: 1 }),
        );
        setSavedAt(new Date().toLocaleTimeString());
        return;
      }
      await fetch(`/api/whiteboard/${whiteboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_data: snapshot(),
          thumbnail: canvas.toDataURL({
            format: "png",
            multiplier: 0.25,
          }),
        }),
      });
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setSaving(false);
    }
  }, [onSave, snapshot, whiteboardId]);

  const scheduleSave = React.useCallback(() => {
    if (!autosave) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [autosave, save]);

  const record = React.useCallback(() => {
    if (restoringRef.current) return;
    historyRef.current = push(historyRef.current, snapshot());
    forceRender();
    scheduleSave();
  }, [scheduleSave, snapshot]);

  // Mount once: fabric owns the element for the component's lifetime.
  React.useEffect(() => {
    if (!elementRef.current) return;
    const canvas = new Canvas(elementRef.current, {
      backgroundColor: "#FFFFFF",
      isDrawingMode: true,
      selection: false,
    });
    canvasRef.current = canvas;

    const start = async () => {
      if (initialCanvas && Object.keys(initialCanvas).length > 0) {
        restoringRef.current = true;
        await canvas.loadFromJSON(initialCanvas);
        canvas.requestRenderAll();
        restoringRef.current = false;
      }
      historyRef.current = createHistory(
        canvas.toObject(["erasable"]) as CanvasData,
      );
      forceRender();
    };
    void start();

    canvas.on("path:created", record);
    canvas.on("erasing:end", record);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void canvas.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tool, colour and width all resolve to the same thing: which brush is
  // armed and how it is configured.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === "eraser") {
      const eraser = new EraserBrush(canvas);
      eraser.width = width * 4;
      canvas.freeDrawingBrush = eraser;
      canvas.isDrawingMode = true;
      return;
    }

    if (tool === "line") {
      canvas.isDrawingMode = false;
      return;
    }

    const pencil = new PencilBrush(canvas);
    pencil.color = color;
    pencil.width = width;
    canvas.freeDrawingBrush = pencil;
    canvas.isDrawingMode = true;
  }, [tool, color, width]);

  // Straight-line tool: drag from anchor to pointer, commit on release.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tool !== "line") return;

    let line: Line | null = null;

    const down = (event: TPointerEventInfo) => {
      const { x, y } = canvas.getScenePoint(event.e);
      line = new Line([x, y, x, y], {
        stroke: color,
        strokeWidth: width,
        selectable: false,
        evented: false,
      });
      canvas.add(line);
    };
    const move = (event: TPointerEventInfo) => {
      if (!line) return;
      const { x, y } = canvas.getScenePoint(event.e);
      line.set({ x2: x, y2: y });
      canvas.requestRenderAll();
    };
    const up = () => {
      if (!line) return;
      line.setCoords();
      line = null;
      record();
    };

    canvas.on("mouse:down", down);
    canvas.on("mouse:move", move);
    canvas.on("mouse:up", up);
    return () => {
      canvas.off("mouse:down", down);
      canvas.off("mouse:move", move);
      canvas.off("mouse:up", up);
    };
  }, [tool, color, width, record]);

  const restore = React.useCallback(
    async (next: History) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      historyRef.current = next;
      restoringRef.current = true;
      await canvas.loadFromJSON(current(next));
      canvas.requestRenderAll();
      restoringRef.current = false;
      forceRender();
      scheduleSave();
    },
    [scheduleSave],
  );

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.remove(...canvas.getObjects());
    canvas.backgroundColor = "#FFFFFF";
    canvas.requestRenderAll();
    setConfirmClear(false);
    record();
  };

  const history = historyRef.current;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["pen", "Pen", Pen],
            ["eraser", "Eraser", Eraser],
            ["line", "Line", Minus],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTool(value)}
            aria-pressed={tool === value}
            className={cn(
              toolButton,
              tool === value
                ? "bg-accent text-accent-foreground"
                : "bg-card hover:bg-surface-2",
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            aria-pressed={color === c}
            style={{ backgroundColor: c }}
            className={cn(
              "size-6 rounded-full border-2",
              color === c ? "border-accent" : "border-border",
            )}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Custom colour"
          className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
        />

        <span className="mx-1 h-5 w-px bg-border" />

        {WIDTHS.map((w) => (
          <button
            key={w.value}
            onClick={() => setWidth(w.value)}
            aria-pressed={width === w.value}
            className={cn(
              toolButton,
              width === w.value
                ? "bg-accent text-accent-foreground"
                : "bg-card hover:bg-surface-2",
            )}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void restore(undo(history))}
          disabled={!canUndo(history)}
          className={cn(toolButton, "bg-card disabled:opacity-40")}
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
        <button
          onClick={() => void restore(redo(history))}
          disabled={!canRedo(history)}
          className={cn(toolButton, "bg-card disabled:opacity-40")}
        >
          <Redo2 className="h-3.5 w-3.5" /> Redo
        </button>
        <button
          onClick={() => setConfirmClear(true)}
          className={cn(toolButton, "bg-card text-danger")}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          <Save className="mr-1.5 size-3.5" />
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedAt && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Saved {savedAt}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <canvas ref={elementRef} width={900} height={height} />
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear the whiteboard?</DialogTitle>
            <DialogDescription>
              This wipes everything on the canvas. You can still undo it
              afterwards.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clear}>
              Clear canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
