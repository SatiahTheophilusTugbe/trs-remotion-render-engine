// Pixel dimensions from an image's header bytes (JPEG / PNG / WebP). Pure; never throws -- an
// unknown or malformed header returns null. Used by rehost so the renderer knows each photo's
// aspect ratio, which the shot engine needs to keep a subject box on screen when it crops.
export type ImageDims = { width: number; height: number };

const ok = (width: number, height: number): ImageDims | null =>
  width > 0 && height > 0 ? { width, height } : null;

export const imageDimensions = (b: Uint8Array): ImageDims | null => {
  try {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    // PNG: IHDR width/height are big-endian uint32 at offsets 16/20.
    if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
      return ok(dv.getUint32(16), dv.getUint32(20));
    }
    // JPEG: walk segments to the first SOFn; height/width sit 5/7 bytes into it.
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
      let o = 2;
      while (o + 9 <= b.length) {
        if (b[o] !== 0xff) { o++; continue; }
        const m = b[o + 1];
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { o += 2; continue; }
        const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
        if (isSof) return ok(dv.getUint16(o + 7), dv.getUint16(o + 5));
        o += 2 + dv.getUint16(o + 2);
      }
      return null;
    }
    // WebP: RIFF....WEBP then a VP8X / VP8 / VP8L chunk.
    if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
      const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
      if (fourcc === 'VP8X') {
        return ok(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)));
      }
      if (fourcc === 'VP8 ') return ok(dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff);
      if (fourcc === 'VP8L') {
        const bits = dv.getUint32(21, true);
        return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
      }
    }
  } catch {
    /* malformed header */
  }
  return null;
};
