import "server-only";
import type { BoundingBox, OcrResult, OcrWord, ScanOcr, ScanStorage } from "./types";

const ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

type Vertex = { x?: number; y?: number };

type VisionResponse = {
  responses?: Array<{
    error?: { message?: string };
    textAnnotations?: Array<{
      description?: string;
      boundingPoly?: { vertices?: Vertex[] };
    }>;
    fullTextAnnotation?: { text?: string };
  }>;
};

function toBox(vertices: Vertex[] | undefined): BoundingBox {
  const xs = (vertices ?? []).map((v) => v.x ?? 0);
  const ys = (vertices ?? []).map((v) => v.y ?? 0);
  const x = Math.min(...xs, 0);
  const y = Math.min(...ys, 0);
  return {
    x,
    y,
    width: Math.max(...xs, 0) - x,
    height: Math.max(...ys, 0) - y,
  };
}

function toArrayBufferBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export function isVisionConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLOUD_VISION_KEY);
}

/** Google Cloud Vision document text detection. */
export function createVisionOcr(storage: ScanStorage): ScanOcr {
  return {
    async read(imagePath: string): Promise<OcrResult> {
      const key = process.env.GOOGLE_CLOUD_VISION_KEY;
      if (!key) {
        throw new Error("GOOGLE_CLOUD_VISION_KEY is not configured.");
      }

      const bytes = await storage.download(imagePath);
      const response = await fetch(`${ENDPOINT}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: toArrayBufferBase64(bytes) },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Vision request failed with status ${response.status}`);
      }

      const payload: VisionResponse = await response.json();
      const first = payload.responses?.[0];
      if (first?.error?.message) throw new Error(first.error.message);

      const annotations = first?.textAnnotations ?? [];
      // The first annotation is the whole block; the rest are words.
      const words: OcrWord[] = annotations.slice(1).map((annotation) => ({
        text: annotation.description ?? "",
        box: toBox(annotation.boundingPoly?.vertices),
      }));

      return {
        text: first?.fullTextAnnotation?.text ?? annotations[0]?.description ?? "",
        words,
      };
    },
  };
}
