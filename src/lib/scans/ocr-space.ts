import "server-only";
import type { BoundingBox, OcrResult, OcrWord, ScanOcr, ScanStorage } from "./types";

const ENDPOINT = "https://api.ocr.space/parse/image";

/**
 * Engine 3 is OCR.space's handwriting engine — the other two are print-only.
 * It is slower and `isOverlayRequired=true` slows it further, but the word
 * boxes are what the annotation overlay is built from.
 */
const HANDWRITING_ENGINE = "3";

/** Free-tier ceiling; larger files are rejected by OCR.space with an error. */
export const OCR_SPACE_FREE_TIER_BYTES = 1024 * 1024;

type OcrSpaceWord = {
  WordText?: string;
  Left?: number;
  Top?: number;
  Width?: number;
  Height?: number;
};

type OcrSpaceResponse = {
  ParsedResults?: Array<{
    ParsedText?: string;
    ErrorMessage?: string;
    TextOverlay?: { Lines?: Array<{ Words?: OcrSpaceWord[] }> };
  }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ErrorDetails?: string;
};

function toBox(word: OcrSpaceWord): BoundingBox {
  return {
    x: word.Left ?? 0,
    y: word.Top ?? 0,
    width: word.Width ?? 0,
    height: word.Height ?? 0,
  };
}

function errorText(payload: OcrSpaceResponse): string | null {
  const message = Array.isArray(payload.ErrorMessage)
    ? payload.ErrorMessage.filter(Boolean).join("; ")
    : payload.ErrorMessage;
  const parsedError = payload.ParsedResults?.[0]?.ErrorMessage;
  const combined = [message, parsedError, payload.ErrorDetails]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("; ");
  return combined || null;
}

function extensionFor(imagePath: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(imagePath);
  return (match?.[1] ?? "jpg").toUpperCase().replace("JPEG", "JPG");
}

export function isOcrConfigured(): boolean {
  return Boolean(process.env.OCR_SPACE_API_KEY);
}

/** OCR.space `/parse/image`, engine 3 (handwriting) with word overlays. */
export function createOcrSpaceOcr(storage: ScanStorage): ScanOcr {
  return {
    async read(imagePath: string): Promise<OcrResult> {
      const key = process.env.OCR_SPACE_API_KEY;
      if (!key) {
        throw new Error("OCR_SPACE_API_KEY is not configured.");
      }

      const bytes = await storage.download(imagePath);
      if (bytes.byteLength > OCR_SPACE_FREE_TIER_BYTES) {
        throw new Error(
          `Image is ${Math.round(bytes.byteLength / 1024)}KB; OCR.space accepts up to 1MB.`,
        );
      }

      const filetype = extensionFor(imagePath);
      const body = new URLSearchParams({
        base64Image: `data:image/${filetype.toLowerCase()};base64,${Buffer.from(bytes).toString("base64")}`,
        filetype,
        language: "eng",
        isOverlayRequired: "true",
        scale: "true",
        detectOrientation: "true",
        OCREngine: HANDWRITING_ENGINE,
      });

      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          apikey: key,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        throw new Error(`OCR.space request failed with status ${response.status}`);
      }

      const payload: OcrSpaceResponse = await response.json();
      if (payload.IsErroredOnProcessing) {
        throw new Error(errorText(payload) ?? "OCR.space failed to parse the image");
      }

      const result = payload.ParsedResults?.[0];
      if (!result) {
        throw new Error(errorText(payload) ?? "OCR.space returned no parsed results");
      }

      const words: OcrWord[] = (result.TextOverlay?.Lines ?? []).flatMap((line) =>
        (line.Words ?? [])
          .filter((word) => Boolean(word.WordText))
          .map((word) => ({ text: word.WordText ?? "", box: toBox(word) })),
      );

      return { text: result.ParsedText ?? "", words };
    },
  };
}
