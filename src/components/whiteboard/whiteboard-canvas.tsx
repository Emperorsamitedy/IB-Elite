"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Camera,
  Download,
  Eraser,
  Highlighter,
  MousePointer2,
  Pen,
  Redo2,
  ScanLine,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import {
  ScanResultDialog,
  type ScanOutcome,
} from "@/components/whiteboard/scan-result-dialog";
import {
  canRedo,
  canUndo,
  createHistory,
  current,
  push as pushHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from "@/lib/whiteboard/history";
import type { CanvasData } from "@/lib/whiteboard/types";
import * as WB from "@/lib/whiteboard/board";

const AUTOSAVE_MS = 1500;

/** Scans travel inside the board JSON, so a save has to stay request-sized. */
const MAX_SAVE_BYTES = 3_500_000;

const TOOLS: { value: WB.Tool; label: string; icon: typeof Pen; key: string }[] =
  [
    { value: "pen", label: "Pen", icon: Pen, key: "P" },
    { value: "highlighter", label: "Highlighter", icon: Highlighter, key: "H" },
    { value: "eraser", label: "Eraser", icon: Eraser, key: "E" },
    { value: "move", label: "Select & move", icon: MousePointer2, key: "V" },
  ];

const PAPERS: { value: WB.Paper; label: string }[] = [
  { value: "ruled", label: "Ruled" },
  { value: "grid", label: "Grid" },
  { value: "plain", label: "Plain" },
];

const SWATCH_CLASS: Record<WB.InkColor, string> = {
  ink: "bg-foreground",
  red: "bg-accent",
  blue: "bg-[#3b82f6]",
  green: "bg-[#22a06b]",
  yellow: "bg-highlight",
};

/**
 * Saved boards are opaque JSON to the server, so a board written by an older
 * implementation may not be ours. Anything unrecognised opens as a blank sheet
 * rather than throwing.
 */
function boardFrom(canvas: CanvasData | null | undefined): WB.Board {
  const parsed = canvas as Partial<WB.Board> | null | undefined;
  if (!parsed || !Array.isArray(parsed.strokes) || !Array.isArray(parsed.items)) {
    return WB.EMPTY_BOARD;
  }
  return {
    strokes: parsed.strokes,
    items: parsed.items,
    paper: parsed.paper ?? "ruled",
  };
}

export default function WhiteboardCanvas({
  whiteboardId,
  initialCanvas,
  height = 620,
}: {
  whiteboardId: string;
  initialCanvas?: CanvasData | null;
  height?: number;
}) {
  const { resolvedTheme } = useTheme();

  const initial = React.useMemo(() => boardFrom(initialCanvas), [initialCanvas]);
  const [board, setBoard] = React.useState<WB.Board>(initial);
  const [history, setHistory] = React.useState<History>(() =>
    createHistory(initial as unknown as CanvasData),
  );
  const [tool, setTool] = React.useState<WB.Tool>("pen");
  const [color, setColor] = React.useState<WB.InkColor>("ink");
  const [sizeIndex, setSizeIndex] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [scanning, setScanning] = React.useState<null | "photo" | "board">(null);
  const [outcome, setOutcome] = React.useState<ScanOutcome | null>(null);
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const baseRef = React.useRef<HTMLCanvasElement>(null);
  const inkRef = React.useRef<HTMLCanvasElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const paletteRef = React.useRef<WB.Palette>(WB.printPalette());
  const boardRef = React.useRef(board);
  boardRef.current = board;

  const drawingRef = React.useRef<{
    stroke: WB.Stroke;
    drawnUpTo: number;
  } | null>(null);
  const dragRef = React.useRef<{
    id: string;
    mode: "move" | "resize";
    offsetX: number;
    offsetY: number;
    ratio: number;
  } | null>(null);

  /* ----------------------------------------------------------------- state */

  // Undo/redo keeps whole-board snapshots, the same shape the server stores.
  const commit = React.useCallback((next: WB.Board) => {
    setHistory((h) => pushHistory(h, next as unknown as CanvasData));
    setBoard(next);
  }, []);

  const undo = React.useCallback(() => {
    setHistory((h) => {
      if (!canUndo(h)) return h;
      const next = undoHistory(h);
      setBoard(current(next) as unknown as WB.Board);
      return next;
    });
  }, []);

  const redo = React.useCallback(() => {
    setHistory((h) => {
      if (!canRedo(h)) return h;
      const next = redoHistory(h);
      setBoard(current(next) as unknown as WB.Board);
      return next;
    });
  }, []);

  /* --------------------------------------------------------- load + persist */

  // Scans are stored as data URLs inside the board, so they must be decoded
  // before the first paint or they flash in late.
  React.useEffect(() => {
    const sources = initial.items
      .filter((i): i is WB.BoardImage => i.kind === "image")
      .map((i) => i.src);
    if (sources.length === 0) {
      setReady(true);
      return;
    }
    Promise.all(sources.map((src) => WB.loadImage(src).catch(() => null)))
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, [initial]);

  const save = React.useCallback(async (next: WB.Board) => {
    setSaving(true);
    try {
      const payload = JSON.stringify(next);
      if (payload.length > MAX_SAVE_BYTES) {
        toast.error("This board has too many scans to save.", {
          description: "Delete one, or export the sheet as a PNG instead.",
        });
        return;
      }
      const res = await fetch(`/api/whiteboard/${whiteboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_data: JSON.parse(payload) as CanvasData,
          thumbnail: WB.flatten(next, { print: true, scale: 0.25 }).toDataURL(
            "image/png",
          ),
        }),
      });
      // A signed-out session is bounced to /login by the middleware, which
      // answers 200 with HTML — never let that read as a successful save.
      if (!res.ok || res.redirected) throw new Error();
      setSavedAt(new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }));
    } catch {
      toast.error("Couldn't save this board — your working is still on screen.", {
        description: "If you've been away a while, sign in again.",
      });
    } finally {
      setSaving(false);
    }
  }, [whiteboardId]);

  // Autosave a short beat after the pen stops moving.
  React.useEffect(() => {
    if (!ready || board === initial) return;
    const timer = setTimeout(() => void save(board), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [board, initial, ready, save]);

  /* -------------------------------------------------------------- rendering */

  const contexts = React.useCallback(() => {
    const base = baseRef.current?.getContext("2d");
    const ink = inkRef.current?.getContext("2d");
    return base && ink ? { base, ink } : null;
  }, []);

  const redraw = React.useCallback(() => {
    const ctx = contexts();
    if (!ctx) return;
    paletteRef.current = WB.readPalette(wrapRef.current);
    WB.renderBase(ctx.base, boardRef.current, paletteRef.current);
    WB.renderInk(ctx.ink, boardRef.current, paletteRef.current);
  }, [contexts]);

  const resize = React.useCallback(() => {
    const wrap = wrapRef.current;
    const base = baseRef.current;
    const ink = inkRef.current;
    if (!wrap || !base || !ink) return;

    // The sheet keeps its aspect ratio; `height` caps how tall it may grow.
    const cssWidth = Math.min(
      wrap.clientWidth,
      (height * WB.BOARD_W) / WB.BOARD_H,
    );
    if (cssWidth === 0) return;
    const cssHeight = (cssWidth * WB.BOARD_H) / WB.BOARD_W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = (cssWidth / WB.BOARD_W) * dpr;

    for (const canvas of [base, ink]) {
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      // Setting width/height resets the transform, so re-apply board space.
      canvas.getContext("2d")?.setTransform(scale, 0, 0, scale, 0, 0);
    }
    redraw();
  }, [redraw, height]);

  React.useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [resize]);

  // Board changes, theme flips and finished loads all need a full repaint.
  React.useEffect(() => {
    redraw();
  }, [board, resolvedTheme, ready, redraw]);

  /* ------------------------------------------------------------- interaction */

  const toBoardPoint = (event: React.PointerEvent | PointerEvent) => {
    const canvas = inkRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WB.BOARD_W,
      y: ((event.clientY - rect.top) / rect.height) * WB.BOARD_H,
      p: event.pressure > 0 && event.pressure !== 0.5 ? event.pressure : 0.5,
    };
  };

  const handleSize =
    tool === "eraser" ? WB.ERASER_SIZES[sizeIndex] : WB.PEN_SIZES[sizeIndex];

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toBoardPoint(event);

    if (tool === "move") {
      const ctx = contexts()?.base;
      if (!ctx) return;
      const item = WB.itemAt(board, point.x, point.y, ctx);
      setSelectedId(item?.id ?? null);
      if (!item) return;
      const height =
        item.kind === "image" ? item.h : WB.textHeight(item, ctx);
      const onHandle =
        point.x > item.x + item.w - 32 && point.y > item.y + height - 32;
      dragRef.current = {
        id: item.id,
        mode: onHandle ? "resize" : "move",
        offsetX: point.x - item.x,
        offsetY: point.y - item.y,
        ratio: item.kind === "image" ? item.h / item.w : 1,
      };
      return;
    }

    const stroke: WB.Stroke = {
      id: WB.newId(),
      tool,
      color,
      size: handleSize,
      points: [point],
    };
    drawingRef.current = { stroke, drawnUpTo: 0 };
    const ink = contexts()?.ink;
    if (ink) WB.drawStroke(ink, stroke, paletteRef.current);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const point = toBoardPoint(event);
      setBoard((current) => ({
        ...current,
        items: current.items.map((item) => {
          if (item.id !== drag.id) return item;
          if (drag.mode === "move") {
            return { ...item, x: point.x - drag.offsetX, y: point.y - drag.offsetY };
          }
          const width = Math.max(80, point.x - item.x);
          return item.kind === "image"
            ? { ...item, w: width, h: width * drag.ratio }
            : { ...item, w: width };
        }),
      }));
      return;
    }

    const drawing = drawingRef.current;
    if (!drawing) return;

    const native = event.nativeEvent;
    const coalesced =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [];
    const points = (coalesced.length ? coalesced : [native]).map(toBoardPoint);
    // Skip sub-pixel jitter so the smoothing has real segments to work with.
    for (const point of points) {
      const last = drawing.stroke.points[drawing.stroke.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) < 1.2) continue;
      drawing.stroke.points.push(point);
    }

    const ink = contexts()?.ink;
    if (!ink) return;
    if (drawing.stroke.tool === "highlighter") {
      // Translucent ink must be redrawn as one path, never in pieces.
      WB.renderInk(ink, boardRef.current, paletteRef.current);
      WB.drawStroke(ink, drawing.stroke, paletteRef.current);
    } else {
      WB.drawStroke(ink, drawing.stroke, paletteRef.current, drawing.drawnUpTo + 1);
    }
    drawing.drawnUpTo = drawing.stroke.points.length - 1;
  };

  const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragRef.current) {
      dragRef.current = null;
      commit(boardRef.current);
      return;
    }
    const drawing = drawingRef.current;
    drawingRef.current = null;
    if (!drawing) return;
    commit({
      ...boardRef.current,
      strokes: [...boardRef.current.strokes, drawing.stroke],
    });
  };

  /* ------------------------------------------------------------- board edits */

  const addText = (text: string) => {
    const item: WB.BoardText = {
      id: WB.newId(),
      kind: "text",
      text,
      x: 128,
      y: 72 + (board.items.length % 4) * 36,
      w: WB.BOARD_W * 0.55,
      size: 22,
      color: "ink",
    };
    commit({ ...board, items: [...board.items, item] });
    setTool("move");
    setSelectedId(item.id);
    toast.success("Added to the board — drag it with the select tool.");
  };

  const deleteSelected = React.useCallback(() => {
    if (!selectedId) return;
    commit({
      ...boardRef.current,
      items: boardRef.current.items.filter((i) => i.id !== selectedId),
    });
    setSelectedId(null);
  }, [commit, selectedId]);

  const clearBoard = () => {
    if (board.strokes.length === 0 && board.items.length === 0) return;
    commit({ ...board, strokes: [], items: [] });
    setSelectedId(null);
    toast.success("Board cleared", { description: "Undo brings it back." });
  };

  const exportPng = () => {
    const canvas = WB.flatten(board, { print: true, scale: 1.5 });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `atlas-whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  /* ------------------------------------------------------------------ scans */

  const runScan = async (dataUrl: string, source: "photo" | "board") => {
    setScanning(source);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, source }),
      });
      if (res.redirected) {
        toast.error("Your session expired — sign in again to scan.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Scanning failed.");
        return;
      }
      setOutcome({
        text: data.text ?? "",
        provider: data.provider ?? "OCR",
        message: data.message,
        source,
      });
    } catch {
      toast.error("Scanning failed — check your connection and try again.");
    } finally {
      setScanning(null);
    }
  };

  const onPickPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      // Two sizes: a sharp one for OCR, and a lighter one to keep on the sheet
      // — the board is saved as JSON, so every scan rides in the request body.
      const [forOcr, forBoard] = await Promise.all([
        WB.compressImage(file, { maxDim: 1600, maxBytes: 850_000 }),
        WB.compressImage(file, { maxDim: 1100, maxBytes: 280_000 }),
      ]);
      await WB.loadImage(forBoard.src);
      const placement = WB.fitImageOnBoard(
        forBoard.width,
        forBoard.height,
        board.items.filter((i) => i.kind === "image").length,
      );
      commit({
        ...board,
        items: [
          ...board.items,
          { id: WB.newId(), kind: "image", src: forBoard.src, ...placement },
        ],
      });
      await runScan(forOcr.src, "photo");
    } catch {
      toast.error("That image couldn't be read.");
    }
  };

  const scanBoard = async () => {
    if (board.strokes.length === 0 && board.items.length === 0) {
      toast.error("Write something on the board first.");
      return;
    }
    // Always send dark-ink-on-white, whatever the current theme is.
    const canvas = WB.flatten(board, { print: true, scale: 1 });
    let quality = 0.85;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (WB.approximateBytes(dataUrl) > 850_000 && quality > 0.4) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    await runScan(dataUrl, "board");
  };

  /* -------------------------------------------------------------- shortcuts */

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId) {
          event.preventDefault();
          deleteSelected();
        }
        return;
      }
      const shortcut = TOOLS.find(
        (t) => t.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (shortcut && !meta) setTool(shortcut.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  /* ------------------------------------------------------------------- view */

  const selected = board.items.find((i) => i.id === selectedId) ?? null;
  const sizes = tool === "eraser" ? WB.ERASER_SIZES : WB.PEN_SIZES;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2">
        <div className="flex items-center gap-1">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTool(t.value)}
                title={`${t.label} (${t.key})`}
                aria-pressed={active}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" />
                <span className="sr-only">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          {WB.PEN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                setColor(c.value);
                if (tool === "eraser" || tool === "move") setTool("pen");
              }}
              title={c.label}
              aria-pressed={color === c.value}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform",
                SWATCH_CLASS[c.value],
                color === c.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105",
              )}
            >
              <span className="sr-only">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          {sizes.map((size, index) => (
            <button
              key={size}
              type="button"
              onClick={() => setSizeIndex(index)}
              title={`${tool === "eraser" ? "Eraser" : "Nib"} ${index + 1}`}
              aria-pressed={sizeIndex === index}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                sizeIndex === index
                  ? "border-accent bg-accent-soft"
                  : "border-transparent hover:bg-surface-2",
              )}
            >
              <span
                className="rounded-full bg-foreground"
                style={{
                  width: 4 + index * 4,
                  height: 4 + index * 4,
                }}
              />
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={!canUndo(history)}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={!canRedo(history)}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearBoard}
            title="Clear the board"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-border">
            {PAPERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => commit({ ...board, paper: p.value })}
                aria-pressed={board.paper === p.value}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md",
                  board.paper === p.value
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={scanning !== null}
          >
            {scanning === "photo" ? (
              <Spinner />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Scan a question
          </Button>
          <Button size="sm" onClick={scanBoard} disabled={scanning !== null}>
            {scanning === "board" ? (
              <Spinner />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            Read my working
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={exportPng}
            title="Download as PNG"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border border-border shadow-sm"
      >
        <canvas ref={baseRef} className="block w-full" />
        <canvas
          ref={inkRef}
          className={cn(
            "absolute inset-0 block w-full touch-none",
            tool === "move" ? "cursor-default" : "cursor-crosshair",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        />

        {selected && tool === "move" && (
          <SelectionFrame
            item={selected}
            wrap={wrapRef.current}
            onDelete={deleteSelected}
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {saving
          ? "Saving…"
          : savedAt
            ? `Saved ${savedAt}`
            : "Saves as you work"}{" "}
        · Shortcuts: P pen, H highlighter, E eraser, V select, Ctrl+Z undo
      </p>

      <ScanResultDialog
        outcome={outcome}
        onOpenChange={(open) => !open && setOutcome(null)}
        onAddToBoard={addText}
      />
    </div>
  );
}

/** Marching outline + delete affordance drawn in DOM over the selected item. */
function SelectionFrame({
  item,
  wrap,
  onDelete,
}: {
  item: WB.BoardItem;
  wrap: HTMLDivElement | null;
  onDelete: () => void;
}) {
  const width = wrap?.clientWidth ?? WB.BOARD_W;
  const scale = width / WB.BOARD_W;
  const height =
    item.kind === "image"
      ? item.h
      : (measureTextHeight(item) ?? item.size * 2);

  return (
    <div
      className="pointer-events-none absolute border-2 border-dashed border-accent"
      style={{
        left: item.x * scale,
        top: item.y * scale,
        width: item.w * scale,
        height: height * scale,
      }}
    >
      <button
        type="button"
        onClick={onDelete}
        className="pointer-events-auto absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm"
        title="Delete (Del)"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-sm border-2 border-accent bg-background" />
    </div>
  );
}

let measureCanvas: HTMLCanvasElement | null = null;

function measureTextHeight(item: WB.BoardItem): number | null {
  if (item.kind !== "text" || typeof document === "undefined") return null;
  measureCanvas ??= document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  return ctx ? WB.textHeight(item, ctx) : null;
}
