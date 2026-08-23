import { describe, expect, it } from "vitest";
import { imageSize } from "./image-size";

function png(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}

function jpeg(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0xffd8); // SOI
  view.setUint16(2, 0xffe0); // APP0
  view.setUint16(4, 4); // segment length, skipped over
  view.setUint16(8, 0xffc0); // SOF0
  view.setUint16(10, 17); // segment length
  bytes[12] = 8; // precision
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes.buffer;
}

describe("imageSize", () => {
  it("reads PNG dimensions", () => {
    expect(imageSize(png(1280, 960))).toEqual({ width: 1280, height: 960 });
  });

  it("reads JPEG dimensions from the frame header", () => {
    expect(imageSize(jpeg(1600, 1200))).toEqual({ width: 1600, height: 1200 });
  });

  it("returns null for bytes it cannot identify", () => {
    expect(imageSize(new Uint8Array([1, 2, 3, 4]).buffer)).toBeNull();
  });
});
