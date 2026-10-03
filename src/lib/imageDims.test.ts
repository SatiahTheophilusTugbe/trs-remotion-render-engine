import { describe, it, expect } from 'vitest';
import { imageDimensions } from './imageDims';

const png = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};

// SOI, an APP0 segment (to prove segments are skipped), then SOF0 with height/width.
const jpeg = (w: number, h: number) =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
    0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0x01, 0x22, 0x00,
  ]);

const webpVp8x = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]);
  const w1 = w - 1;
  const h1 = h - 1;
  b.set([w1 & 0xff, (w1 >> 8) & 0xff, (w1 >> 16) & 0xff, h1 & 0xff, (h1 >> 8) & 0xff, (h1 >> 16) & 0xff], 24);
  return b;
};

const webpVp8l = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c]);
  b[20] = 0x2f;
  const bits = (w - 1) | ((h - 1) << 14);
  b.set([bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff], 21);
  return b;
};

describe('imageDimensions', () => {
  it('reads PNG', () => expect(imageDimensions(png(1200, 800))).toEqual({ width: 1200, height: 800 }));
  it('reads JPEG, skipping non-SOF segments', () =>
    expect(imageDimensions(jpeg(5097, 3632))).toEqual({ width: 5097, height: 3632 }));
  it('reads WebP VP8X', () => expect(imageDimensions(webpVp8x(768, 512))).toEqual({ width: 768, height: 512 }));
  it('reads WebP VP8L', () => expect(imageDimensions(webpVp8l(640, 427))).toEqual({ width: 640, height: 427 }));
  it('returns null for unknown or truncated data, never throws', () => {
    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(imageDimensions(jpeg(10, 10).slice(0, 12))).toBeNull();
    expect(imageDimensions(png(0, 800))).toBeNull();
  });
});
