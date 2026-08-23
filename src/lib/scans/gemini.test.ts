import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiOcr, gradeWithGemini, isGeminiConfigured } from "./gemini";
import { gradeScan } from "./grade";
import type { QuestionContext, ScanStorage } from "./types";

const KEY = "test-gemini-key";

/** 4x2 PNG header, enough for `imageSize` to read the dimensions. */
function pngBytes(width = 400, height = 200): ArrayBuffer {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}

function storageReturning(bytes: ArrayBuffer): ScanStorage {
  return {
    async upload() {
      return "path";
    },
    async signedUrl(path) {
      return `https://storage.test/${path}`;
    },
    async download() {
      return bytes;
    },
  };
}

function respondWith(text: string) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  })) as unknown as typeof fetch;
}

const CONTEXT: QuestionContext = {
  prompt: "Differentiate $y = x^{4}$.",
  answer: "Applies the power rule;\nStates $\\frac{dy}{dx} = 4x^{3}$",
  solution: null,
  marks: 2,
  commandTerm: "Find",
  subject: "Mathematics AA",
  topic: "Calculus",
  subtopic: "Differentiation",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isGeminiConfigured", () => {
  it("is false without a key and true with one", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isGeminiConfigured()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", KEY);
    expect(isGeminiConfigured()).toBe(true);
  });
});

describe("createGeminiOcr", () => {
  it("maps normalised line boxes onto the image's real pixels", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      respondWith(
        JSON.stringify({
          lines: [
            { text: "$y = x^{4}$", box: [0, 0, 500, 500] },
            { text: "$\\frac{dy}{dx} = 4x^{3}$", box: [500, 250, 1000, 750] },
          ],
        }),
      ),
    );

    const result = await createGeminiOcr(storageReturning(pngBytes(400, 200))).read(
      "student/answer.png",
    );

    expect(result.text).toBe("$y = x^{4}$\n$\\frac{dy}{dx} = 4x^{3}$");
    expect(result.words[0].box).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(result.words[1].box).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it("retries once when the free tier is momentarily overloaded", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "high demand" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: '{"lines":[{"text":"x = 2","box":[0,0,10,10]}]}' }],
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await createGeminiOcr(storageReturning(pngBytes())).read(
      "student/answer.png",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe("x = 2");
  });

  it("surfaces the API's error message rather than a generic failure", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: { message: "API key not valid" } }),
      })) as unknown as typeof fetch,
    );

    await expect(
      createGeminiOcr(storageReturning(pngBytes())).read("student/answer.png"),
    ).rejects.toThrow(/API key not valid/);
  });

  it("refuses to run without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(
      createGeminiOcr(storageReturning(pngBytes())).read("student/answer.png"),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

describe("gradeWithGemini", () => {
  it("caps the award at the marks available and keeps the evidence", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      respondWith(
        JSON.stringify({
          markPoints: [
            {
              text: "Applies the power rule",
              present: true,
              evidence: "4x^{3}",
              comment: null,
            },
            {
              text: "States $\\frac{dy}{dx} = 4x^{3}$",
              present: true,
              evidence: "4x^{3}",
              comment: "Correct.",
            },
          ],
          awarded: 9,
          feedback: "Set out the power rule before differentiating.",
        }),
      ),
    );

    const grade = await gradeWithGemini("$4x^{3}$", CONTEXT);

    expect(grade.awarded).toBe(2);
    expect(grade.markPoints).toHaveLength(2);
    expect(grade.markPoints[1].comment).toBe("Correct.");
  });
});

describe("gradeScan", () => {
  it("falls back to keyword matching when Gemini is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const ocr = {
      text: "applies the power rule",
      words: [
        {
          text: "applies the power rule",
          box: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    };

    const result = await gradeScan(ocr, CONTEXT);

    expect(result.source).toBe("keywords");
    expect(result.markPoints[0].present).toBe(true);
  });

  it("anchors an AI mark point to the line its evidence came from", async () => {
    vi.stubEnv("GEMINI_API_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      respondWith(
        JSON.stringify({
          markPoints: [
            {
              text: "Applies the power rule",
              present: true,
              evidence: "dy/dx = 4x^3",
              comment: null,
            },
          ],
          awarded: 1,
          feedback: "Good.",
        }),
      ),
    );

    const box = { x: 4, y: 8, width: 20, height: 6 };
    const result = await gradeScan(
      { text: "dy/dx = 4x^3", words: [{ text: "dy/dx = 4x^3", box }] },
      CONTEXT,
    );

    expect(result.source).toBe("ai");
    expect(result.feedback).toBe("Good.");
    expect(result.markPoints[0].box).toEqual(box);
  });
});
