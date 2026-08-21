import "server-only";
import { serverEnv } from "@/lib/env";
import { OCR_SPACE_FREE_TIER_BYTES, ocrSpaceKey } from "@/lib/scans/ocr-space";

export type ScanResult = { text: string; provider: string };

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ScanError";
  }
}

const TRANSCRIBE_PROMPT = `Transcribe every piece of text in this image exactly as written. It is usually a photo of an exam paper or a student's handwritten working.

Rules:
- Output only the transcription — no commentary, no markdown fences.
- Keep the original line breaks and question numbering, e.g. "3. (a)".
- Write maths inline in plain text: x^2, sqrt(3), (a+b)/c, 1/2, pi, ->, <=, >=.
- Transcribe what is there, even if it is wrong or crossed out — do not solve or correct anything.
- If the image contains no legible text at all, reply with exactly: NO_TEXT_FOUND`;

type Decoded = { mimeType: string; base64: string; bytes: number };

/** Splits a `data:image/png;base64,...` URL into its parts. */
export function decodeDataUrl(dataUrl: string): Decoded {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl.trim(),
  );
  if (!match) {
    throw new ScanError("That file isn't a PNG, JPEG or WebP image.", 400);
  }
  const base64 = match[2].replace(/\s/g, "");
  // 4 base64 chars encode 3 bytes, minus any padding.
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  return { mimeType: match[1], base64, bytes };
}

function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^```[a-z]*\n?|\n?```$/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Google AI Studio's free tier — far better than classic OCR at handwriting and
 * at maths notation, so it is tried first whenever a key is present.
 */
async function scanWithGemini(image: Decoded): Promise<ScanResult | null> {
  const key = serverEnv.geminiApiKey;
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${serverEnv.geminiModel}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: TRANSCRIBE_PROMPT },
            { inline_data: { mime_type: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) return null; // fall through to OCR.space

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = tidy(
    (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join(""),
  );
  if (!text || text === "NO_TEXT_FOUND") return { text: "", provider: "gemini" };
  return { text, provider: "gemini" };
}

/** Free OCR API — no key needed thanks to the public demo key. */
async function scanWithOcrSpace(image: Decoded): Promise<ScanResult> {
  if (image.bytes > OCR_SPACE_FREE_TIER_BYTES) {
    throw new ScanError(
      "That image is too large to scan (the free OCR tier caps at 1 MB). Try a smaller photo.",
      413,
    );
  }

  const body = new URLSearchParams({
    apikey: ocrSpaceKey(),
    base64Image: `data:${image.mimeType};base64,${image.base64}`,
    language: "eng",
    isOverlayRequired: "false",
    detectOrientation: "true",
    scale: "true",
    // Engine 2 handles handwriting and rotated phone photos noticeably better.
    OCREngine: "2",
  });

  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(30_000),
    body,
  });

  if (res.status === 403 || res.status === 429) {
    throw new ScanError(
      "The shared free OCR key is rate limited right now. Add your own free key (OCR_SPACE_API_KEY) or try again in a minute.",
      429,
    );
  }
  if (!res.ok) {
    throw new ScanError("The OCR service is unavailable right now.");
  }

  const data = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string | string[];
    ParsedResults?: { ParsedText?: string }[];
  };

  if (data.IsErroredOnProcessing) {
    const message = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(" ")
      : data.ErrorMessage;
    throw new ScanError(message || "The image could not be read.");
  }

  const text = tidy(
    (data.ParsedResults ?? []).map((r) => r.ParsedText ?? "").join("\n"),
  );
  return { text, provider: "ocr.space" };
}

/**
 * Reads the text out of a photo or a whiteboard snapshot, using free providers
 * only: Google AI Studio's free tier when a key is configured, otherwise the
 * keyless OCR.space free API.
 */
export async function recogniseText(dataUrl: string): Promise<ScanResult> {
  const image = decodeDataUrl(dataUrl);

  try {
    const gemini = await scanWithGemini(image);
    if (gemini && gemini.text) return gemini;
  } catch (error) {
    if (error instanceof ScanError) throw error;
    // Network/timeout — fall back to OCR.space.
  }

  return scanWithOcrSpace(image);
}
