/**
 * Whiteboard model and renderer.
 *
 * The board is a fixed logical sheet (BOARD_W × BOARD_H) so that everything is
 * stored resolution-independently: strokes keep their coordinates when the
 * window resizes, when the sheet is exported as a PNG, or when it is flattened
 * for OCR. Two canvases are stacked — a base layer (paper, scans, text) and an
 * ink layer (strokes) — so the eraser only ever removes ink.
 */

export const BOARD_W = 1600;
export const BOARD_H = 1000;

export type Tool = "pen" | "highlighter" | "eraser" | "move";
export type Paper = "plain" | "ruled" | "grid";
export type InkColor = "ink" | "red" | "blue" | "green" | "yellow";

export type Point = { x: number; y: number; p: number };

export type Stroke = {
  id: string;
  tool: "pen" | "highlighter" | "eraser";
  color: InkColor;
  size: number;
  points: Point[];
};

export type BoardImage = {
  id: string;
  kind: "image";
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoardText = {
  id: string;
  kind: "text";
  text: string;
  x: number;
  y: number;
  w: number;
  size: number;
  color: InkColor;
};

export type BoardItem = BoardImage | BoardText;

export type Board = {
  strokes: Stroke[];
  items: BoardItem[];
  paper: Paper;
};

export const EMPTY_BOARD: Board = { strokes: [], items: [], paper: "ruled" };

export const PEN_COLORS: { value: InkColor; label: string }[] = [
  { value: "ink", label: "Ink" },
  { value: "red", label: "Examiner red" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Highlighter" },
];

export const PEN_SIZES = [3, 6, 12] as const;
export const ERASER_SIZES = [24, 48, 96] as const;

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* -------------------------------------------------------------------------- */
/* Colours                                                                     */
/* -------------------------------------------------------------------------- */

export type Palette = {
  paper: string;
  rule: string;
  ink: string;
  red: string;
  blue: string;
  green: string;
  yellow: string;
};

const PRINT_PALETTE: Palette = {
  paper: "#ffffff",
  rule: "#dcd9d0",
  ink: "#132433",
  red: "#dc2f26",
  blue: "#1d4ed8",
  green: "#15803d",
  yellow: "#f5c33b",
};

/**
 * Reads the live theme tokens so the sheet follows light/dark mode. Falls back
 * to the print palette during SSR or if the tokens are missing.
 */
export function readPalette(el: Element | null): Palette {
  if (typeof window === "undefined" || !el) return PRINT_PALETTE;
  const styles = getComputedStyle(el);
  const token = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim();
    return value ? `hsl(${value})` : fallback;
  };
  return {
    paper: token("--surface", PRINT_PALETTE.paper),
    rule: token("--border", PRINT_PALETTE.rule),
    ink: token("--foreground", PRINT_PALETTE.ink),
    red: token("--accent", PRINT_PALETTE.red),
    blue: "#3b82f6",
    green: "#22a06b",
    yellow: token("--highlight", PRINT_PALETTE.yellow),
  };
}

export function printPalette(): Palette {
  return PRINT_PALETTE;
}

function colorOf(color: InkColor, palette: Palette): string {
  return palette[color];
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

const imageCache = new Map<string, HTMLImageElement>();

export function cachedImage(src: string): HTMLImageElement | undefined {
  return imageCache.get(src);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

/**
 * Shrinks a picked photo until it is comfortably under the free OCR tier's
 * 1 MB limit — and small enough to keep in localStorage with the board.
 */
export async function compressImage(
  file: Blob,
  { maxDim = 1600, maxBytes = 850_000 } = {},
): Promise<{ src: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  let quality = 0.85;

  for (let attempt = 0; attempt < 6; attempt++) {
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const src = canvas.toDataURL("image/jpeg", quality);
    if (approximateBytes(src) <= maxBytes || attempt === 5) {
      bitmap.close();
      return { src, width, height };
    }
    if (quality > 0.5) quality -= 0.15;
    else scale *= 0.8;
  }

  bitmap.close();
  throw new Error("Could not compress that image.");
}

export function approximateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/** Places a scan on the sheet at a sensible size, centred and inside bounds. */
export function fitImageOnBoard(
  width: number,
  height: number,
  existing: number,
): { x: number; y: number; w: number; h: number } {
  const maxW = BOARD_W * 0.42;
  const maxH = BOARD_H * 0.72;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const w = width * scale;
  const h = height * scale;
  // Cascade successive scans so they don't land on top of one another.
  const offset = (existing % 5) * 44;
  return {
    x: Math.min(BOARD_W - w - 24, 48 + offset),
    y: Math.min(BOARD_H - h - 24, 48 + offset),
    w,
    h,
  };
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                   */
/* -------------------------------------------------------------------------- */

export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, monospace';

export function textHeight(item: BoardText, ctx: CanvasRenderingContext2D): number {
  ctx.save();
  ctx.font = `${item.size}px ${MONO_FONT}`;
  const lines = wrapLines(ctx, item.text, item.w).length;
  ctx.restore();
  return lines * item.size * 1.45 + item.size;
}

function paperBackground(
  ctx: CanvasRenderingContext2D,
  paper: Paper,
  palette: Palette,
) {
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  if (paper === "plain") return;

  ctx.save();
  ctx.strokeStyle = palette.rule;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  const step = paper === "grid" ? 40 : 48;
  for (let y = step; y < BOARD_H; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(BOARD_W, y + 0.5);
  }
  if (paper === "grid") {
    for (let x = step; x < BOARD_W; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, BOARD_H);
    }
  }
  ctx.stroke();
  ctx.restore();

  if (paper === "ruled") {
    // The examiner's margin rule.
    ctx.save();
    ctx.strokeStyle = palette.red;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(96.5, 0);
    ctx.lineTo(96.5, BOARD_H);
    ctx.stroke();
    ctx.restore();
  }
}

/** Paper + scans + transcribed text. Never touched by the eraser. */
export function renderBase(
  ctx: CanvasRenderingContext2D,
  board: Board,
  palette: Palette,
) {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  paperBackground(ctx, board.paper, palette);

  for (const item of board.items) {
    if (item.kind === "image") {
      const img = cachedImage(item.src);
      if (img?.complete) {
        ctx.drawImage(img, item.x, item.y, item.w, item.h);
        ctx.save();
        ctx.strokeStyle = palette.rule;
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        ctx.restore();
      }
    } else {
      ctx.save();
      ctx.fillStyle = colorOf(item.color, palette);
      ctx.font = `${item.size}px ${MONO_FONT}`;
      ctx.textBaseline = "top";
      const lines = wrapLines(ctx, item.text, item.w);
      lines.forEach((line, i) => {
        ctx.fillText(line, item.x, item.y + i * item.size * 1.45);
      });
      ctx.restore();
    }
  }
}

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  palette: Palette,
  from = 0,
) {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = stroke.size;
  } else if (stroke.tool === "highlighter") {
    ctx.globalAlpha = 0.3;
    ctx.lineCap = "butt";
    ctx.strokeStyle = colorOf(stroke.color, palette);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = stroke.size * 3.2;
  } else {
    ctx.strokeStyle = colorOf(stroke.color, palette);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = stroke.size;
  }

  // A tap leaves a dot.
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const start = Math.max(1, from);
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  if (stroke.tool === "pen") {
    // Segment-by-segment so the nib can thicken with stylus pressure. Pen ink
    // is opaque, so the overlapping segments blend seamlessly.
    for (let i = start; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const anchor = i === 1 ? prev : mid(pts[i - 2], prev);
      ctx.lineWidth = stroke.size * (0.7 + 0.6 * ((prev.p + curr.p) / 2));
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      const end = mid(prev, curr);
      ctx.quadraticCurveTo(prev.x, prev.y, end.x, end.y);
      ctx.stroke();
    }
  } else {
    // One continuous path — a translucent highlighter must not overlap itself.
    const anchor = start === 1 ? pts[0] : mid(pts[start - 2], pts[start - 1]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    for (let i = start; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const end = mid(prev, curr);
      ctx.quadraticCurveTo(prev.x, prev.y, end.x, end.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function renderInk(
  ctx: CanvasRenderingContext2D,
  board: Board,
  palette: Palette,
) {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  for (const stroke of board.strokes) drawStroke(ctx, stroke, palette);
}

/**
 * Flattens the whole sheet into one image. `print` forces the light palette so
 * exports and OCR always get dark ink on white paper, whatever the theme.
 */
export function flatten(
  board: Board,
  { print = false, palette = PRINT_PALETTE, scale = 1 } = {},
): HTMLCanvasElement {
  const active = print ? PRINT_PALETTE : palette;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(BOARD_W * scale);
  canvas.height = Math.round(BOARD_H * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  renderBase(ctx, board, active);
  for (const stroke of board.strokes) drawStroke(ctx, stroke, active);
  return canvas;
}

/* -------------------------------------------------------------------------- */
/* Hit testing                                                                 */
/* -------------------------------------------------------------------------- */

export function itemAt(
  board: Board,
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
): BoardItem | null {
  // Topmost first.
  for (let i = board.items.length - 1; i >= 0; i--) {
    const item = board.items[i];
    const h = item.kind === "image" ? item.h : textHeight(item, ctx);
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + h) {
      return item;
    }
  }
  return null;
}
