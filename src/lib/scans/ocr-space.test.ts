import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOcrSpaceOcr } from "./ocr-space";
import type { ScanStorage } from "./types";

function storageReturning(bytes: ArrayBuffer): ScanStorage {
  return {
    upload: vi.fn(async () => "scans/student-1/answer.jpg"),
    signedUrl: vi.fn(async () => "https://example.test/answer.jpg"),
    download: vi.fn(async () => bytes),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const OK_PAYLOAD = {
  IsErroredOnProcessing: false,
  ParsedResults: [
    {
      ParsedText: "Momentum is conserved",
      TextOverlay: {
        Lines: [
          {
            Words: [
              { WordText: "Momentum", Left: 10, Top: 20, Width: 90, Height: 18 },
              { WordText: "is", Left: 104, Top: 20, Width: 14, Height: 18 },
            ],
          },
          { Words: [{ WordText: "conserved", Left: 10, Top: 48, Width: 96, Height: 18 }] },
        ],
      },
    },
  ],
};

describe("createOcrSpaceOcr", () => {
  beforeEach(() => {
    process.env.OCR_SPACE_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.OCR_SPACE_API_KEY;
    vi.unstubAllGlobals();
  });

  it("posts to /parse/image with the handwriting engine and parses word boxes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(OK_PAYLOAD));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOcrSpaceOcr(storageReturning(new ArrayBuffer(64))).read(
      "scans/student-1/answer.jpg",
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ocr.space/parse/image");
    expect((init.headers as Record<string, string>).apikey).toBe("test-key");

    const body = new URLSearchParams(init.body as string);
    expect(body.get("OCREngine")).toBe("3");
    expect(body.get("isOverlayRequired")).toBe("true");
    expect(body.get("base64Image")).toMatch(/^data:image\/jpg;base64,/);

    expect(result.text).toBe("Momentum is conserved");
    expect(result.words).toHaveLength(3);
    expect(result.words[0]).toEqual({
      text: "Momentum",
      box: { x: 10, y: 20, width: 90, height: 18 },
    });
  });

  it("throws the provider's message when OCR.space reports a processing error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          IsErroredOnProcessing: true,
          ErrorMessage: ["File size exceeds the maximum"],
        }),
      ),
    );

    await expect(
      createOcrSpaceOcr(storageReturning(new ArrayBuffer(64))).read("a.jpg"),
    ).rejects.toThrow("File size exceeds the maximum");
  });

  it("rejects files above the free-tier size before spending a request", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(OK_PAYLOAD));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOcrSpaceOcr(storageReturning(new ArrayBuffer(2 * 1024 * 1024))).read("a.jpg"),
    ).rejects.toThrow(/OCR.space accepts up to 1MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the key is missing", async () => {
    delete process.env.OCR_SPACE_API_KEY;
    await expect(
      createOcrSpaceOcr(storageReturning(new ArrayBuffer(8))).read("a.jpg"),
    ).rejects.toThrow("OCR_SPACE_API_KEY is not configured.");
  });
});
