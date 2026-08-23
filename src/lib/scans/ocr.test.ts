import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeScanStorage } from "./fake-store";
import { createScanOcr, isScanOcrConfigured } from "./ocr";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createScanOcr", () => {
  it("still has a provider with no keys at all — OCR.space's demo key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OCR_SPACE_API_KEY", "");
    const fetchMock: ReturnType<typeof vi.fn> = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ParsedResults: [{ ParsedText: "x = 2" }] }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await createScanOcr(createFakeScanStorage()).read(
      "student/answer.jpg",
    );

    expect(isScanOcrConfigured()).toBe(true);
    expect(result.text).toBe("x = 2");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("ocr.space");
  });

  it("prefers Gemini when both providers are configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("OCR_SPACE_API_KEY", "ocr-space-key");
    const fetchMock: ReturnType<typeof vi.fn> = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"lines":[]}' }] } }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await createScanOcr(createFakeScanStorage()).read("student/answer.jpg");

    expect(isScanOcrConfigured()).toBe(true);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("generativelanguage.googleapis.com");
  });
});
