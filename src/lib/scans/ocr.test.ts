import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeScanStorage } from "./fake-store";
import { createScanOcr, isScanOcrConfigured } from "./ocr";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createScanOcr", () => {
  it("reports no provider when neither key is set", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OCR_SPACE_API_KEY", "");
    expect(isScanOcrConfigured()).toBe(false);
  });

  it("fails with an actionable message instead of hanging when unconfigured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("OCR_SPACE_API_KEY", "");
    await expect(
      createScanOcr(createFakeScanStorage()).read("student/answer.jpg"),
    ).rejects.toThrow(/not configured/);
  });

  it("prefers Gemini when both providers are configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("OCR_SPACE_API_KEY", "ocr-space-key");
    const fetchMock = vi.fn(async () => ({
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
