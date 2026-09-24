import { describe, it, expect } from 'vitest';
import {
  WIPE_HALF_FRAMES,
  WIPE_WIDTH,
  WIPE_SKEW_MARGIN,
  cutFrames,
  wipeOffsetPx,
} from './transitions';
import { layoutBeats } from './layout';

const FRAME_W = 1080;
const covers = (x: number) => x + WIPE_SKEW_MARGIN <= 0 && x + WIPE_WIDTH - WIPE_SKEW_MARGIN >= FRAME_W;
const offLeft = (x: number) => x + WIPE_WIDTH + WIPE_SKEW_MARGIN <= 0;
const offRight = (x: number) => x - WIPE_SKEW_MARGIN >= FRAME_W;

describe('cutFrames', () => {
  it('returns the start frame of every beat except the first', () => {
    const slots = layoutBeats([{ duration_sec: 5 }, { duration_sec: 4 }, { duration_sec: 3 }], 30);
    expect(cutFrames(slots)).toEqual([150, 270]);
  });
  it('returns none for zero or one beat', () => {
    expect(cutFrames([])).toEqual([]);
    expect(cutFrames(layoutBeats([{ duration_sec: 5 }], 30))).toEqual([]);
  });
});

describe('wipeOffsetPx (swept over every frame around a cut)', () => {
  const cut = 150;
  const start = cut - WIPE_HALF_FRAMES;

  it('is null outside the 10-frame window and defined inside it', () => {
    for (let f = cut - 40; f <= cut + 40; f++) {
      const inside = f >= start && f < cut + WIPE_HALF_FRAMES;
      expect(wipeOffsetPx(f, cut) !== null).toBe(inside);
    }
  });

  it('fully covers the frame on the exact cut frame (so the cut is never visible)', () => {
    expect(covers(wipeOffsetPx(cut, cut) as number)).toBe(true);
  });

  it('starts fully off-screen left, ends fully off-screen right, and only moves right', () => {
    expect(offLeft(wipeOffsetPx(start, cut) as number)).toBe(true);
    expect(offRight(wipeOffsetPx(cut + WIPE_HALF_FRAMES - 1, cut) as number)).toBe(true);
    let prev = -Infinity;
    for (let f = start; f < cut + WIPE_HALF_FRAMES; f++) {
      const x = wipeOffsetPx(f, cut) as number;
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });
});
