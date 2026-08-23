import { z } from "zod";
import type { GraphSpec } from "@/lib/graph";

export type QuestionAssetKind = "image" | "diagram" | "graph";

/** Fabric `canvas.toJSON()` output for a diagram, replayed verbatim. */
export type CanvasData = Record<string, unknown>;

export type QuestionAsset = {
  id: string;
  question_id: string;
  kind: QuestionAssetKind;
  storage_path: string | null;
  caption: string | null;
  alt_text: string | null;
  canvas_data: CanvasData | null;
  graph_spec: GraphSpec | null;
  sort_order: number;
};

/** What a student's page needs: a signed URL rather than an object path. */
export type QuestionAssetView = Omit<QuestionAsset, "storage_path"> & {
  url: string | null;
};

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
export const ASSET_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const QUESTION_ASSETS_BUCKET = "question-assets";

const graphFunctionSchema = z.object({
  expression: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const graphSpecSchema = z.object({
  functions: z.array(graphFunctionSchema).min(1).max(4),
  xMin: z.number(),
  xMax: z.number(),
  yMin: z.number(),
  yMax: z.number(),
  xLabel: z.string().max(40).optional(),
  yLabel: z.string().max(40).optional(),
  showGrid: z.boolean(),
});

export const assetInputSchema = z
  .object({
    questionId: z.string().uuid(),
    kind: z.enum(["image", "diagram", "graph"]),
    caption: z.string().max(300).nullish(),
    altText: z.string().max(300).nullish(),
    /** Base64 data URL: the uploaded file, or the diagram rendered to PNG. */
    file: z.string().max(4_000_000).nullish(),
    canvasData: z.record(z.string(), z.unknown()).nullish(),
    graphSpec: graphSpecSchema.nullish(),
    sortOrder: z.number().int().min(0).max(50).default(0),
  })
  .refine((v) => (v.kind === "graph" ? Boolean(v.graphSpec) : Boolean(v.file)), {
    message: "A graph needs a spec; an image or diagram needs a file.",
  });

export type AssetInput = z.infer<typeof assetInputSchema>;

/** Split a `data:` URL into its content type and bytes. */
export function decodeDataUrl(
  dataUrl: string,
): { contentType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], bytes: Buffer.from(match[2], "base64") };
}
