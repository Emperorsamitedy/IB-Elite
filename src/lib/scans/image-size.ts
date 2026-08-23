/**
 * Pixel dimensions from an image's header. Gemini returns boxes in a
 * normalised 0–1000 space, so the overlay needs the real size to place them.
 * Supports the formats `upload.ts` accepts: JPEG, PNG and WebP.
 */
export type ImageSize = { width: number; height: number };

function pngSize(view: DataView): ImageSize | null {
  if (view.byteLength < 24) return null;
  const isPng =
    view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a;
  if (!isPng) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(view: DataView): ImageSize | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = view.getUint8(offset + 1);
    // SOF0–SOF15, excluding the non-frame markers DHT/JPG/DAC.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}

function webpSize(view: DataView): ImageSize | null {
  if (view.byteLength < 30) return null;
  if (view.getUint32(0) !== 0x52494646) return null; // "RIFF"
  if (view.getUint32(8) !== 0x57454250) return null; // "WEBP"
  const format = view.getUint32(12);
  if (format === 0x56503820) {
    // "VP8 " lossy: 14-bit width/height after the 3-byte start code.
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (format === 0x5650384c) {
    // "VP8L" lossless: 14 bits width then 14 bits height, little-endian.
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (format === 0x56503858) {
    // "VP8X" extended: 24-bit canvas size minus one.
    const width =
      view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16);
    const height =
      view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16);
    return { width: width + 1, height: height + 1 };
  }
  return null;
}

export function imageSize(bytes: ArrayBuffer): ImageSize | null {
  const view = new DataView(bytes);
  const size = pngSize(view) ?? jpegSize(view) ?? webpSize(view);
  if (!size || size.width <= 0 || size.height <= 0) return null;
  return size;
}
