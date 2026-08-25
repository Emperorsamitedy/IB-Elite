import "server-only";
import { callGemini, isGeminiConfigured, parseJson } from "@/lib/scans/gemini";
import type { ScanStorage } from "@/lib/scans/types";
import type { MockStore } from "./store";
import type { HandwritingCheck } from "./service";

const COMPARE_PROMPT = `You are a forensic handwriting screener. Two images of handwritten exam work follow. Decide whether they were written by the SAME person.

Return JSON only, shaped exactly:
{"sameWriter": true|false|null, "confidence": <0..1>, "note": "<one short sentence naming the strongest cue>"}

Rules:
- Judge letterforms, slant, spacing, pressure and habits — never the content.
- Use null when either image is too unclear to judge.
- Be conservative: different pens, camera angles or paper are NOT evidence
  of a different writer.`;

function mimeFor(path: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

/** Only a confident mismatch is worth a human's time. */
const FLAG_CONFIDENCE = 0.7;

/**
 * Gemini-vision handwriting consistency check against the student's most
 * recent earlier script. Returns null (no verdict) whenever it cannot
 * responsibly judge: no vision key, no history, unclear images, or any
 * error — screening must never manufacture accusations.
 */
export function createHandwritingCheck(
  store: MockStore,
  storage: ScanStorage,
): HandwritingCheck | undefined {
  if (!isGeminiConfigured()) return undefined;

  return async (userId, entryId, scriptPaths) => {
    const currentPath = scriptPaths[0];
    if (!currentPath) return null;
    const priorPath = await store.priorScriptPath(userId, entryId);
    if (!priorPath) return null;

    const [prior, current] = await Promise.all([
      storage.download(priorPath),
      storage.download(currentPath),
    ]);

    const raw = await callGemini([
      { text: COMPARE_PROMPT },
      {
        inline_data: {
          mime_type: mimeFor(priorPath),
          data: Buffer.from(prior).toString("base64"),
        },
      },
      {
        inline_data: {
          mime_type: mimeFor(currentPath),
          data: Buffer.from(current).toString("base64"),
        },
      },
    ]);
    const parsed = parseJson<{
      sameWriter?: boolean | null;
      confidence?: number;
      note?: string;
    }>(raw);

    if (parsed.sameWriter === null || parsed.sameWriter === undefined) {
      return null;
    }
    const confidence = Number(parsed.confidence ?? 0);
    if (parsed.sameWriter === false && confidence >= FLAG_CONFIDENCE) {
      return {
        consistent: false,
        detail: `confidence ${confidence.toFixed(2)}: ${parsed.note ?? "handwriting differs from earlier scripts"}`,
      };
    }
    return { consistent: true, detail: parsed.note ?? "" };
  };
}
