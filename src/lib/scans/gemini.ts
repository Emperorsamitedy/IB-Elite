import "server-only";
import { imageSize } from "./image-size";
import type {
  BoundingBox,
  OcrResult,
  OcrWord,
  QuestionContext,
  ScanOcr,
  ScanStorage,
} from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Free-tier vision model; overridable for accounts on a paid tier. */
function model(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

/** Gemini accepts up to 20MB inline, far above our 4MB upload ceiling. */
export const GEMINI_MAX_BYTES = 8 * 1024 * 1024;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function mimeFor(path: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase() ?? "jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  return "image/jpeg";
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
};

/** Free-tier capacity is shared, so 429/503 are routine and worth one retry. */
const RETRY_STATUSES = new Set([429, 503]);

/** One JSON-mode call. Throws with the API's own message so scans fail loudly. */
export async function callGemini(parts: GeminiPart[], attempt = 0): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    `${API_BASE}/${model()}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          // 2.5+ models reason before answering and charge it to the output
          // budget, which silently truncates the JSON. Marking needs the
          // answer, not the deliberation.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  const payload: GeminiResponse = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (RETRY_STATUSES.has(response.status) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return callGemini(parts, attempt + 1);
    }
    throw new Error(
      payload.error?.message ?? `Gemini request failed with status ${response.status}`,
    );
  }
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the image (${payload.promptFeedback.blockReason})`);
  }

  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response");
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini ran out of output tokens before finishing the JSON");
  }
  return text;
}

export function parseJson<T>(raw: string): T {
  // JSON mode is requested, but a fenced block still slips through sometimes.
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Gemini returned malformed JSON: ${cleaned.slice(0, 200)}`);
  }
}

const OCR_PROMPT = `You are transcribing a photograph of a student's handwritten exam answer.

Return JSON only, shaped exactly:
{"lines":[{"text":"<one line of handwriting, verbatim>","box":[ymin,xmin,ymax,xmax]}]}

Rules:
- Transcribe every legible line in reading order, including working and crossings-out you can still read.
- Write mathematics in LaTeX inside $...$ (e.g. $\\frac{dy}{dx}=4x^{3}$), not ASCII like 4^x.
- box is the line's bounding box in this image, normalised to integers 0-1000 as [ymin,xmin,ymax,xmax].
- If nothing is legible return {"lines":[]}.`;

type OcrLine = { text?: string; box?: number[] };

function toBox(
  box: number[] | undefined,
  size: { width: number; height: number },
): BoundingBox {
  const [ymin = 0, xmin = 0, ymax = 0, xmax = 0] = box ?? [];
  const x = (xmin / 1000) * size.width;
  const y = (ymin / 1000) * size.height;
  return {
    x,
    y,
    width: Math.max(0, (xmax / 1000) * size.width - x),
    height: Math.max(0, (ymax / 1000) * size.height - y),
  };
}

/**
 * Handwriting OCR through Gemini vision. Unlike OCR.space engine 3 this reads
 * mathematics, and it returns LaTeX so transcripts render like the rest of the
 * app. Boxes come back normalised, so the image header gives the real size.
 */
export function createGeminiOcr(storage: ScanStorage): ScanOcr {
  return {
    async read(imagePath: string): Promise<OcrResult> {
      const bytes = await storage.download(imagePath);
      if (bytes.byteLength > GEMINI_MAX_BYTES) {
        throw new Error(
          `Image is ${Math.round(bytes.byteLength / 1024)}KB; the limit is ${
            GEMINI_MAX_BYTES / 1024
          }KB.`,
        );
      }

      const raw = await callGemini([
        { text: OCR_PROMPT },
        {
          inline_data: {
            mime_type: mimeFor(imagePath),
            data: Buffer.from(bytes).toString("base64"),
          },
        },
      ]);

      const parsed = parseJson<{ lines?: OcrLine[] }>(raw);
      const size = imageSize(bytes) ?? { width: 1000, height: 1000 };
      const words: OcrWord[] = (parsed.lines ?? [])
        .filter((line): line is OcrLine & { text: string } => Boolean(line.text?.trim()))
        .map((line) => ({ text: line.text.trim(), box: toBox(line.box, size) }));

      return { text: words.map((word) => word.text).join("\n"), words };
    },
  };
}

export type GeminiMarkPoint = {
  text: string;
  present: boolean;
  evidence: string | null;
  comment: string | null;
};

export type GeminiGrade = {
  markPoints: GeminiMarkPoint[];
  awarded: number;
  feedback: string;
};

function contextBlock(context: QuestionContext): string {
  const lines = [
    context.subject && `Subject: ${context.subject}`,
    context.topic && `Topic: ${context.topic}`,
    context.subtopic && `Subtopic: ${context.subtopic}`,
    context.commandTerm && `Command term: ${context.commandTerm}`,
    `Marks available: ${context.marks}`,
    `Question: ${context.prompt}`,
    context.answer && `Mark scheme: ${context.answer}`,
    context.solution && `Worked solution: ${context.solution}`,
  ];
  return lines.filter(Boolean).join("\n");
}

const GRADE_PROMPT = `You are an IB examiner marking a student's transcribed handwritten answer.

Mark strictly against the mark scheme below and nothing else. Award a mark only when the
student's work actually earns it; do not give credit for work that is merely close. Judge the
answer against the IB command term where one is given.

Return JSON only, shaped exactly:
{"markPoints":[{"text":"<mark scheme point>","present":true|false,"evidence":"<verbatim phrase from the student's work, or null>","comment":"<one short sentence, or null>"}],
 "awarded":<integer>,
 "feedback":"<two or three sentences of specific, actionable advice>"}

Rules:
- One entry per mark-scheme point, in the mark scheme's order.
- awarded must equal the number of points marked present and must not exceed the marks available.
- evidence must be copied verbatim from the student's work so it can be located on the page.
- Write mathematics in LaTeX inside $...$.`;

/** Marks a transcript against the mark scheme and the question's curriculum slot. */
export async function gradeWithGemini(
  transcript: string,
  context: QuestionContext,
): Promise<GeminiGrade> {
  const raw = await callGemini([
    {
      text: `${GRADE_PROMPT}\n\n--- QUESTION AND MARK SCHEME ---\n${contextBlock(
        context,
      )}\n\n--- STUDENT'S TRANSCRIBED WORK ---\n${transcript}`,
    },
  ]);

  const parsed = parseJson<{
    markPoints?: GeminiMarkPoint[];
    awarded?: number;
    feedback?: string;
  }>(raw);

  const markPoints = (parsed.markPoints ?? [])
    .filter((point) => Boolean(point?.text))
    .map((point) => ({
      text: point.text,
      present: Boolean(point.present),
      evidence: point.evidence ?? null,
      comment: point.comment ?? null,
    }));

  const present = markPoints.filter((point) => point.present).length;
  const ceiling = context.marks || markPoints.length;
  const awarded = Number.isFinite(parsed.awarded)
    ? Math.min(Math.max(Number(parsed.awarded), 0), ceiling)
    : Math.min(present, ceiling);

  return { markPoints, awarded, feedback: parsed.feedback ?? "" };
}
